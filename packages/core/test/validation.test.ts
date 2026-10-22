import { describe, expect, it } from 'vitest';

import { hasErrors, parseAndValidate, validateDataset, type DataIssue, type Journey } from '../src';
import { TODAY, dataset, plaza, tariff } from './fixtures';

const codes = (issues: DataIssue[]) => issues.map((i) => i.code);
const validate = (ds: ReturnType<typeof dataset>) => validateDataset(ds, { today: TODAY });

const fullClasses = (plazaId: string, base: number, extra = {}) =>
  ['class1', 'class2', 'class3', 'class4'].map((c, i) => tariff(plazaId, c, base * (i + 1), extra));

describe('validateDataset — a clean dataset', () => {
  it('has no errors or warnings', () => {
    const ds = dataset({ plazas: [plaza('p-a')], tariffs: fullClasses('p-a', 1000) });
    expect(validate(ds)).toEqual([]);
  });
});

describe('prices', () => {
  it('rejects zero, negative, fractional and absurd prices', () => {
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: [
        tariff('p-a', 'class1', 0),
        tariff('p-a', 'class2', -100, { effectiveFrom: '2030-01-01' }),
        tariff('p-a', 'class3', 10.5),
        tariff('p-a', 'class4', 5_000_000),
      ],
    });
    expect(validate(ds).filter((i) => i.code === 'invalid_price')).toHaveLength(4);
  });

  it('flags implausibly high light-vehicle tariffs for review', () => {
    const ds = dataset({ plazas: [plaza('p-a')], tariffs: fullClasses('p-a', 30_000) });
    expect(codes(validate(ds))).toContain('implausible_price');
  });

  it('flags heavier classes costing less than lighter ones', () => {
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: [
        tariff('p-a', 'class1', 5000),
        tariff('p-a', 'class2', 4000),
        tariff('p-a', 'class3', 6000),
        tariff('p-a', 'class4', 7000),
      ],
    });
    expect(codes(validate(ds))).toContain('class_order_violation');
  });
});

describe('sources', () => {
  it('requires every tariff and plaza to cite a known source', () => {
    const ds = dataset({
      plazas: [plaza('p-a', { sourceIds: [] })],
      tariffs: fullClasses('p-a', 1000, { sourceId: 'missing-source' }),
    });
    const issues = validate(ds);
    expect(issues.filter((i) => i.code === 'missing_source').length).toBeGreaterThanOrEqual(5);
    expect(hasErrors(issues)).toBe(true);
  });

  it('warns when a tariff is marked verified against a non-official source', () => {
    const ds = dataset({ plazas: [plaza('p-a')], tariffs: fullClasses('p-a', 1000, { sourceId: 'src-secondary' }) });
    expect(codes(validate(ds))).toContain('verified_against_secondary_source');
  });

  it('requires a verifier and date for verified tariffs', () => {
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: fullClasses('p-a', 1000, { verifiedBy: null }),
    });
    expect(codes(validate(ds))).toContain('verified_without_verifier');
  });
});

describe('coordinates', () => {
  const loc = (lat: number, lng: number) => ({
    lat,
    lng,
    precision: 'approximate' as const,
    sourceIds: ['src-official'],
  });

  it('rejects positions outside South Africa', () => {
    const ds = dataset({ plazas: [plaza('p-a', { location: loc(51.5, -0.12) })], tariffs: fullClasses('p-a', 1000) });
    expect(codes(validate(ds))).toContain('location_outside_south_africa');
  });

  it('rejects out-of-range coordinates', () => {
    const ds = dataset({ plazas: [plaza('p-a', { location: loc(-123, 400) })], tariffs: fullClasses('p-a', 1000) });
    expect(codes(validate(ds))).toContain('invalid_coordinates');
  });

  it('warns when a position is outside its province', () => {
    // Durban coordinates on a plaza recorded as Gauteng.
    const ds = dataset({
      plazas: [plaza('p-a', { province: 'GP', location: loc(-29.86, 31.02) })],
      tariffs: fullClasses('p-a', 1000),
    });
    expect(codes(validate(ds))).toContain('location_outside_province');
  });
});

describe('dates and schedules', () => {
  it('rejects ranges that end before they start', () => {
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: fullClasses('p-a', 1000, { effectiveFrom: '2026-03-01', effectiveTo: '2026-02-01' }),
    });
    expect(codes(validate(ds))).toContain('invalid_date_range');
  });

  it('rejects overlapping published tariffs (conflicting schedules)', () => {
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: [...fullClasses('p-a', 1000), tariff('p-a', 'class1', 1100, { effectiveFrom: '2026-06-01' })],
    });
    const overlap = validate(ds).filter((i) => i.code === 'overlapping_tariffs');
    expect(overlap).toHaveLength(1);
    expect(overlap[0]?.severity).toBe('error');
  });

  it('allows the same period in opposite directions', () => {
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: ['class1', 'class2', 'class3', 'class4'].flatMap((c, i) => [
        tariff('p-a', c, 1000 * (i + 1), { direction: 'northbound' }),
        tariff('p-a', c, 900 * (i + 1), { direction: 'southbound' }),
      ]),
    });
    expect(codes(validate(ds))).not.toContain('overlapping_tariffs');
  });

  it('flags a check date in the future', () => {
    const ds = dataset({ plazas: [plaza('p-a')], tariffs: fullClasses('p-a', 1000, { checkedOn: '2099-01-01' }) });
    expect(codes(validate(ds))).toContain('checked_in_future');
  });
});

