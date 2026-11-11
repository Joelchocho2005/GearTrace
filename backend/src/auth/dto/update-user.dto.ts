import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { ROLE_VALIDATION_MESSAGE } from '../../common/validation-messages';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password?: string;

  @IsOptional()
  @IsEnum(Role, { message: ROLE_VALIDATION_MESSAGE })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;
}
