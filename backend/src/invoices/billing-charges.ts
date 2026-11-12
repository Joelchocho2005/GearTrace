import { InvoiceLineType, Prisma } from '@prisma/client';
import { ZERO, roundMoney, sumMoney } from '../common/money';

export interface ChargeLine {
  type: InvoiceLineType;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
}

export interface Charges {
  lines: ChargeLine[];
  laborSubtotal: Prisma.Decimal;
  partsSubtotal: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
}

export interface ChargeableOrder {
  activities: Array<{ description: string; hours: Prisma.Decimal; laborRate: Prisma.Decimal }>;
  parts: Array<{ quantity: number; unitPrice: Prisma.Decimal | null; part: { name: string; code: string } }>;
}

/**
 * Generar cargo por servicio (mano de obra: horas × tarifa congelada) y por
 * repuesto (cantidad × precio congelado en UsedPart). Nunca usa precios
 * actuales de Part. Función pura: la usan la vista previa y la emisión.
 */
export function buildCharges(order: ChargeableOrder, taxRate: Prisma.Decimal): Charges {
  const labor: ChargeLine[] = order.activities.map((activity) => ({
    type: InvoiceLineType.MANO_OBRA,
    description: activity.description,
    quantity: activity.hours,
    unitPrice: activity.laborRate,
    amount: roundMoney(activity.hours.times(activity.laborRate)),
  }));
  const parts: ChargeLine[] = order.parts.map((item) => {
    const unitPrice = item.unitPrice ?? ZERO;
    return {
      type: InvoiceLineType.REPUESTO,
      description: `${item.part.name} (${item.part.code})`,
      quantity: new Prisma.Decimal(item.quantity),
      unitPrice,
      amount: roundMoney(unitPrice.times(item.quantity)),
    };
  });

  const laborSubtotal = sumMoney(labor.map((line) => line.amount));
  const partsSubtotal = sumMoney(parts.map((line) => line.amount));
  const subtotal = laborSubtotal.plus(partsSubtotal);
  const tax = roundMoney(subtotal.times(taxRate));
  return {
    lines: [...labor, ...parts],
    laborSubtotal,
    partsSubtotal,
    subtotal,
    taxRate,
    tax,
    total: subtotal.plus(tax),
  };
}

/** Estado derivado de los pagos: PENDIENTE → PARCIAL → PAGADA. */
export function statusFromPayments(total: Prisma.Decimal, paid: Prisma.Decimal) {
  if (paid.gte(total)) return 'PAGADA' as const;
  if (paid.gt(0)) return 'PARCIAL' as const;
  return 'PENDIENTE' as const;
}
