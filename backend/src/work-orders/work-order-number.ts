import { Prisma } from '@prisma/client';
import { formatDocumentNumber, nextDocumentNumber } from '../common/document-number';

/** RF-SER-05: código correlativo OT-YYYY-NNN (ver common/document-number.ts). */
export function formatWorkOrderNumber(year: number, sequence: number): string {
  return formatDocumentNumber('OT', year, sequence);
}

/** DEBE ejecutarse dentro de la transacción que crea la orden. */
export function nextWorkOrderNumber(tx: Prisma.TransactionClient, date?: Date): Promise<string> {
  return nextDocumentNumber(tx, 'OT', date);
}
