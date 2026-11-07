import { PartialType } from '@nestjs/mapped-types';
import { AppointmentStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAppointmentDto {
  /** Fecha y hora ISO 8601; debe ser futura */
  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsInt()
  @Min(1)
  vehicleId: number;
}

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
