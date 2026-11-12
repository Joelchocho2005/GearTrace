import { BadRequestException } from '@nestjs/common';

/** Convierte un ISO a `Date` y exige que sea posterior al momento actual. */
export function toFutureDate(
  value: string,
  message = 'La cita debe agendarse para una fecha futura',
): Date {
  const date = new Date(value);
  if (date <= new Date()) throw new BadRequestException(message);
  return date;
}

/** Zona horaria del negocio (BUSINESS_TIMEZONE); por defecto la del taller. */
export const DEFAULT_BUSINESS_TIMEZONE = 'America/Guayaquil';

function businessTimeZone(): string {
  return process.env.BUSINESS_TIMEZONE?.trim() || DEFAULT_BUSINESS_TIMEZONE;
}

/**
 * Año calendario de `date` en la zona horaria del negocio. Evita que una OT
 * creada el 31/12 a las 23:30 hora local reciba el año siguiente cuando el
 * servidor (Raspberry Pi) corre en UTC.
 */
export function businessYear(date: Date = new Date()): number {
  const year = new Intl.DateTimeFormat('en-US', { timeZone: businessTimeZone(), year: 'numeric' }).format(date);
  return Number(year);
}
