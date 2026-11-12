import { PartialType } from '@nestjs/mapped-types';
import { IsEmail, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MaxLength(150)
  name: string;

  /** Identificador fiscal (RUC/NIT); único si se informa */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

/** Ítem del catálogo del proveedor (alta o actualización por pieza). */
export class UpsertSupplierPartDto {
  @IsInt()
  @Min(1)
  partId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  supplierCode?: string;

  /** Plazo de entrega habitual en días. */
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;
}
