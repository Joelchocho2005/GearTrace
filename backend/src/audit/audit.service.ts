import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { USER_SUMMARY } from '../common/selects';
import { PrismaService } from '../prisma/prisma.service';

/** Entrada de auditoría: quién hizo qué sobre qué registro. */
export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: number;
  userId?: number;
  detail?: Prisma.InputJsonValue;
}

const AUDIT_PAGE_SIZE = 200;

/**
 * Registro de auditoría transversal. `record` acepta el cliente de la
 * transacción en curso para que la auditoría se confirme o revierta junto con
 * el cambio que describe.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, db: Prisma.TransactionClient = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        userId: entry.userId,
        detail: entry.detail,
      },
    });
  }

  findRecent(entity?: string) {
    return this.prisma.auditLog.findMany({
      where: entity ? { entity } : undefined,
      include: { user: USER_SUMMARY },
      orderBy: { createdAt: 'desc' },
      take: AUDIT_PAGE_SIZE,
    });
  }
}
