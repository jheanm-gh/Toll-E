import { describe, expect, it } from 'vitest';

import {
  buildTariffIndex,
  calculate,
  journeyInput,
  manualInput,
  reconstructTotal,
  returnEvents,
  type Journey,
} from '../src';
import { TODAY, dataset, plaza, tariff } from './fixtures';

/*
 * Fixture network (hand-written amounts, verified):
 *   A (mainline, operator A)   class1 R54.50, class2 R151.00
 *   B (mainline)               class1 R27.50, class2 R82.00
 *   C (mainline, unverified)   class1 R16.50
 *   R (ramp, conditional)      class1 R14.00
 *   D (direction-specific)     northbound R20.00, southbound R12.50
 * Hand-computed totals are written next to each expectation.
 */
const plazas = [plaza('p-a'), plaza('p-b'), plaza('p-c'), plaza('p-r', { type: 'ramp' }), plaza('p-d')];
const tariffs = [
  tariff('p-a', 'class1', 5450),
  tariff('p-a', 'class2', 15100),
  tariff('p-b', 'class1', 2750),
  tariff('p-b', 'class2', 8200),
  tariff('p-c', 'class1', 1650, { verificationStatus: 'unverified', verifiedOn: null, verifiedBy: null }),
  tariff('p-r', 'class1', 1400),
  tariff('p-d', 'class1', 2000, { direction: 'northbound' }),
  tariff('p-d', 'class1', 1250, { direction: 'southbound' }),
];
const index = buildTariffIndex(dataset({ plazas, tariffs }));

const journey = (overrides: Partial<Journey> = {}): Journey => ({
  id: 'j-test',
  name: 'Test',
  origin: { label: 'X', query: 'X' },
  destination: { label: 'Y', query: 'Y' },
  via: 'N9',
  description: '',
  events: [
    { plazaId: 'p-a', direction: 'southbound', requirement: 'required' },
    { plazaId: 'p-b', direction: 'southbound', requirement: 'required' },
  ],
  sequenceStatus: 'verified',
  limitations: [],
  sourceIds: [],
  publicationStatus: 'published',
  ...overrides,
});

describe('one-way journeys', () => {
  it('sums each toll event: R54.50 + R27.50 = R82.00', () => {
    const r = calculate(index, journeyInput(journey(), { trip: 'one_way', standardClass: 'class1', date: TODAY }));
    expect(r.totalCents).toBe(8200);
    expect(r.lines.map((l) => l.amountCents)).toEqual([5450, 2750]);
    expect(r.confidence).toBe('confirmed');
    expect(r.pricedCount).toBe(2);
  });

  it('uses the selected vehicle class: class 2 R151 + R82 = R233.00', () => {
    const r = calculate(index, journeyInput(journey(), { trip: 'one_way', standardClass: 'class2', date: TODAY }));
    expect(r.totalCents).toBe(23300);
  });

  it('itemised lines reconstruct the total exactly', () => {
    const r = calculate(index, journeyInput(journey(), { trip: 'return', standardClass: 'class1', date: TODAY }));
    expect(reconstructTotal(r)).toBe(r.totalCents);
    expect(r.outboundCents + r.returnCents).toBe(r.totalCents);
  });
});

describe('return journeys', () => {
  it('reverses the sequence and charges both legs: 2 × R82.00 = R164.00', () => {
    const r = calculate(index, journeyInput(journey(), { trip: 'return', standardClass: 'class1', date: TODAY }));
    expect(r.totalCents).toBe(16400);
    expect(r.outboundCents).toBe(8200);
    expect(r.returnCents).toBe(8200);
    expect(r.lines.filter((l) => l.leg === 'return').map((l) => l.plazaId)).toEqual(['p-b', 'p-a']);
    expect(r.lines.filter((l) => l.leg === 'return').every((l) => l.direction === 'northbound')).toBe(true);
  });

  it('applies directional charging: southbound R12.50 out, northbound R20.00 back = R32.50', () => {
    const j = journey({ events: [{ plazaId: 'p-d', direction: 'southbound', requirement: 'required' }] });
    const r = calculate(index, journeyInput(j, { trip: 'return', standardClass: 'class1', date: TODAY }));
    expect(r.lines.map((l) => l.amountCents)).toEqual([1250, 2000]);
    expect(r.totalCents).toBe(3250);
  });

  it('uses explicit return events when a journey defines them', () => {
    const j = journey({
      returnEvents: [{ plazaId: 'p-a', direction: 'northbound', requirement: 'required' }],
    });
    expect(returnEvents(j).map((e) => e.plazaId)).toEqual(['p-a']);
    const r = calculate(index, journeyInput(j, { trip: 'return', standardClass: 'class1', date: TODAY }));
    expect(r.totalCents).toBe(8200 + 5450);
  });
});

