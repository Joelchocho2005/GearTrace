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
import { Type } from 'class-transformer';

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
  @IsNumber()
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

export class UpdateWorkOrderStatusDto {
  @IsEnum(WorkOrderStatus)
  status: WorkOrderStatus;
}

export class DiagnoseWorkOrderDto {
  @IsString()
  diagnosis: string;
}

export class CloseWorkOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalCost?: number;
}
