import { IsIn, IsInt, IsString, MaxLength, MinLength, NotEquals } from 'class-validator';

/** Tipos de movimiento manual; el resto los generan OT y compras. */
export const MANUAL_STOCK_MOVEMENTS = ['AJUSTE', 'DEVOLUCION_PROVEEDOR'] as const;
export type ManualStockMovement = (typeof MANUAL_STOCK_MOVEMENTS)[number];

/**
 * Actualizar stock de artículo (Gerente, Bodeguero). `delta` con signo:
 * AJUSTE admite + o −; DEVOLUCION_PROVEEDOR solo − (sale del almacén).
 */
export class AdjustStockDto {
  @IsIn(MANUAL_STOCK_MOVEMENTS, { message: 'type debe ser AJUSTE o DEVOLUCION_PROVEEDOR' })
  type: ManualStockMovement;

  @IsInt()
  @NotEquals(0, { message: 'delta no puede ser 0' })
  delta: number;

  /** Motivo obligatorio (conteo físico, merma, devolución por garantía…). */
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;
}
