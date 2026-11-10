import { PartialType } from '@nestjs/mapped-types';
import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72) // límite de bcrypt
  password: string;

  @IsOptional()
  @IsEnum(Role, { message: 'El rol debe ser GERENTE, MECANICO, BODEGUERO, CONTADOR, CLIENTE o PROVEEDOR' })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

/** GET /api/users/lookup?role=CLIENTE → selectores de formularios. */
export class UserLookupQueryDto {
  @IsEnum(Role, { message: 'El rol debe ser GERENTE, MECANICO, BODEGUERO, CONTADOR, CLIENTE o PROVEEDOR' })
  role: Role;
}
