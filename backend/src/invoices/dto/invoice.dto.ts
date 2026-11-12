import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Emitir factura interna. El código FAC-YYYY-NNN, las líneas (mano de obra y
 * repuestos) y el impuesto los calcula el servidor desde la OT; no se aceptan
 * montos en el body.
 */
export class CreateInvoiceDto {
  /** La orden debe estar CONCLUIDO/ENTREGADA y sin factura activa */
  @IsInt()
  @Min(1)
  workOrderId: number;

  /** Por defecto: dueño del vehículo de la orden */
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

/** Solo notas: los montos salen de la OT y el estado de los pagos. */
export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

/** Registrar pago (total o parcial). */
export class RegisterPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

/** Anular comprobante. */
export class VoidInvoiceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;
}
