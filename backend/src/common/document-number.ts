import { Prisma } from '@prisma/client';

/**
 * Códigos correlativos por año, formato PREFIJO-YYYY-NNN (NNN crece a 4+ dígitos):
 *  - OT  → work_orders     (RF-SER-05)
 *  - OC  → purchase_orders
 *  - FAC → invoices
 * La tabla sale de este mapa fijo (nunca de la entrada del usuario).
 */
const DOCUMENTS = {
  OT: { table: 'work_orders' },
  OC: { table: 'purchase_orders' },
  FAC: { table: 'invoices' },
} as const;

export type DocumentPrefix = keyof typeof DOCUMENTS;

export function formatDocumentNumber(prefix: DocumentPrefix, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Siguiente código del año. DEBE ejecutarse dentro de la misma transacción que
 * crea el registro: el advisory lock (uno por tipo de documento) serializa
 * creaciones concurrentes y se libera solo al confirmar o revertir.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  prefix: DocumentPrefix,
  date: Date = new Date(),
): Promise<string> {
  const year = date.getFullYear();
  const table = Prisma.raw(`"${DOCUMENTS[prefix].table}"`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`geartrace:document_number:${prefix}`}))`;

  // MAX numérico (no orden de texto): PRE-2026-1000 debe ganar a PRE-2026-999.
  const pattern = `^${prefix}-${year}-[0-9]+$`;
  const [row] = await tx.$queryRaw<Array<{ last: number | null }>>`
    SELECT MAX(CAST(split_part(number, '-', 3) AS INTEGER)) AS last
    FROM ${table}
    WHERE number ~ ${pattern}
  `;

  return formatDocumentNumber(prefix, year, (row?.last ?? 0) + 1);
}
