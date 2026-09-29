import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateBoxDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsInt()
  @Min(0)
  @Max(4)
  ledIndex: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'colorHex debe ser un color hexadecimal válido (ej: #FF6600)',
  })
  colorHex?: string;
}
