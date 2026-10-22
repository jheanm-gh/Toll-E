import { describe, expect, it } from 'vitest';

import {
  assessTrust,
  buildTariffIndex,
  historicalTariff,
  resolveStandardTariff,
  resolveTariff,
  tariffHistory,
} from '../src';
import { TODAY, dataset, plaza, schedule2026, tariff } from './fixtures';

const P = 'p-alpha';

function indexWith(tariffs: ReturnType<typeof tariff>[], plazas = [plaza(P)]) {
  return buildTariffIndex(dataset({ plazas, tariffs }));
}

describe('resolveTariff — effective dates', () => {
  const t2025 = tariff(P, 'class1', 5000, {
    scheduleId: 'sched-2025',
    effectiveFrom: '2025-03-01',
    effectiveTo: '2026-02-28',
  });
  const t2026 = tariff(P, 'class1', 5250, { effectiveFrom: '2026-03-01', effectiveTo: null });
  const index = indexWith([t2025, t2026]);

  it('selects the tariff in force on the date', () => {
    const r = resolveTariff(index, P, 'class1', { date: TODAY });
    expect(r.kind).toBe('current');
    if (r.kind === 'current') expect(r.tariff.amountCents).toBe(5250);
  });

  it('switches exactly on the effective date (inclusive boundaries)', () => {
    const lastDay = resolveTariff(index, P, 'class1', { date: '2026-02-28' });
    const firstDay = resolveTariff(index, P, 'class1', { date: '2026-03-01' });
    expect(lastDay.kind === 'current' && lastDay.tariff.amountCents).toBe(5000);
    expect(firstDay.kind === 'current' && firstDay.tariff.amountCents).toBe(5250);
  });

  it('retrieves historical tariffs', () => {
    expect(historicalTariff(index, P, 'class1', '2025-07-01')?.amountCents).toBe(5000);
    expect(tariffHistory(index, P, 'class1').map((t) => t.amountCents)).toEqual([5250, 5000]);
  });
});

describe('resolveTariff — future and expired tariffs', () => {
  it('never activates a future tariff early, but reports it as upcoming', () => {
    const current = tariff(P, 'class1', 5000, { effectiveTo: '2027-02-28' });
    const future = tariff(P, 'class1', 5400, { effectiveFrom: '2027-03-01', scheduleId: 'sched-2027' });
    const index = indexWith([current, future]);
    const r = resolveTariff(index, P, 'class1', { date: '2027-02-28' });
    expect(r.kind).toBe('current');
    if (r.kind === 'current') {
      expect(r.tariff.amountCents).toBe(5000);
      expect(r.upcoming?.amountCents).toBe(5400);
    }
  });

  it('reports not_yet_effective when only a future tariff exists', () => {
    const index = indexWith([tariff(P, 'class1', 5400, { effectiveFrom: '2027-03-01' })]);
    const r = resolveTariff(index, P, 'class1', { date: TODAY });
    expect(r.kind).toBe('none');
    if (r.kind === 'none') {
      expect(r.reason).toBe('not_yet_effective');
      expect(r.upcoming?.amountCents).toBe(5400);
    }
  });

  it('never presents an expired tariff as current, even if it is the newest record', () => {
    const expired = tariff(P, 'class1', 5000, { effectiveFrom: '2025-03-01', effectiveTo: '2026-02-28' });
    const index = indexWith([expired]);
    const r = resolveTariff(index, P, 'class1', { date: TODAY });
    expect(r.kind).toBe('none');
    if (r.kind === 'none') {
      expect(r.reason).toBe('expired');
      expect(r.latestExpired?.amountCents).toBe(5000);
    }
  });

  it('reports missing classes', () => {
    const index = indexWith([tariff(P, 'class1', 5000)]);
    const r = resolveTariff(index, P, 'class3', { date: TODAY });
    expect(r).toMatchObject({ kind: 'none', reason: 'no_tariff_for_class' });
  });
});

