import { Prisma } from '@prisma/client';

/** Datos públicos mínimos de un usuario en relaciones (nunca `password`). */
export const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

/** Relación con usuario lista para `include` (`owner`, `mechanic`, `client`). */
export const USER_SUMMARY = { select: USER_SUMMARY_SELECT } as const;

/** OT generada a partir de una cita (`Appointment.workOrder`). */
export const WORK_ORDER_SUMMARY = {
  select: { id: true, number: true, status: true },
} as const;
