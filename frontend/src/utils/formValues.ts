import { UserInputError } from '../api/errors';
import type { FormValues, SelectOption } from '../components/ui/ResourceFormModal';

/** Texto recortado; '' si no hay valor. */
export function text(values: FormValues, name: string): string {
  const value = values[name];
  return typeof value === 'string' ? value.trim() : '';
}

/** Texto opcional: `undefined` si está vacío (no se envía al backend). */
export function optionalText(values: FormValues, name: string): string | undefined {
  return text(values, name) || undefined;
}

/** Número opcional: `undefined` si está vacío. Lanza si no es un número válido. */
export function optionalNumber(values: FormValues, name: string, label: string): number | undefined {
  const raw = text(values, name);
  if (raw === '') return undefined;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) throw new UserInputError(`"${label}" debe ser un número.`);
  return parsed;
}

/** Número obligatorio. Lanza si falta o no es válido. */
export function requiredNumber(values: FormValues, name: string, label: string): number {
  const parsed = optionalNumber(values, name, label);
  if (parsed === undefined) throw new UserInputError(`Completa el campo "${label}".`);
  return parsed;
}

/** ISO → valor de <input type="datetime-local"> en hora local. */
export function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (hora local) → ISO UTC. */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

/** Valor para un select a partir de un id numérico opcional. */
export function idValue(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Convierte una lista a opciones de select. */
export function toOptions<T>(items: T[], value: (item: T) => number, label: (item: T) => string): SelectOption[] {
  return items.map((item) => ({ value: String(value(item)), label: label(item) }));
}
