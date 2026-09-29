import {
  IsString,
  IsInt,
  IsOptional,
  IsUrl,
  IsArray,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreatePartDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z0-9\-]+$/, {
    message: 'El código solo puede contener letras mayúsculas, números y guiones',
  })
  code: string;

  @IsInt()
  @Min(0)
  quantity: number;

  @IsInt()
  @Min(1)
  boxId: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;
}
