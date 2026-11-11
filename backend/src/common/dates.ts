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
