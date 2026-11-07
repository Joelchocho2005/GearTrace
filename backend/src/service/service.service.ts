import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { CreateWorkOrderDto } from './dto/work-order.dto';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  findVehicles() {
    return this.prisma.vehicle.findMany({
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { plate: 'asc' },
    });
  }

  async findVehicle(id: number) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { owner: true, workOrders: true, appointments: true },
    });
    if (!vehicle) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
    return vehicle;
  }

  async createVehicle(dto: CreateVehicleDto) {
    await this.ensureUser(dto.ownerId);
    try {
      return await this.prisma.vehicle.create({ data: dto });
    } catch (error) {
      this.throwUniqueVehicleError(error);
      throw error;
    }
  }

  async updateVehicle(id: number, dto: UpdateVehicleDto) {
    await this.findVehicle(id);
    if (dto.ownerId !== undefined) await this.ensureUser(dto.ownerId);
    try {
      return await this.prisma.vehicle.update({ where: { id }, data: dto });
    } catch (error) {
      this.throwUniqueVehicleError(error);
      throw error;
    }
  }

  async removeVehicle(id: number) {
    await this.findVehicle(id);
    try {
      await this.prisma.vehicle.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar un vehículo con órdenes o citas asociadas');
      }
      throw error;
    }
  }

  findWorkOrders() {
    return this.prisma.workOrder.findMany({
      include: {
        vehicle: true,
        mechanic: { select: { id: true, name: true, email: true } },
        parts: { include: { part: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWorkOrder(dto: CreateWorkOrderDto) {
    await this.findVehicle(dto.vehicleId);
    if (dto.mechanicId !== undefined) await this.ensureMechanic(dto.mechanicId);
    if (dto.parts) await this.ensureParts(dto.parts);

    try {
      return await this.prisma.workOrder.create({
        data: {
          number: dto.number,
          description: dto.description,
          estimatedCost: dto.estimatedCost,
          vehicleId: dto.vehicleId,
          mechanicId: dto.mechanicId,
          parts: dto.parts
            ? { create: dto.parts.map((part) => ({ partId: part.partId, quantity: part.quantity })) }
            : undefined,
        },
        include: { vehicle: true, parts: { include: { part: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe una orden con el número "${dto.number}"`);
      }
      throw error;
    }
  }

  async updateWorkOrderStatus(id: number, status: WorkOrderStatus) {
    const order = await this.findWorkOrder(id);
    if (order.status === WorkOrderStatus.CERRADA) {
      throw new ConflictException('Una orden cerrada no puede cambiar de estado');
    }
    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status,
        startedAt: status === WorkOrderStatus.EN_PROGRESO ? new Date() : undefined,
      },
      include: { vehicle: true, parts: { include: { part: true } } },
    });
  }

  async diagnoseWorkOrder(id: number, diagnosis: string) {
    await this.findWorkOrder(id);
    return this.prisma.workOrder.update({
      where: { id },
      data: { diagnosis, status: WorkOrderStatus.EN_DIAGNOSTICO },
      include: { vehicle: true, parts: { include: { part: true } } },
    });
  }

  async closeWorkOrder(id: number, finalCost?: number) {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({
        where: { id },
        include: { parts: true },
      });
      if (!order) throw new NotFoundException(`Orden de trabajo con id ${id} no encontrada`);
      if (order.status === WorkOrderStatus.CERRADA) {
        throw new ConflictException('La orden de trabajo ya está cerrada');
      }

      for (const item of order.parts) {
        const updated = await transaction.part.updateMany({
          where: { id: item.partId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new ConflictException(`Stock insuficiente para el repuesto ${item.partId}`);
        }
      }

      return transaction.workOrder.update({
        where: { id },
        data: {
          status: WorkOrderStatus.CERRADA,
          finalCost,
          completedAt: new Date(),
        },
        include: { vehicle: true, parts: { include: { part: true } } },
      });
    });
  }

  private async findWorkOrder(id: number) {
    const order = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Orden de trabajo con id ${id} no encontrada`);
    return order;
  }

  private async ensureUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario con id ${id} no encontrado`);
  }

  private async ensureMechanic(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Mecánico con id ${id} no encontrado`);
    if (user.role !== 'MECANICO' && user.role !== 'GERENTE') {
      throw new ConflictException('El usuario asignado no tiene rol de mecánico');
    }
  }

  private async ensureParts(parts: { partId: number; quantity: number }[]) {
    const ids = [...new Set(parts.map((part) => part.partId))];
    const count = await this.prisma.part.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new NotFoundException('Una o más piezas no existen');
  }

  private throwUniqueVehicleError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('La placa o VIN ya está registrado');
    }
  }
}
