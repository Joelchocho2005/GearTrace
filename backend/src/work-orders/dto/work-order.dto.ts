import { Type } from 'class-transformer';
import { WorkOrderStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class WorkOrderPartDto {
  @IsInt()
  @Min(1)
  partId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

/**
 * RF-INV-13: repuesto consumido que se agrega a una orden y descuenta stock.
 * `locate` (por defecto true) enciende el LED de su caja (pick-to-light).
 */
export class AddUsedPartDto extends WorkOrderPartDto {
  @IsOptional()
  @IsBoolean()
  locate?: boolean;
}

/**
 * Cita → OT (GERENTE). Vehículo y motivo salen de la cita; `description`
 * permite reemplazar el motivo.
 */
export class CreateWorkOrderFromAppointmentDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  mechanicId?: number;
}

/**
 * Registrar orden de trabajo (GERENTE). El código `number` (OT-YYYY-NNN) lo
 * genera el servidor (RF-SER-05). Los repuestos se registran después de que
 * el cliente apruebe el presupuesto (POST /:id/parts).
 */
export class CreateWorkOrderDto {
  /** Motivo de ingreso / trabajo solicitado */
  @IsString()
  @MinLength(3)
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
}

/**
 * Edición general de la orden abierta. `status` solo acepta las transiciones
 * manuales (EN_PROCESO ⇄ ESPERA_REPUESTOS); el resto tiene endpoint propio.
 * Reasignar mecánico: PATCH /:id/assign.
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
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;
}

export class UpdateWorkOrderStatusDto {
  @IsEnum(WorkOrderStatus)
  status: WorkOrderStatus;
}

export class DiagnoseWorkOrderDto {
  @IsString()
  @MinLength(3)
  diagnosis: string;
}

/** Asignar mecánico (GERENTE). */
export class AssignMechanicDto {
  @IsInt()
  @Min(1)
  mechanicId: number;
}

/**
 * Envía el presupuesto al cliente: EN_DIAGNOSTICO → ESPERA_APROBACION.
 * Requiere diagnóstico (en el body o ya registrado) y costo estimado.
 */
export class SendQuoteDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  diagnosis?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost: number;
}

/** Rechazo del presupuesto o cancelación de la orden. */
export class ReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;
}

export class OptionalReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

/** Registrar actividad de servicio (horas × tarifa vigente = mano de obra). */
export class CreateServiceActivityDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(24)
  hours: number;

  @IsOptional()
  @IsDateString()
  performedAt?: string;
}

/** Filtros de GET /api/work-orders. */
export class WorkOrderQueryDto {
  /** `true`: solo órdenes abiertas sin mecánico asignado (cola del GERENTE). */
  @IsOptional()
  @IsIn(['true', 'false'])
  unassigned?: 'true' | 'false';
}
