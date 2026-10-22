import type { Dataset, Plaza, Tariff, TariffSchedule } from '../src';

/**
 * Small, hand-built fixtures. Expected values in tests are computed by hand from these
 * numbers, not by calling the implementation.
 */

export const TODAY = '2026-06-15';

export function plaza(id: string, overrides: Partial<Plaza> = {}): Plaza {
  return {
    id,
    name: id.replace(/^p-/, '').replace(/-/g, ' '),
    tollRoadId: 'road-a',
    operatorId: 'op-a',
    route: 'N9',
    type: 'mainline',
    province: 'GP',
    location: null,
    status: 'active',
    classSchemeId: 'za-standard',
    sourceIds: ['src-official'],
    publicationStatus: 'published',
    ...overrides,
  };
}

let seq = 0;
export function tariff(
  plazaId: string,
  vehicleClassId: string,
  amountCents: number,
  overrides: Partial<Tariff> = {},
): Tariff {
  seq++;
  return {
    id: `t-${seq}`,
    plazaId,
    vehicleClassId,
    amountCents,
    currency: 'ZAR',
    vatInclusive: true,
    chargingBasis: 'per_passage',
    direction: 'any',
    effectiveFrom: '2026-03-01',
    effectiveTo: null,
    scheduleId: 'sched-2026',
    sourceId: 'src-official',
    checkedOn: '2026-03-02',
    verifiedOn: '2026-03-02',
    verifiedBy: 'Test Reviewer',
    verificationStatus: 'verified',
    publicationStatus: 'published',
    ...overrides,
  };
}

export const schedule2026: TariffSchedule = {
  id: 'sched-2026',
  name: '2026',
  operatorIds: ['op-a'],
  effectiveFrom: '2026-03-01',
  effectiveTo: null,
  nextReviewExpected: '2027-03-01',
  adjustmentBps: 500,
  sourceIds: ['src-official'],
};
export const schedule2025: TariffSchedule = {
  id: 'sched-2025',
  name: '2025',
  operatorIds: ['op-a'],
  effectiveFrom: '2025-03-01',
  effectiveTo: '2026-02-28',
  sourceIds: ['src-official'],
};
export const schedule2027: TariffSchedule = {
  id: 'sched-2027',
  name: '2027',
  operatorIds: ['op-a'],
  effectiveFrom: '2027-03-01',
  effectiveTo: null,
  sourceIds: ['src-official'],
};

export function dataset(parts: Partial<Dataset> = {}): Dataset {
  return {
    schemaVersion: 1,
    datasetVersion: '2026-06-15.1',
    generatedAt: '2026-06-15T00:00:00Z',
    country: 'ZA',
    sources: [
      {
        id: 'src-official',
        title: 'Official gazette',
        publisher: 'Gov',
        url: 'https://example.gov.za/gazette.pdf',
        kind: 'government_gazette',
        official: true,
        retrievedOn: '2026-03-01',
      },
      {
        id: 'src-secondary',
        title: 'Blog table',
        publisher: 'Blog',
        url: 'https://example.com/tolls',
        kind: 'secondary_compilation',
        official: false,
        retrievedOn: '2026-03-01',
      },
    ],
    operators: [
      {
        id: 'op-a',
        name: 'Operator A',
        shortName: 'OPA',
        kind: 'national_agency',
        website: 'https://example.co.za',
        contactStatus: 'verified',
        sourceIds: ['src-official'],
      },
    ],
    tollRoads: [
      {
        id: 'road-a',
        name: 'Road A',
        routes: ['N9'],
        operatorId: 'op-a',
        provinces: ['GP'],
        sourceIds: ['src-official'],
      },
    ],
    vehicleClassSchemes: [
      {
        id: 'za-standard',
        name: 'Standard',
        classes: ['class1', 'class2', 'class3', 'class4'].map((id) => ({
          id,
          label: id,
          shortDescription: id,
          description: id,
        })),
        fromStandard: { class1: 'class1', class2: 'class2', class3: 'class3', class4: 'class4' },
        sourceIds: ['src-official'],
      },
      {
        id: 'scenic',
        name: 'Scenic road classes',
        classes: [
          { id: 'sc-moto', label: 'Motorcycle', shortDescription: 'Moto', description: 'Moto' },
          { id: 'sc-light', label: 'Light', shortDescription: 'Light', description: 'Light' },
        ],
        fromStandard: { class1: 'sc-light' },
        sourceIds: ['src-official'],
      },
    ],
    plazas: [],
    schedules: [schedule2025, schedule2026, schedule2027],
    tariffs: [],
    journeys: [],
    notices: [],
    ...parts,
  };
}
