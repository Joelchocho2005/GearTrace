import { InvoiceStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

/** El código `number` (FAC-YYYY-NNN) lo genera el servidor; no se acepta en el body. */
export class CreateInvoiceDto {
  /** La orden debe estar CONCLUIDO y no tener factura previa */
  @IsInt()
  @Min(1)
  workOrderId: number;

  /** Por defecto: dueño del vehículo de la orden */
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  /** Por defecto: finalCost, si no estimatedCost, si no la suma de repuestos de la orden */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal?: number;

  /** Monto de impuestos; por defecto 0. total = subtotal + tax */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tax?: number;
}

/** Solo facturas PENDIENTES pueden editarse; total se recalcula. */
export class UpdateInvoiceDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tax?: number;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
