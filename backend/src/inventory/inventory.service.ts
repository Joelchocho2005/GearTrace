import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { LOCATION_INDICATOR, LocationIndicator } from '../led/led.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartDto } from './dto/create-part.dto';
import { CreateBoxDto } from './dto/create-box.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { UpdateBoxDto } from './dto/update-box.dto';
import { rethrowAsConflict } from '../common/prisma-errors';

/** Máximo de coincidencias de la búsqueda por voz/autocompletar. */
export const PART_SEARCH_LIMIT = 5;

const duplicateLedIndex = (ledIndex?: number) =>
  `Ya existe una caja con ledIndex ${ledIndex}. Cada LED solo puede asignarse a una caja.`;
const duplicatePartCode = (code?: string) => `Ya existe una pieza con el código "${code}"`;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOCATION_INDICATOR) private readonly indicator: LocationIndicator,
  ) {}

  // ──────────────────────────────────────────────────────────
  // BOXES
  // ──────────────────────────────────────────────────────────

  async findAllBoxes() {
    return this.prisma.box.findMany({
      include: {
        parts: {
          select: {
            id: true,
            name: true,
            code: true,
            quantity: true,
            minStock: true,
            photoUrl: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { ledIndex: 'asc' },
    });
  }

  async findOneBox(id: number) {
    const box = await this.prisma.box.findUnique({
      where: { id },
      include: { parts: true },
    });
    if (!box) throw new NotFoundException(`Caja con id ${id} no encontrada`);
    return box;
  }

  async createBox(dto: CreateBoxDto) {
    try {
      return await this.prisma.box.create({ data: dto });
    } catch (error) {
      rethrowAsConflict(error, { P2002: duplicateLedIndex(dto.ledIndex) });
    }
  }

  async updateBox(id: number, dto: UpdateBoxDto) {
    await this.findOneBox(id);

    try {
      return await this.prisma.box.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      rethrowAsConflict(error, { P2002: duplicateLedIndex(dto.ledIndex) });
    }
  }

  async removeBox(id: number) {
    const box = await this.findOneBox(id);
    if (box.parts.length > 0) {
      throw new ConflictException(
        'No se puede eliminar una caja que contiene piezas.',
      );
    }

    await this.prisma.box.delete({ where: { id } });
  }

  // ──────────────────────────────────────────────────────────
  // PARTS
  // ──────────────────────────────────────────────────────────

  async findAllParts() {
    return this.prisma.part.findMany({
      include: { box: { select: { id: true, name: true, ledIndex: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOnePart(id: number) {
    const part = await this.prisma.part.findUnique({
      where: { id },
      include: { box: true },
    });
    if (!part) throw new NotFoundException(`Pieza con id ${id} no encontrada`);
    return part;
  }

  async createPart(dto: CreatePartDto) {
    // Verificar que la caja existe antes de crear la pieza
    await this.findOneBox(dto.boxId);

    try {
      return await this.prisma.part.create({
        data: dto,
        include: { box: true },
      });
    } catch (error) {
      rethrowAsConflict(error, { P2002: duplicatePartCode(dto.code) });
    }
  }

  async updatePartPhoto(id: number, photoUrl: string) {
    await this.findOnePart(id);

    return this.prisma.part.update({
      where: { id },
      data: { photoUrl },
      include: { box: true },
    });
  }

  async updatePart(id: number, dto: UpdatePartDto) {
    await this.findOnePart(id);
    if (dto.boxId !== undefined) {
      await this.findOneBox(dto.boxId);
    }

    try {
      return await this.prisma.part.update({
        where: { id },
        data: dto,
        include: { box: true },
      });
    } catch (error) {
      rethrowAsConflict(error, { P2002: duplicatePartCode(dto.code) });
    }
  }

  async removePart(id: number) {
    await this.findOnePart(id);
    try {
      await this.prisma.part.delete({ where: { id } });
    } catch (error) {
      rethrowAsConflict(error, {
        P2003: 'La pieza está registrada en órdenes de trabajo o pedidos de compra; no se puede eliminar',
      });
    }
  }

  /**
   * Búsqueda por nombre o keywords para integración con Alexa.
   * Usa búsqueda case-insensitive con ILIKE en PostgreSQL.
   *
   * @param query Texto buscado (nombre de pieza o keyword de voz)
   * @returns Array de piezas con información de su caja (incluido ledIndex)
   */
  async searchPartByName(query: string) {
    const normalizedQuery = query.trim().toLowerCase();

    const parts = await this.prisma.part.findMany({
      where: {
        OR: [
          { name: { contains: normalizedQuery, mode: 'insensitive' } },
          { code: { contains: normalizedQuery, mode: 'insensitive' } },
          // Búsqueda en el array de keywords de PostgreSQL
          {
            keywords: {
              has: normalizedQuery,
            },
          },
        ],
      },
      include: {
        box: {
          select: {
            id: true,
            name: true,
            ledIndex: true,
            colorHex: true,
            location: true,
          },
        },
      },
      take: PART_SEARCH_LIMIT,
    });

    return parts;
  }

  /**
   * Enciende el LED de la caja de la pieza (mismo efecto que la búsqueda por
   * Alexa). No espera la secuencia del LED: responde enseguida y un fallo del
   * hardware solo se registra en el log.
   */
  async locatePart(id: number) {
    const part = await this.findOnePart(id);
    const { box } = part;
    this.indicator
      .locate({ ledIndex: box.ledIndex, label: part.name, colorHex: box.colorHex })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`No se pudo señalizar "${part.name}": ${message}`);
      });
    return { partId: part.id, partName: part.name, boxName: box.name, ledIndex: box.ledIndex };
  }

  async updatePartQuantity(id: number, delta: number) {
    const part = await this.findOnePart(id);
    const newQuantity = part.quantity + delta;

    if (newQuantity < 0) {
      throw new ConflictException(
        `Stock insuficiente. Disponible: ${part.quantity}`,
      );
    }

    return this.prisma.part.update({
      where: { id },
      data: { quantity: newQuantity },
    });
  }

  // ──────────────────────────────────────────────────────────
  // ALERTAS DE STOCK BAJO
  // ──────────────────────────────────────────────────────────

  async getLowStockParts() {
    // Retorna piezas donde la cantidad está por debajo del mínimo
    return this.prisma.$queryRaw<
      Array<{ id: number; name: string; quantity: number; min_stock: number; box_name: string }>
    >`
      SELECT p.id, p.name, p.quantity, p.min_stock, b.name as box_name
      FROM parts p
      JOIN boxes b ON p.box_id = b.id
      WHERE p.quantity <= p.min_stock
      ORDER BY p.quantity ASC
    `;
  }
}
