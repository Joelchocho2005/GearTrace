import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationInput {
  title: string;
  message: string;
  /** Ruta del frontend relacionada (p. ej. /reposicion). */
  link?: string;
}

const NOTIFICATIONS_PAGE_SIZE = 50;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bandeja del usuario autenticado (más recientes primero) y no leídas. */
  async findMine(userId: number) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: NOTIFICATIONS_PAGE_SIZE,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(id: number, userId: number) {
    const updated = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await this.prisma.notification.count({ where: { id, userId } });
      if (exists === 0) throw new NotFoundException(`Notificación con id ${id} no encontrada`);
    }
  }

  async markAllRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async notifyUsers(userIds: number[], input: NotificationInput): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    await this.prisma.notification.createMany({
      data: unique.map((userId) => ({ userId, ...input })),
    });
  }

  /** Notifica a todos los usuarios activos de los roles indicados. */
  async notifyRoles(roles: Role[], input: NotificationInput): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { id: true },
    });
    await this.notifyUsers(
      users.map((user) => user.id),
      input,
    );
  }

  /** Usuarios PROVEEDOR vinculados a un proveedor. */
  async notifySupplier(supplierId: number, input: NotificationInput): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { supplierId, role: Role.PROVEEDOR, isActive: true },
      select: { id: true },
    });
    await this.notifyUsers(
      users.map((user) => user.id),
      input,
    );
  }
}
