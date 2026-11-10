import { IsEmail, IsInt, IsString, MinLength, MaxLength, IsEnum, IsOptional, Min } from 'class-validator';
import { Role } from '@prisma/client';

export class LoginDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}

export class RegisterDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72) // bcrypt tiene límite de 72 bytes
  password: string;

  @IsOptional()
  @IsEnum(Role, { message: 'El rol debe ser GERENTE, MECANICO, BODEGUERO, CONTADOR, CLIENTE o PROVEEDOR' })
  role?: Role;

  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;
}
