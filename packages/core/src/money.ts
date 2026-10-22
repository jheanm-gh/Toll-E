/**
 * Money helpers. All amounts are integer cents; nothing here uses floating-point arithmetic
 * on monetary values except `fromNumberRand`, which rejects inputs that are not exact cents.
 */

export class MoneyError extends Error {
  override name = 'MoneyError';
}

export function assertCents(value: number, label = 'amount'): number {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a whole number of cents, got ${String(value)}`);
  }
  return value;
}

/**
 * Parse a rand amount written by a person or found in a document.
 * Accepts "R54.50", "R 54,50", "54.5", "1 234.50", "R1,234.50", "1234".
 * Rejects negative numbers, more than two decimals and anything ambiguous.
 */
export function parseRandToCents(input: string): number {
  const original = input;
  let s = input
    .trim()
    .replace(/^R\s*/i, '')
    .replace(/[\s  ]/g, '');
  if (s === '') throw new MoneyError(`empty amount: "${original}"`);
  if (s.startsWith('-')) throw new MoneyError(`negative amount: "${original}"`);

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimalSep: '.' | ',' | null = null;
  if (lastDot >= 0 && lastComma >= 0) {
    decimalSep = lastDot > lastComma ? '.' : ',';
  } else if (lastDot >= 0) {
    decimalSep = '.';
  } else if (lastComma >= 0) {
    // A lone comma is a decimal separator only when followed by 1–2 digits ("54,50").
    const after = s.length - lastComma - 1;
    decimalSep = after > 0 && after <= 2 && s.indexOf(',') === lastComma ? ',' : null;
  }

  let whole = s;
  let fraction = '';
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    whole = s.slice(0, idx);
    fraction = s.slice(idx + 1);
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    whole = whole.split(thousandsSep).join('');
  } else {
    whole = whole.split(',').join('');
  }

  if (!/^\d+$/.test(whole) || (fraction !== '' && !/^\d+$/.test(fraction))) {
    throw new MoneyError(`not a valid rand amount: "${original}"`);
  }
  if (fraction.length > 2) {
    if (/^\d{2}0+$/.test(fraction)) fraction = fraction.slice(0, 2);
    else throw new MoneyError(`more than two decimal places: "${original}"`);
  }
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0') || '0');
  return assertCents(cents);
}

/** Convert a rand number (e.g. from a spreadsheet) to cents, rejecting sub-cent values. */
export function fromNumberRand(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new MoneyError(`invalid rand amount ${value}`);
  const cents = Math.round(value * 100);
  if (Math.abs(cents - value * 100) > 1e-6) {
    throw new MoneyError(`rand amount has more than two decimals: ${value}`);
  }
  return assertCents(cents);
}

export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    total += assertCents(v);
    assertCents(total, 'total');
  }
  return total;
}

/**
 * Apply a percentage adjustment expressed in basis points (3.12% = 312 bps),
 * rounding half up to the nearest cent. Integer-only arithmetic.
 */
export function applyBps(cents: number, bps: number): number {
  assertCents(cents);
  if (!Number.isSafeInteger(bps)) throw new MoneyError('bps must be an integer');
  const numerator = cents * (10_000 + bps);
  const q = Math.floor(numerator / 10_000);
  const r = numerator - q * 10_000;
  return r * 2 >= 10_000 ? q + 1 : q;
}

/**
 * Format cents as South African rand, e.g. 5450 → "R54.50", 123450 → "R1 234.50".
 * Uses a period decimal separator (as SANRAL and operators publish tariffs) and a
 * space thousands separator. Deliberately independent of the device locale.
 */
export function formatZAR(cents: number, options: { omitZeroCents?: boolean } = {}): string {
  assertCents(cents);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const rands = Math.floor(abs / 100);
  const c = abs % 100;
  const randsText = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const centsText = options.omitZeroCents && c === 0 ? '' : `.${String(c).padStart(2, '0')}`;
  return `${negative ? '−' : ''}R${randsText}${centsText}`;
}

/** Screen-reader friendly amount, e.g. "54 rand 50 cents". */
export function spokenZAR(cents: number): string {
  assertCents(cents);
  const rands = Math.floor(Math.abs(cents) / 100);
  const c = Math.abs(cents) % 100;
  const parts = [`${rands} rand`];
  if (c) parts.push(`${c} cents`);
  return parts.join(' ');
}
