import type { ISODate } from './model';

/**
 * South Africa Standard Time is UTC+2 all year (no daylight saving since 1944), so a fixed
 * offset is exact and avoids depending on the device's time-zone database (which differs
 * between Hermes builds and browsers).
 */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** The calendar date in South Africa at the given instant. */
export function saLocalDate(instant: Date = new Date()): ISODate {
  return new Date(instant.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Inclusive range check on ISO dates (lexicographic comparison is valid for YYYY-MM-DD). */
export function isWithin(date: ISODate, from: ISODate, to: ISODate | null): boolean {
  return from <= date && (to === null || date <= to);
}

export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Do two inclusive ranges overlap? A null end means open-ended. */
export function rangesOverlap(aFrom: ISODate, aTo: ISODate | null, bFrom: ISODate, bTo: ISODate | null): boolean {
  const aEndsBeforeB = aTo !== null && aTo < bFrom;
  const bEndsBeforeA = bTo !== null && bTo < aFrom;
  return !aEndsBeforeB && !bEndsBeforeA;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "1 March 2026" — locale-independent long date used throughout the UI. */
export function formatLongDate(date: ISODate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "1 Mar 2026". */
export function formatShortDate(date: ISODate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
}