describe('suspicious changes', () => {
  const y2025 = { scheduleId: 'sched-2025', effectiveFrom: '2025-03-01', effectiveTo: '2026-02-28' };

  it('flags a change that does not match the published adjustment (5% in fixture schedule)', () => {
    // 2025: R100.00 → expected 2026 ≈ R105.00. R140.00 is far outside tolerance.
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: [
        ...fullClasses('p-a', 10000, y2025),
        tariff('p-a', 'class1', 14000),
        ...fullClasses('p-a', 10500).slice(1),
      ],
    });
    const flagged = validate(ds).filter((i) => i.code === 'suspicious_change');
    expect(flagged).toHaveLength(1);
  });

  it('accepts changes within rounding tolerance of the adjustment', () => {
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: [
        ...fullClasses('p-a', 10000, y2025),
        tariff('p-a', 'class1', 10550),
        ...fullClasses('p-a', 10500).slice(1),
      ],
    });
    expect(codes(validate(ds))).not.toContain('suspicious_change');
  });
});

describe('class coverage and duplicates', () => {
  it('warns about incomplete vehicle-class coverage', () => {
    const ds = dataset({ plazas: [plaza('p-a')], tariffs: [tariff('p-a', 'class1', 1000)] });
    const issue = validate(ds).find((i) => i.code === 'incomplete_class_coverage');
    expect(issue?.message).toContain('class2, class3, class4');
  });

  it('rejects tariffs for a class the plaza does not use', () => {
    const ds = dataset({ plazas: [plaza('p-a')], tariffs: [tariff('p-a', 'sc-moto', 1000)] });
    expect(codes(validate(ds))).toContain('class_not_in_scheme');
  });

  it('detects duplicate ids and likely duplicate plazas', () => {
    const near = { lat: -26.41, lng: 27.88, precision: 'approximate' as const, sourceIds: ['src-official'] };
    const ds = dataset({
      plazas: [
        plaza('p-a', { name: 'Grasmere', location: near }),
        plaza('p-b', { name: 'Grasmere Toll Plaza' }),
        plaza('p-c', { name: 'Other', location: { ...near, lat: -26.4105 } }),
        plaza('p-c'),
      ],
    });
    const issues = validate(ds);
    expect(codes(issues)).toContain('duplicate_id');
    expect(issues.filter((i) => i.code === 'possible_duplicate_plaza').length).toBeGreaterThanOrEqual(2);
  });
});

describe('publication controls', () => {
  it('refuses published illustrative tariffs', () => {
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: fullClasses('p-a', 1000, { verificationStatus: 'illustrative' }),
    });
    expect(codes(validate(ds))).toContain('illustrative_published');
    expect(codes(validateDataset(ds, { today: TODAY, allowIllustrative: true }))).not.toContain(
      'illustrative_published',
    );
  });
});

describe('journeys', () => {
  const j: Journey = {
    id: 'j-a',
    name: 'J',
    origin: { label: 'A', query: 'A' },
    destination: { label: 'B', query: 'B' },
    via: 'N9',
    description: '',
    events: [
      { plazaId: 'p-a', direction: 'southbound', requirement: 'required' },
      { plazaId: 'p-a', direction: 'southbound', requirement: 'required' },
      { plazaId: 'p-missing', direction: 'southbound', requirement: 'required' },
    ],
    sequenceStatus: 'unverified',
    limitations: [],
    sourceIds: [],
    publicationStatus: 'published',
  };
  it('rejects duplicate and unknown plazas in a journey', () => {
    const issues = validate(dataset({ plazas: [plaza('p-a')], tariffs: fullClasses('p-a', 1000), journeys: [j] }));
    expect(codes(issues)).toContain('journey_duplicate_event');
    expect(issues.some((i) => i.code === 'missing_reference' && i.message.includes('p-missing'))).toBe(true);
  });
});

describe('parseAndValidate', () => {
  it('reports structural problems in untrusted input', () => {
    const { dataset: ds, issues } = parseAndValidate({ schemaVersion: 2 }, { today: TODAY });
    expect(ds).toBeNull();
    expect(issues.every((i) => i.code === 'schema_invalid')).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('rejects unknown fields and non-integer cents', () => {
    const ds = dataset({ plazas: [plaza('p-a')], tariffs: [{ ...tariff('p-a', 'class1', 54.5) }] });
    const { issues } = parseAndValidate(ds, { today: TODAY });
    expect(issues.some((i) => i.message.includes('amountCents'))).toBe(true);
  });
});
