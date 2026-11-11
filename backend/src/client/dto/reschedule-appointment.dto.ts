import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/** PATCH /api/client/appointments/:id — el cliente reprograma su cita. */
export class RescheduleAppointmentDto {
  /** Fecha y hora ISO 8601; debe ser futura. */
  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
