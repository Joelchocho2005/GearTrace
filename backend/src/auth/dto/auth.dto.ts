import { IsBoolean, IsEmail, IsInt, IsString, MinLength, MaxLength, IsEnum, IsOptional, Min } from 'class-validator';
import { Role } from '@prisma/client';
import { ROLE_VALIDATION_MESSAGE } from '../../common/validation-messages';

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
  @IsEnum(Role, { message: ROLE_VALIDATION_MESSAGE })
  role?: Role;

  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;
}

/** PATCH /api/auth/users/:id/role */
export class ChangeRoleDto {
  @IsEnum(Role, { message: ROLE_VALIDATION_MESSAGE })
  role: Role;
}

/** PATCH /api/auth/users/:id/toggle */
export class ToggleActiveDto {
  @IsBoolean({ message: 'isActive debe ser verdadero o falso' })
  isActive: boolean;
}
