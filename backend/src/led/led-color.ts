/** Orden de bytes con que la tira espera el color empaquetado. */
export type LedColorOrder = 'rgb' | 'grb';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Empaqueta un color CSS (#RRGGBB) en un entero de 24 bits según el orden de la tira. */
export function packColor(hex: string, order: LedColorOrder): number {
  if (!isHexColor(hex)) {
    throw new Error(`Color hexadecimal inválido: ${hex}`);
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [first, second] = order === 'grb' ? [g, r] : [r, g];
  return (first << 16) | (second << 8) | b;
}
