import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { startedAtOnTransition, USE_CLOSE_ENDPOINT } from '../work-orders/work-order-rules';
import { workOrderScope } from '../work-orders/work-order-scope';

const WORK_ORDER_INCLUDE = { vehicle: true, parts: { include: { part: true } } } as const;

/**
 * Transiciones operativas de órdenes (estado, diagnóstico y cierre). El stock
 * se descuenta al agregar repuestos (WorkOrdersService, RF-INV-13). El CRUD de vehículos y la creación/listado de órdenes
 * viven en VehiclesService y WorkOrdersService; ServiceController delega en ellos.
 * Un MECANICO solo puede operar órdenes asignadas a él (workOrderScope).
 */
@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async updateWorkOrderStatus(id: number, status: WorkOrderStatus, user: AuthenticatedUser) {
    const order = await this.findWorkOrder(id, user);
    if (order.status === WorkOrderStatus.CONCLUIDO) {
      throw new ConflictException('Una orden concluida no puede cambiar de estado');
    }
    if (status === WorkOrderStatus.CONCLUIDO) {
      throw new BadRequestException(USE_CLOSE_ENDPOINT);
    }
    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status,
        startedAt: startedAtOnTransition(status, order.startedAt),
      },
      include: WORK_ORDER_INCLUDE,
    });
  }

  async diagnoseWorkOrder(id: number, diagnosis: string, user: AuthenticatedUser) {
    const order = await this.findWorkOrder(id, user);
    if (order.status === WorkOrderStatus.CONCLUIDO) {
      throw new ConflictException('Una orden concluida no puede modificarse');
    }
    return this.prisma.workOrder.update({
      where: { id },
      data: { diagnosis, status: WorkOrderStatus.EN_DIAGNOSTICO },
      include: WORK_ORDER_INCLUDE,
    });
  }

  /**
   * Concluye la orden (finalCost + completedAt). No toca inventario: por
   * RF-INV-13 cada UsedPart ya descontó stock al agregarse a la orden.
   */
  async closeWorkOrder(id: number, finalCost: number | undefined, user: AuthenticatedUser) {
    const order = await this.findWorkOrder(id, user);
    if (order.status === WorkOrderStatus.CONCLUIDO) {
      throw new ConflictException('La orden de trabajo ya está concluida');
    }
    // Condición en el WHERE: si otra petición la concluyó entre medio, no se repite.
    const updated = await this.prisma.workOrder.updateMany({
      where: { id, status: { not: WorkOrderStatus.CONCLUIDO } },
      data: { status: WorkOrderStatus.CONCLUIDO, finalCost, completedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new ConflictException('La orden de trabajo ya está concluida');
    }
    return this.prisma.workOrder.findUniqueOrThrow({ where: { id }, include: WORK_ORDER_INCLUDE });
  }

  /** Fuera del alcance del usuario responde 404 (no revela que existe). */
  private async findWorkOrder(id: number, user: AuthenticatedUser) {
    const order = await this.prisma.workOrder.findFirst({
      where: { id, ...workOrderScope(user) },
    });
    if (!order) throw new NotFoundException(`Orden de trabajo con id ${id} no encontrada`);
    return order;
  }
}
