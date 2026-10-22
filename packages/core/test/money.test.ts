import { describe, expect, it } from 'vitest';

import { MoneyError, applyBps, formatZAR, fromNumberRand, parseRandToCents, spokenZAR, sumCents } from '../src';

describe('parseRandToCents', () => {
  it.each([
    ['R54.50', 5450],
    ['R 54.50', 5450],
    ['54,50', 5450],
    ['54.5', 5450],
    ['7.50', 750],
    ['R1 234.50', 123450],
    ['R1,234.50', 123450],
    ['1.234,50', 123450],
    ['1234', 123400],
    ['0.10', 10],
    ['R 16.500', 1650],
  ])('%s → %i cents', (input, cents) => {
    expect(parseRandToCents(input)).toBe(cents);
  });

  it.each(['', 'R', '-5.00', '5.555', 'abc', '5.5.5', '1.234.567'])('rejects %j', (input) => {
    expect(() => parseRandToCents(input)).toThrow(MoneyError);
  });
});

describe('fromNumberRand', () => {
  it('converts exact values', () => {
    expect(fromNumberRand(54.5)).toBe(5450);
    expect(fromNumberRand(0.1)).toBe(10);
    expect(fromNumberRand(16.55)).toBe(1655);
  });
  it('rejects sub-cent or negative values', () => {
    expect(() => fromNumberRand(1.005)).toThrow(MoneyError);
    expect(() => fromNumberRand(-1)).toThrow(MoneyError);
    expect(() => fromNumberRand(Number.NaN)).toThrow(MoneyError);
  });
});

describe('sumCents', () => {
  it('adds without floating-point drift', () => {
    // 0.1 + 0.2 !== 0.3 in floating point; in cents it is exact.
    expect(sumCents([10, 20])).toBe(30);
    expect(sumCents([3333, 3333, 3333])).toBe(9999);
    expect(sumCents(Array.from({ length: 1000 }, () => 10))).toBe(10000);
  });
  it('rejects fractional cents', () => {
    expect(() => sumCents([10.5])).toThrow(MoneyError);
  });
});

describe('applyBps (integer half-up rounding)', () => {
  it('applies 3.12%', () => {
    expect(applyBps(8900, 312)).toBe(9178); // 89.00 × 1.0312 = 91.7768 → 91.78
    expect(applyBps(29900, 312)).toBe(30833); // 299 × 1.0312 = 308.3288
  });
  it('rounds half up', () => {
    expect(applyBps(50, 100)).toBe(51); // 0.505 → 0.51
    expect(applyBps(49, 100)).toBe(49); // 0.4949 → 0.49
  });
  it('handles negative adjustments', () => {
    expect(applyBps(10000, -500)).toBe(9500);
  });
});

describe('formatZAR', () => {
  it.each([
    [5450, 'R54.50'],
    [750, 'R7.50'],
    [0, 'R0.00'],
    [123450, 'R1 234.50'],
    [100000000, 'R1 000 000.00'],
  ])('%i → %s', (cents, text) => {
    expect(formatZAR(cents)).toBe(text);
  });
  it('can omit zero cents', () => {
    expect(formatZAR(6700, { omitZeroCents: true })).toBe('R67');
    expect(formatZAR(6750, { omitZeroCents: true })).toBe('R67.50');
  });
  it('spoken form', () => {
    expect(spokenZAR(5450)).toBe('54 rand 50 cents');
    expect(spokenZAR(6700)).toBe('67 rand');
  });
});
