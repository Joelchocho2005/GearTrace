import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class MovementsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partId?: number;
}
