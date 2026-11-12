import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { roundMoney } from '../common/money';
import { DOMAIN_EVENTS, LowStockEvent } from '../events/domain-events';

/**
 * Kardex (RF-INV): ÚNICO punto que modifica `Part.quantity`. Cada cambio
 * registra un StockMovement con el saldo resultante, dentro de la transacción
 * del documento que lo origina (OT, OC, ajuste). Nunca actualizar
 * `Part.quantity` con un `update` suelto.
 */
export interface StockChange {
  partId: number;
  /** Unidades (siempre positivas); el signo lo da la operación. */
  quantity: number;
  type: StockMovementType;
  reason?: string;
  userId?: number;
  workOrderId?: number;
  purchaseOrderId?: number;
}

export interface StockChangeResult {
  partId: number;
  partName: string;
  balanceAfter: number;
  /** Presente si este movimiento dejó la pieza en o bajo su mínimo. */
  lowStock: LowStockEvent | null;
}

const PART_STOCK_SELECT = {
  id: true,
  name: true,
  code: true,
  quantity: true,
  minStock: true,
  costPrice: true,
} satisfies Prisma.PartSelect;

function assertPositive(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ConflictException('La cantidad del movimiento debe ser un entero positivo');
  }
}

async function recordMovement(
  tx: Prisma.TransactionClient,
  change: StockChange,
  signedQuantity: number,
  balanceAfter: number,
) {
  await tx.stockMovement.create({
    data: {
      type: change.type,
      quantity: signedQuantity,
      balanceAfter,
      reason: change.reason,
      partId: change.partId,
      userId: change.userId,
      workOrderId: change.workOrderId,
      purchaseOrderId: change.purchaseOrderId,
    },
  });
}

/**
 * Descuenta stock. El `updateMany` condicionado a `quantity >= cantidad` es
 * atómico: dos salidas simultáneas nunca dejan el stock negativo.
 * Stock insuficiente → 409 con disponible y solicitado.
 */
export async function decreaseStock(
  tx: Prisma.TransactionClient,
  change: StockChange,
): Promise<StockChangeResult> {
  assertPositive(change.quantity);
  const updated = await tx.part.updateMany({
    where: { id: change.partId, quantity: { gte: change.quantity } },
    data: { quantity: { decrement: change.quantity } },
  });
  const part = await tx.part.findUnique({ where: { id: change.partId }, select: PART_STOCK_SELECT });
  if (!part) throw new NotFoundException(`Repuesto con id ${change.partId} no encontrado`);
  if (updated.count === 0) {
    throw new ConflictException(
      `Stock insuficiente para "${part.name}": disponible ${part.quantity}, solicitado ${change.quantity}`,
    );
  }

  await recordMovement(tx, change, -change.quantity, part.quantity);
  const before = part.quantity + change.quantity;
  const crossedMinimum = before > part.minStock && part.quantity <= part.minStock;
  return {
    partId: part.id,
    partName: part.name,
    balanceAfter: part.quantity,
    lowStock: crossedMinimum
      ? { partId: part.id, partName: part.name, partCode: part.code, quantity: part.quantity, minStock: part.minStock }
      : null,
  };
}

/**
 * Incrementa stock. Con `unitCost` (recepción de compras) recalcula el costo
 * promedio ponderado: (costo previo × stock previo + costo × unidades) / total.
 */
export async function increaseStock(
  tx: Prisma.TransactionClient,
  change: StockChange,
  unitCost?: Prisma.Decimal | null,
): Promise<StockChangeResult> {
  assertPositive(change.quantity);
  const before = await tx.part.findUnique({ where: { id: change.partId }, select: PART_STOCK_SELECT });
  if (!before) throw new NotFoundException(`Repuesto con id ${change.partId} no encontrado`);

  const costPrice = unitCost ? weightedCost(before.costPrice, before.quantity, unitCost, change.quantity) : undefined;
  const part = await tx.part.update({
    where: { id: change.partId },
    data: { quantity: { increment: change.quantity }, costPrice },
    select: PART_STOCK_SELECT,
  });

  await recordMovement(tx, change, change.quantity, part.quantity);
  return { partId: part.id, partName: part.name, balanceAfter: part.quantity, lowStock: null };
}

function weightedCost(
  currentCost: Prisma.Decimal | null,
  currentQuantity: number,
  unitCost: Prisma.Decimal,
  receivedQuantity: number,
): Prisma.Decimal {
  if (!currentCost || currentQuantity <= 0) return roundMoney(unitCost);
  const total = currentCost.times(currentQuantity).plus(unitCost.times(receivedQuantity));
  return roundMoney(total.dividedBy(currentQuantity + receivedQuantity));
}

/** Publica las alertas de stock bajo DESPUÉS de confirmar la transacción. */
export function emitLowStockAlerts(events: EventEmitter2, results: StockChangeResult[]): void {
  for (const result of results) {
    if (result.lowStock) events.emit(DOMAIN_EVENTS.LOW_STOCK, result.lowStock);
  }
}
