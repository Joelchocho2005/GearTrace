import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { rethrowAsConflict } from '../common/prisma-errors';
import { USER_SUMMARY } from '../common/selects';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

const DUPLICATE_PLATE_OR_VIN = 'La placa o VIN ya está registrado';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.vehicle.findMany({
      include: { owner: USER_SUMMARY },
      orderBy: { plate: 'asc' },
    });
  }

  async findOne(id: number) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        owner: USER_SUMMARY,
        workOrders: { orderBy: { createdAt: 'desc' } },
        appointments: { orderBy: { scheduledAt: 'desc' } },
      },
    });
    if (!vehicle) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
    return vehicle;
  }

  /** RF-SER-01: registra un vehículo validando que la placa no exista. */
  async create(dto: CreateVehicleDto) {
    await this.ensureOwner(dto.ownerId);
    await this.ensurePlateAvailable(dto.plate);
    try {
      return await this.prisma.vehicle.create({
        data: dto,
        include: { owner: USER_SUMMARY },
      });
    } catch (error) {
      rethrowAsConflict(error, { P2002: DUPLICATE_PLATE_OR_VIN });
    }
  }

  async update(id: number, dto: UpdateVehicleDto) {
    await this.ensureExists(id);
    if (dto.ownerId !== undefined) await this.ensureOwner(dto.ownerId);
    if (dto.plate !== undefined) await this.ensurePlateAvailable(dto.plate, id);
    try {
      return await this.prisma.vehicle.update({
        where: { id },
        data: dto,
        include: { owner: USER_SUMMARY },
      });
    } catch (error) {
      rethrowAsConflict(error, { P2002: DUPLICATE_PLATE_OR_VIN });
    }
  }

  async remove(id: number) {
    await this.ensureExists(id);
    try {
      await this.prisma.vehicle.delete({ where: { id } });
    } catch (error) {
      rethrowAsConflict(error, {
        P2003: 'No se puede eliminar un vehículo con órdenes o citas asociadas',
      });
    }
  }

  private async ensureExists(id: number) {
    const count = await this.prisma.vehicle.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
  }

  private async ensureOwner(id: number) {
    const owner = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, isActive: true },
    });
    if (!owner) throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    if (owner.role !== Role.CLIENTE || !owner.isActive) {
      throw new ConflictException('El propietario debe ser un cliente activo');
    }
  }

  /**
   * Comparación sin distinguir mayúsculas para cubrir placas antiguas no
   * normalizadas. El índice único de `plate` sigue cubriendo la concurrencia.
   */
  private async ensurePlateAvailable(plate: string, excludeId?: number) {
    const existing = await this.prisma.vehicle.findFirst({
      where: {
        plate: { equals: plate, mode: 'insensitive' },
        ...(excludeId !== undefined && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`La placa "${plate}" ya está registrada`);
  }
}
