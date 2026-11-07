import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, WorkOrderStatus } from '@prisma/client';
import { isPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  WorkOrderPartDto,
} from './dto/work-order.dto';

const USER_SUMMARY = { select: { id: true, name: true, email: true } } as const;

const WORK_ORDER_INCLUDE = {
  vehicle: { include: { owner: USER_SUMMARY } },
  mechanic: USER_SUMMARY,
  parts: { include: { part: true } },
  invoice: true,
} as const;

@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.workOrder.findMany({
      include: WORK_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.workOrder.findUnique({
      where: { id },
      include: WORK_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException(`Orden de trabajo con id ${id} no encontrada`);
    return order;
  }

  async create(dto: CreateWorkOrderDto) {
    await this.ensureVehicle(dto.vehicleId);
    if (dto.mechanicId !== undefined) await this.ensureMechanic(dto.mechanicId);
    if (dto.parts?.length) await this.ensureParts(dto.parts);

    try {
      return await this.prisma.workOrder.create({
        data: {
          number: dto.number,
          description: dto.description,
          estimatedCost: dto.estimatedCost,
          vehicleId: dto.vehicleId,
          mechanicId: dto.mechanicId,
          parts: dto.parts?.length
            ? { create: dto.parts.map(({ partId, quantity }) => ({ partId, quantity })) }
            : undefined,
        },
        include: WORK_ORDER_INCLUDE,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          `Ya existe una orden con el número "${dto.number}" o piezas repetidas`,
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateWorkOrderDto) {
    const order = await this.findOne(id);
    if (order.status === WorkOrderStatus.CERRADA) {
      throw new ConflictException('Una orden cerrada no puede modificarse');
    }
    if (dto.status === WorkOrderStatus.CERRADA) {
      throw new BadRequestException(
        'Para cerrar la orden usa PATCH /api/service/work-orders/:id/close (descuenta inventario)',
      );
    }
    if (dto.mechanicId !== undefined) await this.ensureMechanic(dto.mechanicId);

    const startsNow = dto.status === WorkOrderStatus.EN_PROGRESO && !order.startedAt;

    return this.prisma.workOrder.update({
      where: { id },
      data: { ...dto, startedAt: startsNow ? new Date() : undefined },
      include: WORK_ORDER_INCLUDE,
    });
  }

  async remove(id: number) {
    const order = await this.findOne(id);
    if (order.status === WorkOrderStatus.CERRADA) {
      throw new ConflictException(
        'No se puede eliminar una orden cerrada: ya descontó inventario',
      );
    }
    try {
      // Los WorkOrderItem se eliminan en cascada.
      await this.prisma.workOrder.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2003')) {
        throw new ConflictException('La orden tiene una factura asociada');
      }
      throw error;
    }
  }

  private async ensureVehicle(id: number) {
    const count = await this.prisma.vehicle.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
  }

  private async ensureMechanic(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, isActive: true },
    });
    if (!user) throw new NotFoundException(`Mecánico con id ${id} no encontrado`);
    if (user.role === Role.CLIENTE || !user.isActive) {
      throw new ConflictException('El usuario asignado no es un mecánico activo');
    }
  }

  private async ensureParts(parts: WorkOrderPartDto[]) {
    const ids = [...new Set(parts.map((part) => part.partId))];
    if (ids.length !== parts.length) {
      throw new BadRequestException('Una pieza aparece repetida en la orden');
    }
    const count = await this.prisma.part.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new NotFoundException('Una o más piezas no existen');
  }
}
