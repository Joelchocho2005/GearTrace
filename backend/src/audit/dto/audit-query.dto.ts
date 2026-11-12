import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AuditQueryDto {
  /** Filtra por entidad (p. ej. WorkOrder, Invoice, Part). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entity?: string;
}
