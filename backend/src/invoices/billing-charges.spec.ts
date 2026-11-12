import { Prisma } from '@prisma/client';
import { buildCharges, statusFromPayments } from './billing-charges';

const d = (value: number | string) => new Prisma.Decimal(value);

describe('buildCharges', () => {
  it('separa mano de obra y repuestos con precios congelados y calcula el impuesto', () => {
    const charges = buildCharges(
      {
        activities: [{ description: 'Cambio de aceite', hours: d('1.5'), laborRate: d('20') }],
        parts: [{ quantity: 2, unitPrice: d('12.50'), part: { name: 'Filtro', code: 'FLT-1' } }],
      },
      d('0.15'),
    );

    expect(charges.laborSubtotal.toString()).toBe('30');
    expect(charges.partsSubtotal.toString()).toBe('25');
    expect(charges.subtotal.toString()).toBe('55');
    expect(charges.tax.toString()).toBe('8.25');
    expect(charges.total.toString()).toBe('63.25');
    expect(charges.lines).toHaveLength(2);
  });

  it('redondea cada línea a 2 decimales', () => {
    const charges = buildCharges(
      { activities: [{ description: 'Ajuste', hours: d('0.33'), laborRate: d('17.77') }], parts: [] },
      d('0'),
    );
    expect(charges.subtotal.toString()).toBe('5.86');
  });
});

describe('statusFromPayments', () => {
  it('deriva PENDIENTE, PARCIAL y PAGADA', () => {
    expect(statusFromPayments(d(100), d(0))).toBe('PENDIENTE');
    expect(statusFromPayments(d(100), d(40))).toBe('PARCIAL');
    expect(statusFromPayments(d(100), d(100))).toBe('PAGADA');
  });
});
