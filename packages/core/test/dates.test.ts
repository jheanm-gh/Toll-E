import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, formatLongDate, isISODate, isWithin, rangesOverlap, saLocalDate } from '../src';

describe('saLocalDate', () => {
  it('uses South African time (UTC+2), not UTC', () => {
    // 22:30 UTC on 28 Feb is already 1 March in South Africa — the day new tariffs start.
    expect(saLocalDate(new Date('2026-02-28T22:30:00Z'))).toBe('2026-03-01');
    expect(saLocalDate(new Date('2026-02-28T21:59:59Z'))).toBe('2026-02-28');
  });
});

describe('isISODate', () => {
  it('accepts real dates only', () => {
    expect(isISODate('2026-03-01')).toBe(true);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('26-03-01')).toBe(false);
    expect(isISODate(20260301)).toBe(false);
  });
});

describe('ranges', () => {
  it('isWithin is inclusive at both ends', () => {
    expect(isWithin('2026-03-01', '2026-03-01', '2027-02-28')).toBe(true);
    expect(isWithin('2027-02-28', '2026-03-01', '2027-02-28')).toBe(true);
    expect(isWithin('2027-03-01', '2026-03-01', '2027-02-28')).toBe(false);
    expect(isWithin('2099-01-01', '2026-03-01', null)).toBe(true);
  });
  it('rangesOverlap', () => {
    expect(rangesOverlap('2025-03-01', '2026-02-28', '2026-03-01', null)).toBe(false);
    expect(rangesOverlap('2025-03-01', '2026-03-01', '2026-03-01', null)).toBe(true);
    expect(rangesOverlap('2025-03-01', null, '2026-03-01', null)).toBe(true);
  });
  it('day arithmetic', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(daysBetween('2026-03-01', '2027-03-01')).toBe(365);
    expect(formatLongDate('2026-03-01')).toBe('1 March 2026');
  });
});
