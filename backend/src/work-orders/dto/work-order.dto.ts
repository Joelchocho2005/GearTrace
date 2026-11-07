import { Type } from 'class-transformer';
import { WorkOrderStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkOrderPartDto {
  @IsInt()
  @Min(1)
  partId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

/** RF-INV-13: repuesto consumido que se agrega a una orden y descuenta stock. */
export class AddUsedPartDto extends WorkOrderPartDto {}

/**
 * El código `number` (OT-YYYY-NNN) lo genera el servidor (RF-SER-05); si el
 * cliente lo envía, la validación global lo rechaza (forbidNonWhitelisted).
 */
export class CreateWorkOrderDto {
  /** Motivo de ingreso / trabajo solicitado */
  @IsString()
  description: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost?: number;

  /** Kilometraje del vehículo al ingresar */
  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  @IsInt()
  @Min(1)
  vehicleId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  mechanicId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkOrderPartDto)
  parts?: WorkOrderPartDto[];
}

/**
 * Edición general de la orden. El cierre (CONCLUIDO) no se permite aquí: usar
 * PATCH /api/service/work-orders/:id/close (registra finalCost y completedAt).
 * Los repuestos se agregan con POST /api/work-orders/:id/parts.
 */
export class UpdateWorkOrderDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  mechanicId?: number;

  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;
}
