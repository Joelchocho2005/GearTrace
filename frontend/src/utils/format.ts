const CURRENCY = 'USD';

const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('es', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const currencyFormatter = new Intl.NumberFormat('es', {
  style: 'currency',
  currency: CURRENCY,
});

export const EMPTY = '—';

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormatter.format(new Date(value)) : EMPTY;
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormatter.format(new Date(value)) : EMPTY;
}

/** Los Decimal de Prisma llegan como string. */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  return currencyFormatter.format(Number(value));
}
