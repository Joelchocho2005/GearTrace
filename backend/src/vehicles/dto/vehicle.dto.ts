import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
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
  @IsString()
  @MaxLength(17)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  /** Cliente propietario del vehículo */
  @IsInt()
  @Min(1)
  ownerId: number;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
