import { ConflictException } from '@nestjs/common';
import { AppointmentStatus, Prisma, WorkshopSettings } from '@prisma/client';

/** Citas que ocupan cupo en la agenda. */
const ACTIVE_STATUSES: AppointmentStatus[] = [AppointmentStatus.AGENDADA, AppointmentStatus.CONFIRMADA];

/**
 * Capacidad del taller: un bloque de `appointmentSlotMinutes` admite como
 * máximo `appointmentsPerSlot` citas activas. Se usa al solicitar, programar
 * y reprogramar (GERENTE y CLIENTE). `excludeId`: la cita que se reprograma.
 */
export async function assertSlotAvailable(
  db: Prisma.TransactionClient,
  settings: Pick<WorkshopSettings, 'appointmentSlotMinutes' | 'appointmentsPerSlot'>,
  scheduledAt: Date,
  excludeId?: number,
): Promise<void> {
  const slotMs = settings.appointmentSlotMinutes * 60_000;
  const slotStart = new Date(Math.floor(scheduledAt.getTime() / slotMs) * slotMs);
  const slotEnd = new Date(slotStart.getTime() + slotMs);
  const taken = await db.appointment.count({
    where: {
      scheduledAt: { gte: slotStart, lt: slotEnd },
      status: { in: ACTIVE_STATUSES },
      id: excludeId === undefined ? undefined : { not: excludeId },
    },
  });
  if (taken >= settings.appointmentsPerSlot) {
    throw new ConflictException(
      'No hay cupo en ese horario: el taller ya tiene la agenda llena para ese bloque. Elige otra hora.',
    );
  }
}

/**
 * Serializa reservas concurrentes del mismo bloque (dos clientes a la vez)
 * hasta el fin de la transacción.
 */
export async function lockAgenda(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('geartrace:agenda'))`;
}
