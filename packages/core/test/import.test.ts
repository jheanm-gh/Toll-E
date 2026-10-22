import { describe, expect, it } from 'vitest';

import {
  applyTariffImport,
  diffPlazas,
  parseCsv,
  parseTariffCsv,
  reviewTariffImport,
  tariffsToCsv,
  validateDataset,
} from '../src';
import { TODAY, dataset, plaza, tariff } from './fixtures';

const HEADER =
  'plaza_id,vehicle_class,amount,schedule_id,effective_from,effective_to,direction,condition,verification_status,publication_status,source_id,source_locator,checked_on,verified_on,verified_by,notes';

describe('parseCsv', () => {
  it('handles quotes, commas, escaped quotes and CRLF', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });
  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"b')).toThrow();
  });
});

describe('parseTariffCsv', () => {
  it('parses rand amounts into integer cents and builds stable ids', () => {
    const csv = `# comment\n${HEADER}\np-a,class1,R54.50,sched-2026,2026-03-01,,any,,unverified,published,src-official,p.1,2026-03-02,,,`;
    const { tariffs, errors } = parseTariffCsv(csv);
    expect(errors).toEqual([]);
    expect(tariffs[0]).toMatchObject({
      id: 'sched-2026-p-a-class1',
      amountCents: 5450,
      effectiveTo: null,
      verificationStatus: 'unverified',
      publicationStatus: 'published',
      sourceLocator: 'p.1',
    });
  });

  it('reports row-level errors without stopping', () => {
    const csv = `${HEADER}\np-a,class1,abc,sched-2026,2026-03-01,,any,,,,src-official,,2026-03-02,,,\np-a,class2,R10.00,sched-2026,2026-02-30,,any,,,,src-official,,2026-03-02,,,\np-a,class3,R10.00,sched-2026,2026-03-01,,any,,,,src-official,,2026-03-02,,,`;
    const { tariffs, errors } = parseTariffCsv(csv);
    expect(errors.map((e) => e.row)).toEqual([2, 3]);
    expect(tariffs).toHaveLength(1);
    expect(tariffs[0]?.publicationStatus).toBe('draft');
  });

  it('rejects files missing required columns', () => {
    expect(parseTariffCsv('plaza_id,amount\np-a,1').errors[0]?.message).toContain('missing columns');
  });

  it('round-trips through tariffsToCsv', () => {
    const original = [tariff('p-a', 'class1', 123450, { id: 'sched-2026-p-a-class1', notes: 'has, comma' })];
    const { tariffs } = parseTariffCsv(tariffsToCsv(original));
    expect(tariffs[0]).toMatchObject({ amountCents: 123450, notes: 'has, comma' });
  });
});

describe('reviewTariffImport', () => {
  const published = tariff('p-a', 'class1', 5000, {
    id: 'sched-2026-p-a-class1',
    effectiveTo: '2027-02-28',
  });
  const draft = tariff('p-a', 'class2', 9000, { id: 'sched-2026-p-a-class2', publicationStatus: 'draft' });
  const current = dataset({ plazas: [plaza('p-a')], tariffs: [published, draft] });

  it('classifies creates, unchanged, draft updates and corrections', () => {
    const incoming = [
      { ...published }, // unchanged
      { ...published, amountCents: 5100 }, // change to a published record
      { ...draft, amountCents: 9100 }, // change to a draft
      tariff('p-a', 'class1', 5300, {
        id: 'sched-2027-p-a-class1',
        scheduleId: 'sched-2027',
        effectiveFrom: '2027-03-01',
      }), // new future tariff
    ];
    const review = reviewTariffImport(current, incoming, { today: TODAY });
    expect(review.items.map((i) => i.action)).toEqual(['unchanged', 'propose_correction', 'update_draft', 'create']);
    expect(review.items[1]?.changedFields).toEqual(['amountCents']);
  });

  it('never imports a verification — imported rows arrive unverified drafts', () => {
    const incoming = [tariff('p-a', 'class3', 12000, { id: 'new-row', verificationStatus: 'verified' })];
    const review = reviewTariffImport(current, incoming, { today: TODAY });
    expect(review.items[0]).toMatchObject({ action: 'create', verificationDowngraded: true });
    expect(review.items[0]?.incoming).toMatchObject({
      verificationStatus: 'unverified',
      publicationStatus: 'draft',
      verifiedBy: null,
    });
  });

  it('rejects rows that would overlap a published tariff', () => {
    const incoming = [tariff('p-a', 'class1', 5200, { id: 'overlapping', effectiveFrom: '2026-06-01' })];
    const review = reviewTariffImport(current, incoming, { today: TODAY });
    expect(review.items[0]?.action).toBe('reject');
    expect(review.items[0]?.issues.map((i) => i.code)).toContain('overlapping_tariffs');
  });

  it('flags suspicious changes for review without rejecting them', () => {
    const ds = dataset({
      plazas: [plaza('p-a')],
      tariffs: [
        tariff('p-a', 'class1', 10000, {
          id: 'old',
          scheduleId: 'sched-2025',
          effectiveFrom: '2025-03-01',
          effectiveTo: '2026-02-28',
        }),
      ],
    });
    const review = reviewTariffImport(ds, [tariff('p-a', 'class1', 20000, { id: 'jump' })], { today: TODAY });
    expect(review.items[0]?.action).toBe('create');
    expect(review.items[0]?.issues.map((i) => i.code)).toContain('suspicious_change');
  });
});

describe('applyTariffImport', () => {
  const published = tariff('p-a', 'class1', 5000, { id: 'sched-2026-p-a-class1' });
  const current = dataset({ plazas: [plaza('p-a')], tariffs: [published] });
  const review = reviewTariffImport(current, [{ ...published, amountCents: 5100 }], { today: TODAY });

  it('does not touch published data unless the correction is approved', () => {
    const next = applyTariffImport(current, review, { reviewer: 'Ann', today: TODAY });
    expect(next.tariffs).toEqual(current.tariffs);
  });

  it('preserves history: approval withdraws the old record and adds a corrected draft', () => {
    const next = applyTariffImport(current, review, {
      reviewer: 'Ann',
      today: TODAY,
      approvedCorrections: new Set(['sched-2026-p-a-class1']),
    });
    expect(next.tariffs).toHaveLength(2);
    const old = next.tariffs.find((t) => t.id === 'sched-2026-p-a-class1');
    const revised = next.tariffs.find((t) => t.id === 'sched-2026-p-a-class1-r2');
    expect(old?.publicationStatus).toBe('withdrawn');
    expect(old?.amountCents).toBe(5000);
    expect(revised).toMatchObject({ amountCents: 5100, publicationStatus: 'draft' });
    expect(validateDataset(next, { today: TODAY }).filter((i) => i.code === 'overlapping_tariffs')).toEqual([]);
  });
});

describe('diffPlazas', () => {
  it('lists changed fields', () => {
    const a = plaza('p-a');
    const changes = diffPlazas([a], [{ ...a, name: 'Renamed' }, plaza('p-new')]);
    expect(changes).toEqual([
      { id: 'p-a', kind: 'changed', fields: ['name'] },
      { id: 'p-new', kind: 'created', fields: [] },
    ]);
  });
});
