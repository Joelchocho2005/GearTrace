import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

const OWNER_SELECT = { select: { id: true, name: true, email: true } } as const;

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.vehicle.findMany({
      include: { owner: OWNER_SELECT },
      orderBy: { plate: 'asc' },
    });
  }

  async findOne(id: number) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        owner: OWNER_SELECT,
        workOrders: { orderBy: { createdAt: 'desc' } },
        appointments: { orderBy: { scheduledAt: 'desc' } },
      },
    });
    if (!vehicle) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
    return vehicle;
  }

  async create(dto: CreateVehicleDto) {
    await this.ensureOwner(dto.ownerId);
    try {
      return await this.prisma.vehicle.create({
        data: dto,
        include: { owner: OWNER_SELECT },
      });
    } catch (error) {
      this.throwDuplicate(error);
      throw error;
    }
  }

  async update(id: number, dto: UpdateVehicleDto) {
    await this.ensureExists(id);
    if (dto.ownerId !== undefined) await this.ensureOwner(dto.ownerId);
    try {
      return await this.prisma.vehicle.update({
        where: { id },
        data: dto,
        include: { owner: OWNER_SELECT },
      });
    } catch (error) {
      this.throwDuplicate(error);
      throw error;
    }
  }

  async remove(id: number) {
    await this.ensureExists(id);
    try {
      await this.prisma.vehicle.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2003')) {
        throw new ConflictException(
          'No se puede eliminar un vehículo con órdenes o citas asociadas',
        );
      }
      throw error;
    }
  }

  private async ensureExists(id: number) {
    const count = await this.prisma.vehicle.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
  }

  private async ensureOwner(id: number) {
    const count = await this.prisma.user.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Usuario con id ${id} no encontrado`);
  }

  private throwDuplicate(error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      throw new ConflictException('La placa o VIN ya está registrado');
    }
  }
}
