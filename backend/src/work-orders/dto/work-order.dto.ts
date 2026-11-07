import { Type } from 'class-transformer';
import { WorkOrderStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
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

export class CreateWorkOrderDto {
  @IsString()
  @MaxLength(30)
  number: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost?: number;

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
 * Edición general de la orden. El cierre (CERRADA) no se permite aquí porque
 * descuenta inventario: usar PATCH /api/service/work-orders/:id/close.
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
  @Min(1)
  mechanicId?: number;

  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;
}
