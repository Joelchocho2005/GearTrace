import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const toUpperTrimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateVehicleDto {
  /** Se normaliza a mayúsculas sin espacios externos ("abc-123 " → "ABC-123"). */
  @Transform(toUpperTrimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  plate: string;

  @IsString()
  @MaxLength(80)
  make: string;

  @IsString()
  @MaxLength(80)
  model: string;

  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Transform(toUpperTrimmed)
  @IsString()
  @MaxLength(17)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  /** Cliente propietario del vehículo (rol CLIENTE, activo) */
  @IsInt()
  @Min(1)
  ownerId: number;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
