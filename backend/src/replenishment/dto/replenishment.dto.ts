import { ReplenishmentStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/** Solicitar reposición (GERENTE, BODEGUERO, MECANICO). */
export class CreateReplenishmentRequestDto {
  @IsInt()
  @Min(1)
  partId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  /** OT que espera la pieza; permite pedir piezas que no están bajo su mínimo. */
  @IsOptional()
  @IsInt()
  @Min(1)
  workOrderId?: number;
}

export class ApproveReplenishmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class RejectReplenishmentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  note: string;
}

export class ReplenishmentQueryDto {
  @IsOptional()
  @IsEnum(ReplenishmentStatus)
  status?: ReplenishmentStatus;
}
