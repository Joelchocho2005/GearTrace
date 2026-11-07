import { Prisma } from '@prisma/client';

/** RF-SER-05: código correlativo por año, formato OT-YYYY-NNN (NNN crece a 4+ dígitos si hace falta). */
const PREFIX = 'OT';
const LOCK_KEY = 'geartrace:work_order_number';

export function formatWorkOrderNumber(year: number, sequence: number): string {
  return `${PREFIX}-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Calcula el siguiente código del año. DEBE ejecutarse dentro de la misma
 * transacción que crea la orden: el advisory lock serializa creaciones
 * concurrentes y se libera solo al confirmar o revertir.
 */
export async function nextWorkOrderNumber(
  tx: Prisma.TransactionClient,
  date: Date = new Date(),
): Promise<string> {
  const year = date.getFullYear();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`;

  // MAX numérico (no orden de texto): OT-2026-1000 debe ganar a OT-2026-999.
  const pattern = `^${PREFIX}-${year}-[0-9]+$`;
  const [row] = await tx.$queryRaw<Array<{ last: number | null }>>`
    SELECT MAX(CAST(split_part(number, '-', 3) AS INTEGER)) AS last
    FROM work_orders
    WHERE number ~ ${pattern}
  `;

  return formatWorkOrderNumber(year, (row?.last ?? 0) + 1);
}
