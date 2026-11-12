import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StockMovementType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { rethrowAsConflict } from '../common/prisma-errors';
import { USER_SUMMARY } from '../common/selects';
import { LOCATION_INDICATOR, LocationIndicator } from '../led/led.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateBoxDto } from './dto/create-box.dto';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdateBoxDto } from './dto/update-box.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { decreaseStock, emitLowStockAlerts, increaseStock } from './stock-ledger';

/** Máximo de coincidencias de la búsqueda por voz/autocompletar. */
export const PART_SEARCH_LIMIT = 5;
const MOVEMENTS_PAGE_SIZE = 200;

const duplicateLedIndex = (ledIndex?: number) =>
  `Ya existe una caja con ledIndex ${ledIndex}. Cada LED solo puede asignarse a una caja.`;
const duplicatePartCode = (code?: string) => `Ya existe una pieza con el código "${code}"`;

/** Resultado de "Localizar artículo": la ubicación textual sirve aunque el hardware falle. */
export interface LocateResult {
  partId: number;
  partName: string;
  boxName: string;
  ledIndex: number;
  location: string | null;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    @Inject(LOCATION_INDICATOR) private readonly indicator: LocationIndicator,
  ) {}

  // ──────────────────────────────────────────────────────────
  // BOXES (ubicaciones de almacén + indicador LED)
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
      throw new ConflictException('No se puede eliminar una caja que contiene piezas.');
    }

    await this.prisma.box.delete({ where: { id } });
  }

  // ──────────────────────────────────────────────────────────
  // PARTS
  // ──────────────────────────────────────────────────────────

  async findAllParts() {
    return this.prisma.part.findMany({
      include: { box: { select: { id: true, name: true, ledIndex: true, location: true } } },
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

  /** El stock inicial queda en el kardex como INVENTARIO_INICIAL. */
  async createPart(dto: CreatePartDto, userId?: number) {
    await this.findOneBox(dto.boxId);
    const { quantity, ...data } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const part = await tx.part.create({ data: { ...data, quantity: 0 } });
        if (quantity > 0) {
          await increaseStock(tx, {
            partId: part.id,
            quantity,
            type: StockMovementType.INVENTARIO_INICIAL,
            reason: 'Alta de artículo',
            userId,
          });
        }
        return tx.part.findUniqueOrThrow({ where: { id: part.id }, include: { box: true } });
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

  /** Datos del artículo y su ubicación (`boxId`). El stock se cambia con adjustStock. */
  async updatePart(id: number, dto: UpdatePartDto, userId?: number) {
    const current = await this.findOnePart(id);
    if (dto.boxId !== undefined) {
      await this.findOneBox(dto.boxId);
    }

    try {
      const updated = await this.prisma.part.update({
        where: { id },
        data: dto,
        include: { box: true },
      });
      const priceChanged =
        dto.unitPrice !== undefined && !current.unitPrice?.equals(dto.unitPrice);
      if (priceChanged || (dto.boxId !== undefined && dto.boxId !== current.boxId)) {
        await this.audit.record({
          action: 'PART_UPDATED',
          entity: 'Part',
          entityId: id,
          userId,
          detail: {
            unitPrice: priceChanged ? { from: current.unitPrice?.toString() ?? null, to: dto.unitPrice ?? null } : undefined,
            boxId: dto.boxId !== undefined && dto.boxId !== current.boxId ? { from: current.boxId, to: dto.boxId } : undefined,
          },
        });
      }
      return updated;
    } catch (error) {
      rethrowAsConflict(error, { P2002: duplicatePartCode(dto.code) });
    }
  }

  /**
   * Actualizar stock de artículo: ajuste por conteo físico o devolución al
   * proveedor. Deja movimiento en el kardex y auditoría.
   */
  async adjustStock(id: number, dto: AdjustStockDto, userId: number) {
    await this.findOnePart(id);
    if (dto.type === StockMovementType.DEVOLUCION_PROVEEDOR && dto.delta > 0) {
      throw new BadRequestException('Una devolución al proveedor debe restar unidades (delta negativo)');
    }

    const change = {
      partId: id,
      quantity: Math.abs(dto.delta),
      type: dto.type,
      reason: dto.reason.trim(),
      userId,
    };
    const result = await this.prisma.$transaction(async (tx) => {
      const outcome = dto.delta > 0 ? await increaseStock(tx, change) : await decreaseStock(tx, change);
      await this.audit.record(
        {
          action: 'STOCK_ADJUSTED',
          entity: 'Part',
          entityId: id,
          userId,
          detail: { type: dto.type, delta: dto.delta, reason: change.reason, balanceAfter: outcome.balanceAfter },
        },
        tx,
      );
      return outcome;
    });
    emitLowStockAlerts(this.events, [result]);
    return this.findOnePart(id);
  }

  /** Kardex: movimientos recientes (de una pieza o de todas). */
  findMovements(partId?: number) {
    return this.prisma.stockMovement.findMany({
      where: partId ? { partId } : undefined,
      include: {
        part: { select: { id: true, name: true, code: true } },
        user: USER_SUMMARY,
      },
      orderBy: { createdAt: 'desc' },
      take: MOVEMENTS_PAGE_SIZE,
    });
  }

  async removePart(id: number) {
    await this.findOnePart(id);
    try {
      await this.prisma.part.delete({ where: { id } });
    } catch (error) {
      rethrowAsConflict(error, {
        P2003:
          'La pieza está registrada en órdenes de trabajo, pedidos o solicitudes de reposición; no se puede eliminar',
      });
    }
  }

  /**
   * Búsqueda por nombre, código o keywords (Alexa y autocompletar).
   * Case-insensitive con ILIKE en PostgreSQL.
   */
  async searchPartByName(query: string) {
    const normalizedQuery = query.trim().toLowerCase();

    return this.prisma.part.findMany({
      where: {
        OR: [
          { name: { contains: normalizedQuery, mode: 'insensitive' } },
          { code: { contains: normalizedQuery, mode: 'insensitive' } },
          { keywords: { has: normalizedQuery } },
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
  }

  /**
   * Localizar artículo (pick-to-light): enciende el LED de su caja sin esperar
   * la secuencia. Si el hardware falla solo se registra en el log; la respuesta
   * incluye la ubicación textual para no bloquear la operación.
   */
  async locatePart(id: number): Promise<LocateResult> {
    const part = await this.findOnePart(id);
    const { box } = part;
    this.signalBox(box.ledIndex, part.name, box.colorHex);
    return {
      partId: part.id,
      partName: part.name,
      boxName: box.name,
      ledIndex: box.ledIndex,
      location: box.location,
    };
  }

  /**
   * Señaliza varias piezas a la vez (put-to-light al recibir compras). Cajas
   * distintas encienden su propio LED en paralelo. Nunca lanza.
   */
  async signalParts(partIds: number[], labelPrefix: string): Promise<void> {
    if (partIds.length === 0) return;
    try {
      const parts = await this.prisma.part.findMany({
        where: { id: { in: [...new Set(partIds)] } },
        select: { name: true, box: { select: { ledIndex: true, colorHex: true } } },
      });
      for (const part of parts) {
        this.signalBox(part.box.ledIndex, `${labelPrefix}: ${part.name}`, part.box.colorHex);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo señalizar las cajas: ${message}`);
    }
  }

  private signalBox(ledIndex: number, label: string, colorHex: string) {
    this.indicator.locate({ ledIndex, label, colorHex }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo señalizar "${label}": ${message}`);
    });
  }

  // ──────────────────────────────────────────────────────────
  // ALERTAS DE STOCK BAJO
  // ──────────────────────────────────────────────────────────

  async getLowStockParts() {
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
