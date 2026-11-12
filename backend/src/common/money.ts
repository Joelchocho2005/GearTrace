import { Prisma } from '@prisma/client';

/** Redondeo monetario a 2 decimales (half-up), igual que las columnas Decimal(10,2). */
export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export const ZERO = new Prisma.Decimal(0);

/** Suma una lista de Decimal. */
export function sumMoney(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.plus(value), ZERO);
}
