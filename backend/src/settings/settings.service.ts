import { Injectable } from '@nestjs/common';
import { Prisma, WorkshopSettings } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/** La tabla workshop_settings tiene una sola fila. */
const SETTINGS_ID = 1;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lee los parámetros (crea la fila con valores por defecto si falta). */
  get(db: Prisma.TransactionClient = this.prisma): Promise<WorkshopSettings> {
    return db.workshopSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    });
  }

  async update(dto: UpdateSettingsDto, userId: number): Promise<WorkshopSettings> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.get(tx);
      const updated = await tx.workshopSettings.update({ where: { id: SETTINGS_ID }, data: dto });
      await this.audit.record(
        {
          action: 'SETTINGS_UPDATED',
          entity: 'WorkshopSettings',
          entityId: SETTINGS_ID,
          userId,
          detail: {
            before: {
              laborRatePerHour: before.laborRatePerHour.toString(),
              taxRate: before.taxRate.toString(),
              appointmentSlotMinutes: before.appointmentSlotMinutes,
              appointmentsPerSlot: before.appointmentsPerSlot,
            },
            changes: { ...dto },
          },
        },
        tx,
      );
      return updated;
    });
  }
}