describe('resolveTariff — publication and conflicts', () => {
  it('ignores drafts and withdrawn records for consumers', () => {
    const draft = tariff(P, 'class1', 9999, { publicationStatus: 'draft' });
    const withdrawn = tariff(P, 'class1', 8888, { publicationStatus: 'withdrawn' });
    const index = indexWith([draft, withdrawn]);
    expect(resolveTariff(index, P, 'class1', { date: TODAY }).kind).toBe('none');
    const preview = resolveTariff(index, P, 'class1', { date: TODAY, includeDrafts: true });
    expect(preview.kind === 'current' && preview.tariff.amountCents).toBe(9999);
  });

  it('excludes illustrative data unless explicitly requested', () => {
    const demo = tariff(P, 'class1', 1234, { verificationStatus: 'illustrative' });
    const index = indexWith([demo]);
    expect(resolveTariff(index, P, 'class1', { date: TODAY }).kind).toBe('none');
    expect(resolveTariff(index, P, 'class1', { date: TODAY, includeIllustrative: true }).kind).toBe('current');
  });

  it('reports overlapping tariffs as ambiguous instead of guessing', () => {
    const index = indexWith([tariff(P, 'class1', 5000), tariff(P, 'class1', 5100)]);
    expect(resolveTariff(index, P, 'class1', { date: TODAY })).toMatchObject({
      kind: 'ambiguous',
      reason: 'overlapping_tariffs',
    });
  });

  it('requires a direction for direction-specific tariffs', () => {
    const nb = tariff(P, 'class1', 2000, { direction: 'northbound' });
    const sb = tariff(P, 'class1', 1500, { direction: 'southbound' });
    const index = indexWith([nb, sb]);
    expect(resolveTariff(index, P, 'class1', { date: TODAY })).toMatchObject({
      kind: 'ambiguous',
      reason: 'direction_required',
    });
    const north = resolveTariff(index, P, 'class1', { date: TODAY, direction: 'northbound' });
    const south = resolveTariff(index, P, 'class1', { date: TODAY, direction: 'southbound' });
    expect(north.kind === 'current' && north.tariff.amountCents).toBe(2000);
    expect(south.kind === 'current' && south.tariff.amountCents).toBe(1500);
  });

  it('reports a direction with no tariff', () => {
    const index = indexWith([tariff(P, 'class1', 2000, { direction: 'northbound' })]);
    expect(resolveTariff(index, P, 'class1', { date: TODAY, direction: 'southbound' })).toMatchObject({
      kind: 'none',
      reason: 'no_tariff_in_direction',
    });
  });

  it('does not price inactive plazas', () => {
    const index = indexWith([tariff(P, 'class1', 5000)], [plaza(P, { status: 'decommissioned' })]);
    expect(resolveTariff(index, P, 'class1', { date: TODAY })).toMatchObject({
      kind: 'none',
      reason: 'plaza_inactive',
    });
  });
});

describe('class schemes', () => {
  it('maps a standard class onto a plaza with its own classes', () => {
    const scenic = plaza('p-scenic', { classSchemeId: 'scenic' });
    const index = indexWith([tariff('p-scenic', 'sc-light', 6800), tariff('p-scenic', 'sc-moto', 4500)], [scenic]);
    const light = resolveStandardTariff(index, 'p-scenic', 'class1', { date: TODAY });
    expect(light.kind === 'current' && light.tariff.amountCents).toBe(6800);
    expect(resolveStandardTariff(index, 'p-scenic', 'class2', { date: TODAY })).toMatchObject({
      kind: 'none',
      reason: 'class_not_supported',
    });
  });
});

describe('assessTrust — the four information states', () => {
  it('confirmed: verified recently, no adjustment due', () => {
    const t = tariff(P, 'class1', 5000, { verifiedOn: '2026-03-02' });
    expect(assessTrust(t, schedule2026, TODAY)).toEqual({ trust: 'confirmed', possiblySuperseded: false });
  });
  it('stale: verified more than a year ago', () => {
    const t = tariff(P, 'class1', 5000, { verifiedOn: '2025-01-01' });
    expect(assessTrust(t, schedule2026, TODAY).trust).toBe('stale');
  });
  it('stale: the next scheduled adjustment date has passed', () => {
    const t = tariff(P, 'class1', 5000, { verifiedOn: '2027-01-15' });
    expect(assessTrust(t, schedule2026, '2027-03-02')).toEqual({ trust: 'stale', possiblySuperseded: true });
  });
  it('unverified and under review are reported as such', () => {
    expect(assessTrust(tariff(P, 'class1', 1, { verificationStatus: 'unverified' }), schedule2026, TODAY).trust).toBe(
      'unverified',
    );
    expect(
      assessTrust(tariff(P, 'class1', 1, { verificationStatus: 'pending_review' }), schedule2026, TODAY).trust,
    ).toBe('under_review');
  });
});
