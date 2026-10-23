import { describe, expect, it } from 'vitest';

import { loadDataset } from '../../../scripts/lib/data';
import {
  buildTariffIndex,
  calculate,
  computeCoverage,
  journeyInput,
  offeredJourneys,
  parseDataset,
  releaseReadiness,
  resolveStandardTariff,
  validateDataset,
  type StandardClassId,
} from '../src';

/**
 * Checks against the real seed dataset in data/. Expected totals are independent figures:
 * - Johannesburg→Durban Class 1 (2026): R347.50, the sum of the SANRAL 2026 poster values
 *   (docs/research-register.md D13).
 * - Johannesburg→Durban Class 1 (2025): R334.00, the sum of Government Gazette No. 52072/52073 values (D15).
 * - TRAC N4 values are summed by hand from the operator's published table.
 */
const TODAY = '2026-10-23';
const { dataset, csvErrors } = loadDataset();
const index = buildTariffIndex(dataset);
const journey = (id: string) => {
  const j = dataset.journeys.find((x) => x.id === id);
  if (!j) throw new Error(`missing journey ${id}`);
  return j;
};

describe('seed dataset integrity', () => {
  it('parses, with no CSV errors and no validation errors', () => {
    expect(csvErrors).toEqual([]);
    expect(parseDataset(dataset).ok).toBe(true);
    const errors = validateDataset(dataset, { today: TODAY }).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('contains no tariff marked verified (no person has checked them yet)', () => {
    expect(dataset.tariffs.filter((t) => t.verificationStatus === 'verified')).toEqual([]);
  });

  it('contains no illustrative data', () => {
    expect(dataset.tariffs.some((t) => t.verificationStatus === 'illustrative')).toBe(false);
  });

  it('has no CPI-consistency outliers between 2025 and 2026', () => {
    // Huguenot Class 3 used to be flagged: the 2025 row was a transcription error (R299), and
    // Gazette No. 52073 gives R229. A new flag here means a value needs checking.
    const issues = validateDataset(dataset, { today: TODAY });
    expect(issues.filter((i) => i.code === 'suspicious_change')).toEqual([]);
  });

  it('only gives map positions that are labelled approximate (none verified yet)', () => {
    const located = dataset.plazas.filter((p) => p.location);
    expect(located.length).toBeGreaterThan(0);
    expect(located.every((p) => p.location?.precision === 'approximate')).toBe(true);
  });
});

describe('real journey totals', () => {
  it('Johannesburg → Durban, Class 1, one way (2026): R347.50', () => {
    const r = calculate(
      index,
      journeyInput(journey('jhb-dbn-n3'), {
        trip: 'one_way',
        standardClass: 'class1',
        date: '2026-10-21',
      }),
    );
    expect(r.lines.map((l) => [l.plazaId, l.amountCents])).toEqual([
      ['n3-de-hoek', 6700],
      ['n3-wilge', 9400],
      ['n3-tugela', 10000],
      ['n3-mooi', 7000],
      ['n3-mariannhill', 1650],
    ]);
    expect(r.totalCents).toBe(34750);
    // Nothing is verified by a person yet: this must be labelled an estimate.
    expect(r.confidence).toBe('estimate');
    expect(r.trust).toBe('unverified');
  });

  it('Johannesburg → Durban, Class 1, return (2026): R695.00', () => {
    const r = calculate(
      index,
      journeyInput(journey('jhb-dbn-n3'), {
        trip: 'return',
        standardClass: 'class1',
        date: '2026-10-21',
      }),
    );
    expect(r.totalCents).toBe(69500);
    expect(r.outboundCents).toBe(34750);
    expect(r.returnCents).toBe(34750);
  });

  it('Johannesburg → Durban, Class 1, on 1 July 2025 uses the 2025 tariffs: R334.00', () => {
    const r = calculate(
      index,
      journeyInput(journey('jhb-dbn-n3'), {
        trip: 'one_way',
        standardClass: 'class1',
        date: '2025-07-01',
      }),
    );
    expect(r.totalCents).toBe(33400);
    expect(r.confidence).toBe('estimate');
  });

  it('Pretoria → Mbombela (TRAC N4): Class 1 R261.00, Class 4 R1 314.00', () => {
    const c1 = calculate(
      index,
      journeyInput(journey('pta-mbombela-n4'), {
        trip: 'one_way',
        standardClass: 'class1',
        date: '2026-10-21',
      }),
    );
    const c4 = calculate(
      index,
      journeyInput(journey('pta-mbombela-n4'), {
        trip: 'one_way',
        standardClass: 'class4',
        date: '2026-10-21',
      }),
    );
    expect(c1.totalCents).toBe(26100);
    expect(c4.totalCents).toBe(131400);
  });

  it('Johannesburg → Cape Town: Huguenot is excluded unless the user confirms the tunnel', () => {
    const j = journey('jhb-cpt-n1');
    const without = calculate(index, journeyInput(j, { trip: 'one_way', standardClass: 'class1', date: '2026-10-21' }));
    const withTunnel = calculate(
      index,
      journeyInput(j, {
        trip: 'one_way',
        standardClass: 'class1',
        date: '2026-10-21',
        includeConditional: new Set(['n1-huguenot']),
      }),
    );
    expect(without.totalCents).toBe(2750 + 9150 + 7850);
    expect(withTunnel.totalCents).toBe(2750 + 9150 + 7850 + 5450);
  });
});

/**
 * One light and one heavy class per MVP corridor, plaza by plaza. The expected amounts are
 * written out here, apart from the CSV files, as read from the official publication named in
 * each case (opened in full on 23 Oct 2026), so a slip in data/tariffs/*.csv or in the loader
 * fails the test. A person has not yet checked them against the Government Gazette itself
 * (see docs/coverage-register.md). Totals are hand-summed.
 */
const corridorCases: {
  journeyId: string;
  standardClass: StandardClassId;
  source: string;
  plazas: [string, number][];
  totalCents: number;
}[] = [
  {
    journeyId: 'jhb-dbn-n3',
    standardClass: 'class1',
    source: 'SANRAL 2026 tariff poster (N3TC and Mariannhill rows)',
    plazas: [
      ['n3-de-hoek', 6700],
      ['n3-wilge', 9400],
      ['n3-tugela', 10000],
      ['n3-mooi', 7000],
      ['n3-mariannhill', 1650],
    ],
    totalCents: 34750,
  },
  {
    journeyId: 'jhb-dbn-n3',
    standardClass: 'class4',
    source: 'SANRAL 2026 poster (N3TC and Mariannhill rows)',
    plazas: [
      ['n3-de-hoek', 23000],
      ['n3-wilge', 30400],
      ['n3-tugela', 35900],
      ['n3-mooi', 32400],
      ['n3-mariannhill', 5700],
    ],
    totalCents: 127400,
  },
  {
    journeyId: 'jhb-cpt-n1',
    standardClass: 'class1',
    source: 'SANRAL 2026 tariff poster',
    plazas: [
      ['n1-grasmere', 2750],
      ['n1-vaal', 9150],
      ['n1-verkeerdevlei', 7850],
    ],
    totalCents: 19750,
  },
  {
    journeyId: 'jhb-cpt-n1',
    standardClass: 'class3',
    source: 'SANRAL 2026 tariff poster',
    plazas: [
      ['n1-grasmere', 9600],
      ['n1-vaal', 20700],
      ['n1-verkeerdevlei', 23600],
    ],
    totalCents: 53900,
  },
  {
    journeyId: 'pta-polokwane-n1',
    standardClass: 'class1',
    source: 'Bakwena 2026/27 tariffs (Pumulani, Carousel); SANRAL 2026 poster (Kranskop, Nyl)',
    plazas: [
      ['n1-pumulani', 1650],
      ['n1-carousel', 7500],
      ['n1-kranskop', 6150],
      ['n1-nyl', 7950],
    ],
    totalCents: 23250,
  },
  {
    journeyId: 'pta-polokwane-n1',
    standardClass: 'class4',
    source: 'Bakwena 2026/27 tariffs (Pumulani, Carousel); SANRAL 2026 poster (Kranskop, Nyl)',
    plazas: [
      ['n1-pumulani', 5700],
      ['n1-carousel', 25800],
      ['n1-kranskop', 25700],
      ['n1-nyl', 24100],
    ],
    totalCents: 81300,
  },
  {
    journeyId: 'pta-mbombela-n4',
    standardClass: 'class1',
    source: 'TRAC N4 2026 toll fees (same as the SANRAL 2026 poster)',
    plazas: [
      ['n4-diamond-hill', 5100],
      ['n4-middelburg', 8400],
      ['n4-machado', 12600],
    ],
    totalCents: 26100,
  },
  {
    journeyId: 'pta-mbombela-n4',
    standardClass: 'class2',
    source: 'TRAC N4 2026 toll fees (same as the SANRAL 2026 poster)',
    plazas: [
      ['n4-diamond-hill', 7000],
      ['n4-middelburg', 18200],
      ['n4-machado', 35000],
    ],
    totalCents: 60200,
  },
  {
    journeyId: 'pta-rustenburg-n4',
    standardClass: 'class1',
    source: 'Bakwena 2026/27 tariffs',
    plazas: [
      ['n4-doornpoort', 2000],
      ['n4-brits', 2000],
      ['n4-marikana', 3000],
    ],
    totalCents: 7000,
  },
  {
    journeyId: 'pta-rustenburg-n4',
    standardClass: 'class4',
    source: 'Bakwena 2026/27 tariffs',
    plazas: [
      ['n4-doornpoort', 7000],
      ['n4-brits', 9000],
      ['n4-marikana', 9600],
    ],
    totalCents: 25600,
  },
];

describe('MVP corridors against the published 2026 figures', () => {
  for (const c of corridorCases) {
    it(`${c.journeyId}, ${c.standardClass}: ${c.source}`, () => {
      const r = calculate(
        index,
        journeyInput(journey(c.journeyId), {
          trip: 'one_way',
          standardClass: c.standardClass,
          date: '2026-10-21',
        }),
      );
      const priced = r.lines.filter((l) => l.status === 'priced').map((l) => [l.plazaId, l.amountCents]);
      expect(priced).toEqual(c.plazas);
      expect(r.totalCents).toBe(c.totalCents);
      expect(r.pricedCount).toBe(r.chargeableCount);
      // Nothing is human-verified yet, so no corridor may claim a confirmed total.
      expect(r.confidence).toBe('estimate');
    });
  }

  it('prices every class on every MVP corridor (no gaps in classes 1–4)', () => {
    for (const id of ['jhb-dbn-n3', 'jhb-cpt-n1', 'pta-polokwane-n1', 'pta-mbombela-n4', 'pta-rustenburg-n4']) {
      for (const cls of ['class1', 'class2', 'class3', 'class4'] as const) {
        const r = calculate(
          index,
          journeyInput(journey(id), { trip: 'one_way', standardClass: cls, date: '2026-10-21' }),
        );
        expect(r.pricedCount, `${id} ${cls}`).toBe(r.chargeableCount);
      }
    }
  });

  it('Johannesburg → Durban, Class 2, return doubles the one-way total: R1 264.00', () => {
    const r = calculate(
      index,
      journeyInput(journey('jhb-dbn-n3'), {
        trip: 'return',
        standardClass: 'class2',
        date: '2026-10-21',
      }),
    );
    expect(r.outboundCents).toBe(63200);
    expect(r.totalCents).toBe(126400);
  });
});

describe('release gate on the real data', () => {
  const report = releaseReadiness(dataset, '2026-10-21');

  it('is not ready: no tariff or journey has been verified by a person', () => {
    expect(report.ready).toBe(false);
    expect(report.verifiedSlots).toBe(0);
    expect(report.gaps.some((g) => g.kind === 'tariff_not_verified')).toBe(true);
    expect(report.gaps.filter((g) => g.kind === 'journey_unverified').length).toBe(dataset.journeys.length);
  });

  it('production builds offer no journeys until a sequence is verified; test builds offer all published ones', () => {
    expect(offeredJourneys(dataset.journeys, { includeUnverifiedSequences: false })).toEqual([]);
    expect(offeredJourneys(dataset.journeys, { includeUnverifiedSequences: true }).length).toBe(
      dataset.journeys.filter((j) => j.publicationStatus === 'published').length,
    );
  });
});

describe('effective dates in the real data', () => {
  it('uses the 2025 Gazette value for Huguenot Class 3 in 2025 (R229.00, corrected from a transcription error)', () => {
    const r = resolveStandardTariff(index, 'n1-huguenot', 'class3', { date: '2025-07-01' });
    expect(r.kind === 'current' && r.tariff.amountCents).toBe(22900);
  });

  it('prices plazas added from the SANRAL 2026 poster', () => {
    const price = (plaza: string, cls: StandardClassId) => {
      const r = resolveStandardTariff(index, plaza, cls, { date: TODAY });
      return r.kind === 'current' ? r.tariff.amountCents : null;
    };
    expect(price('n1-sebetiela', 'class1')).toBe(2450);
    expect(price('n1-nyl-ramp', 'class4')).toBe(6900);
    expect(price('r30-brandfort', 'class1')).toBe(6250);
    expect(price('n4-cullinan-ramp', 'class4')).toBe(8600);
    expect(price('n4-pelindaba', 'class2')).toBe(1500);
  });

  it('treats Bakwena tariffs as expired after their stated validity (28 Feb 2027)', () => {
    const r = resolveStandardTariff(index, 'n1-pumulani', 'class1', { date: '2027-03-01' });
    expect(r).toMatchObject({ kind: 'none', reason: 'expired' });
  });

  it('marks open-ended SANRAL tariffs as possibly superseded after 1 March 2027', () => {
    const before = resolveStandardTariff(index, 'n1-vaal', 'class1', { date: '2027-02-28' });
    const after = resolveStandardTariff(index, 'n1-vaal', 'class1', { date: '2027-03-01' });
    expect(before.kind === 'current' && before.possiblySuperseded).toBe(false);
    expect(after.kind === 'current' && after.possiblySuperseded).toBe(true);
  });

  it('does not apply Chapman’s Peak 2026 tolls before 1 July 2026', () => {
    expect(resolveStandardTariff(index, 'm6-chapmans-peak', 'class1', { date: '2026-06-30' })).toMatchObject({
      kind: 'none',
      reason: 'not_yet_effective',
    });
    const r = resolveStandardTariff(index, 'm6-chapmans-peak', 'class1', { date: '2026-07-01' });
    expect(r.kind === 'current' && r.tariff.amountCents).toBe(6800);
  });
});

describe('coverage register', () => {
  it('reports honest coverage', () => {
    const rows = computeCoverage(dataset, TODAY);
    expect(rows.every((r) => r.location !== 'yes')).toBe(true);
    expect(rows.every((r) => r.currentTariff !== 'yes')).toBe(true);
    // Every plaza on the SANRAL 2026 poster now has a price for every class.
    expect(rows.filter((r) => r.classCoverage.available < r.classCoverage.total)).toEqual([]);
  });
});
