import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, WorkOrderStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { isPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddUsedPartDto,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  WorkOrderPartDto,
} from './dto/work-order.dto';
import { nextWorkOrderNumber } from './work-order-number';
import { workOrderScope } from './work-order-scope';

const USER_SUMMARY = { select: { id: true, name: true, email: true } } as const;

const WORK_ORDER_INCLUDE = {
  vehicle: { include: { owner: USER_SUMMARY } },
  mechanic: USER_SUMMARY,
  parts: { include: { part: true } },
  invoice: true,
} as const;

/**
 * Fuente única de la lógica de órdenes de trabajo. También la usan las rutas
 * legadas /api/service/work-orders (GET y POST).
 */
@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /** GERENTE ve todas; MECANICO solo las asignadas a él. */
  findAll(user: AuthenticatedUser) {
    return this.prisma.workOrder.findMany({
      where: workOrderScope(user),
      include: WORK_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Una orden fuera del alcance del usuario responde 404 (no revela que existe). */
  async findOne(id: number, user: AuthenticatedUser) {
    const order = await this.prisma.workOrder.findFirst({
      where: { id, ...workOrderScope(user) },
      include: WORK_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException(`Orden de trabajo con id ${id} no encontrada`);
    return order;
  }

  /**
   * RF-SER-05: el código OT-YYYY-NNN se genera en la misma transacción que la orden.
   * RF-INV-13: los repuestos iniciales descuentan stock en esa misma transacción;
   * si alguno no alcanza, no se crea nada.
   */
  async create(dto: CreateWorkOrderDto, user: AuthenticatedUser) {
    const mechanicId = this.resolveMechanicId(dto.mechanicId, user);
    await this.ensureVehicle(dto.vehicleId);
    if (mechanicId !== undefined) await this.ensureMechanic(mechanicId);
    if (dto.parts?.length) await this.ensureParts(dto.parts);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const number = await nextWorkOrderNumber(tx);
        const order = await tx.workOrder.create({
          data: {
            number,
            description: dto.description,
            estimatedCost: dto.estimatedCost,
            mileage: dto.mileage,
            vehicleId: dto.vehicleId,
            mechanicId,
          },
          select: { id: true },
        });
        for (const { partId, quantity } of dto.parts ?? []) {
          await this.consumePart(tx, order.id, partId, quantity);
        }
        return tx.workOrder.findUniqueOrThrow({
          where: { id: order.id },
          include: WORK_ORDER_INCLUDE,
        });
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('No se pudo generar un código de orden único; intenta de nuevo');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateWorkOrderDto, user: AuthenticatedUser) {
    const order = await this.findOne(id, user);
    if (order.status === WorkOrderStatus.CONCLUIDO) {
      throw new ConflictException('Una orden concluida no puede modificarse');
    }
    if (dto.status === WorkOrderStatus.CONCLUIDO) {
      throw new BadRequestException(
        'Para concluir la orden usa PATCH /api/service/work-orders/:id/close',
      );
    }
    if (dto.mechanicId !== undefined) {
      this.resolveMechanicId(dto.mechanicId, user);
      await this.ensureMechanic(dto.mechanicId);
    }

    const startsNow = dto.status === WorkOrderStatus.EN_PROCESO && !order.startedAt;

    return this.prisma.workOrder.update({
      where: { id },
      data: { ...dto, startedAt: startsNow ? new Date() : undefined },
      include: WORK_ORDER_INCLUDE,
    });
  }

  /**
   * RF-INV-13: agrega un repuesto consumido y descuenta `Part.quantity` en la
   * misma transacción. Si la pieza ya está en la orden, suma la cantidad.
   * Stock insuficiente → 409 y no se registra nada.
   */
  async addUsedPart(id: number, dto: AddUsedPartDto, user: AuthenticatedUser) {
    await this.findOne(id, user); // alcance del usuario: orden ajena → 404

    return this.prisma.$transaction(async (tx) => {
      // Bloquea la orden para que no se concluya mientras se agrega el repuesto.
      await tx.$queryRaw`SELECT id FROM work_orders WHERE id = ${id} FOR UPDATE`;
      const order = await tx.workOrder.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      if (order.status === WorkOrderStatus.CONCLUIDO) {
        throw new ConflictException('No se pueden agregar repuestos a una orden concluida');
      }

      await this.consumePart(tx, id, dto.partId, dto.quantity);

      return tx.workOrder.findUniqueOrThrow({ where: { id }, include: WORK_ORDER_INCLUDE });
    });
  }

  /** Una orden no concluida devuelve al inventario los repuestos que descontó. */
  async remove(id: number, user: AuthenticatedUser) {
    const order = await this.findOne(id, user);
    if (order.status === WorkOrderStatus.CONCLUIDO) {
      throw new ConflictException('No se puede eliminar una orden concluida');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const item of order.parts) {
          await tx.part.update({
            where: { id: item.partId },
            data: { quantity: { increment: item.quantity } },
          });
        }
        // Los UsedPart se eliminan en cascada.
        await tx.workOrder.delete({ where: { id } });
      });
    } catch (error) {
      if (isPrismaError(error, 'P2003')) {
        throw new ConflictException('La orden tiene una factura asociada');
      }
      throw error;
    }
  }

  /**
   * El GERENTE asigna a cualquier mecánico. Un MECANICO solo puede asignarse a
   * sí mismo y, si crea una orden sin indicar mecánico, queda asignado (si no,
   * no podría verla).
   */
  private resolveMechanicId(requested: number | undefined, user: AuthenticatedUser): number | undefined {
    if (user.role !== Role.MECANICO) return requested;
    if (requested !== undefined && requested !== user.id) {
      throw new ForbiddenException('Un mecánico solo puede asignarse órdenes a sí mismo');
    }
    return user.id;
  }

  /**
   * Descuenta stock y registra el UsedPart. DEBE ejecutarse dentro de una
   * transacción. El `updateMany` condicionado a `quantity >= cantidad` es
   * atómico: dos consumos simultáneos nunca dejan el stock negativo.
   */
  private async consumePart(
    tx: Prisma.TransactionClient,
    workOrderId: number,
    partId: number,
    quantity: number,
  ) {
    const updated = await tx.part.updateMany({
      where: { id: partId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (updated.count === 0) {
      const part = await tx.part.findUnique({
        where: { id: partId },
        select: { name: true, quantity: true },
      });
      if (!part) throw new NotFoundException(`Repuesto con id ${partId} no encontrado`);
      throw new ConflictException(
        `Stock insuficiente para "${part.name}": disponible ${part.quantity}, solicitado ${quantity}`,
      );
    }

    await tx.usedPart.upsert({
      where: { workOrderId_partId: { workOrderId, partId } },
      create: { workOrderId, partId, quantity },
      update: { quantity: { increment: quantity } },
    });
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
