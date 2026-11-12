import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Parámetros del taller (solo GERENTE). */
export class UpdateSettingsDto {
  /** Tarifa de mano de obra por hora; se congela en cada ServiceActivity. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  laborRatePerHour?: number;

  /** Tasa de impuesto como fracción (0.15 = 15 %); se congela en cada factura. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  taxRate?: number;

  /** Duración de un bloque de agenda en minutos. */
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  appointmentSlotMinutes?: number;

  /** Citas simultáneas que admite un bloque (capacidad del taller). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  appointmentsPerSlot?: number;
}