describe('honest handling of unsupported and ambiguous journeys', () => {
  it('labels a total partial when an event cannot be priced, and excludes it', () => {
    // p-c has no class 2 tariff: total is A + B only (R151 + R82 = R233) and flagged partial.
    const j = journey({
      events: [
        { plazaId: 'p-a', direction: 'southbound', requirement: 'required' },
        { plazaId: 'p-b', direction: 'southbound', requirement: 'required' },
        { plazaId: 'p-c', direction: 'southbound', requirement: 'required' },
      ],
    });
    const r = calculate(index, journeyInput(j, { trip: 'one_way', standardClass: 'class2', date: TODAY }));
    expect(r.totalCents).toBe(23300);
    expect(r.confidence).toBe('partial');
    expect(r.chargeableCount).toBe(3);
    expect(r.pricedCount).toBe(2);
    expect(r.warnings.find((w) => w.code === 'unpriced_events')?.plazaIds).toEqual(['p-c']);
  });

  it('never calls a total confirmed when any tariff is unverified', () => {
    const j = journey({ events: [{ plazaId: 'p-c', direction: 'southbound', requirement: 'required' }] });
    const r = calculate(index, journeyInput(j, { trip: 'one_way', standardClass: 'class1', date: TODAY }));
    expect(r.totalCents).toBe(1650);
    expect(r.confidence).toBe('estimate');
    expect(r.trust).toBe('unverified');
    expect(r.warnings.map((w) => w.code)).toContain('unverified_tariffs');
  });

  it('never calls a total confirmed when the plaza sequence is unverified', () => {
    const r = calculate(
      index,
      journeyInput(journey({ sequenceStatus: 'unverified' }), {
        trip: 'one_way',
        standardClass: 'class1',
        date: TODAY,
      }),
    );
    expect(r.confidence).toBe('estimate');
    expect(r.warnings.map((w) => w.code)).toContain('sequence_unverified');
  });

  it('reports ambiguity when a direction-specific plaza is selected without a direction', () => {
    const r = calculate(index, manualInput(['p-a', 'p-d'], { trip: 'one_way', standardClass: 'class1', date: TODAY }));
    expect(r.lines[1]).toMatchObject({ status: 'ambiguous', reason: 'direction_required', amountCents: null });
    expect(r.totalCents).toBe(5450);
    expect(r.confidence).toBe('partial');
  });

  it('returns unavailable when nothing can be priced', () => {
    const r = calculate(index, manualInput(['p-c'], { trip: 'one_way', standardClass: 'class4', date: TODAY }));
    expect(r.totalCents).toBe(0);
    expect(r.confidence).toBe('unavailable');
  });

  it('handles an empty selection', () => {
    const r = calculate(index, manualInput([], { trip: 'one_way', standardClass: 'class1', date: TODAY }));
    expect(r.confidence).toBe('unavailable');
    expect(r.warnings.map((w) => w.code)).toContain('no_events');
  });
});

describe('conditional and duplicate events', () => {
  const j = journey({
    events: [
      { plazaId: 'p-a', direction: 'southbound', requirement: 'required' },
      { plazaId: 'p-r', direction: 'southbound', requirement: 'conditional', condition: 'If you use the ramp' },
    ],
  });

  it('excludes conditional events until the user confirms them', () => {
    const r = calculate(index, journeyInput(j, { trip: 'one_way', standardClass: 'class1', date: TODAY }));
    expect(r.totalCents).toBe(5450);
    expect(r.lines[1]?.status).toBe('excluded');
    expect(r.confidence).toBe('confirmed');
    expect(r.warnings.find((w) => w.code === 'excluded_conditional')?.plazaIds).toEqual(['p-r']);
  });

  it('includes confirmed conditional events: R54.50 + R14.00 = R68.50', () => {
    const r = calculate(
      index,
      journeyInput(j, { trip: 'one_way', standardClass: 'class1', date: TODAY, includeConditional: new Set(['p-r']) }),
    );
    expect(r.totalCents).toBe(6850);
  });

  it('counts a plaza once per leg even if selected twice', () => {
    const r = calculate(
      index,
      manualInput(['p-a', 'p-a', 'p-b'], { trip: 'one_way', standardClass: 'class1', date: TODAY }),
    );
    expect(r.totalCents).toBe(8200);
    expect(r.lines.map((l) => l.status)).toEqual(['priced', 'duplicate', 'priced']);
    expect(r.warnings.map((w) => w.code)).toContain('duplicate_event');
  });

  it('charges a plaza on both legs of a return trip (not a duplicate)', () => {
    const r = calculate(index, manualInput(['p-a'], { trip: 'return', standardClass: 'class1', date: TODAY }));
    expect(r.totalCents).toBe(10900);
    expect(r.lines.every((l) => l.status === 'priced')).toBe(true);
  });
});

describe('manual selections and dates', () => {
  it('flags manual selections and never calls them confirmed', () => {
    const r = calculate(index, manualInput(['p-a', 'p-b'], { trip: 'one_way', standardClass: 'class1', date: TODAY }));
    expect(r.totalCents).toBe(8200);
    expect(r.confidence).toBe('estimate');
    expect(r.warnings.map((w) => w.code)).toContain('manual_selection');
  });

  it('prices using the tariffs in force on the travel date', () => {
    const idx = buildTariffIndex(
      dataset({
        plazas: [plaza('p-x')],
        tariffs: [
          tariff('p-x', 'class1', 5000, {
            scheduleId: 'sched-2025',
            effectiveFrom: '2025-03-01',
            effectiveTo: '2026-02-28',
          }),
          tariff('p-x', 'class1', 5250),
        ],
      }),
    );
    expect(
      calculate(idx, manualInput(['p-x'], { trip: 'one_way', standardClass: 'class1', date: '2026-02-28' })).totalCents,
    ).toBe(5000);
    expect(
      calculate(idx, manualInput(['p-x'], { trip: 'one_way', standardClass: 'class1', date: '2026-03-01' })).totalCents,
    ).toBe(5250);
  });

  it('collects the sources and schedules behind a result', () => {
    const r = calculate(index, manualInput(['p-a', 'p-c'], { trip: 'one_way', standardClass: 'class1', date: TODAY }));
    expect(r.sourceIds).toEqual(['src-official']);
    expect(r.scheduleIds).toEqual(['sched-2026']);
  });
});
