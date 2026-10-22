import type { Dataset, ISODate, Plaza, StandardClassId } from './model';
import { buildTariffIndex, resolveStandardTariff, type Trust } from './tariffs';

export const STANDARD_CLASSES: StandardClassId[] = ['class1', 'class2', 'class3', 'class4'];

export type CoverageFlag = 'yes' | 'partial' | 'unverified' | 'no';

export interface PlazaCoverage {
  plaza: Plaza;
  location: CoverageFlag;
  operator: CoverageFlag;
  currentTariff: CoverageFlag;
  classCoverage: { available: number; total: number };
  chargingRules: CoverageFlag;
  payment: CoverageFlag;
  /** Weakest trust among the current tariffs, null when none. */
  tariffTrust: Trust | null;
}

/**
 * Honest coverage per plaza. "yes" means verified; "unverified" means present but not checked;
 * "partial" means some but not all; "no" means missing.
 */
export function computeCoverage(dataset: Dataset, today: ISODate): PlazaCoverage[] {
  const index = buildTariffIndex(dataset);
  const operators = new Map(dataset.operators.map((o) => [o.id, o]));
  return dataset.plazas
    .filter((p) => p.publicationStatus === 'published')
    .map((plaza) => {
      const op = operators.get(plaza.operatorId);
      const resolutions = STANDARD_CLASSES.map((c) => resolveStandardTariff(index, plaza.id, c, { date: today }));
      const current = resolutions.filter((r) => r.kind === 'current');
      const trusts = current.map((r) => (r.kind === 'current' ? r.trust : 'unverified')) as Trust[];
      const confirmed = trusts.filter((t) => t === 'confirmed').length;
      const scheme = dataset.vehicleClassSchemes.find((s) => s.id === plaza.classSchemeId);
      const supported = STANDARD_CLASSES.filter((c) => scheme?.fromStandard[c]).length;

      let currentTariff: CoverageFlag = 'no';
      if (current.length > 0) {
        currentTariff =
          confirmed === current.length ? (current.length === supported ? 'yes' : 'partial') : 'unverified';
      }
      const tariffTrust = trusts.length ? trusts.reduce((worst, t) => (rank(t) < rank(worst) ? t : worst)) : null;

      return {
        plaza,
        location: !plaza.location ? 'no' : plaza.location.precision === 'verified' ? 'yes' : 'unverified',
        operator: !op ? 'no' : op.contactStatus === 'verified' ? 'yes' : 'unverified',
        currentTariff,
        classCoverage: { available: current.length, total: supported },
        chargingRules:
          plaza.type === 'unknown' ? 'no' : confirmed > 0 && confirmed === current.length ? 'yes' : 'unverified',
        payment: !op?.payment ? 'no' : op.payment.status === 'verified' ? 'yes' : 'unverified',
        tariffTrust,
      };
    });
}

function rank(t: Trust): number {
  return { illustrative: 0, under_review: 1, unverified: 2, stale: 3, confirmed: 4 }[t];
}

export interface CoverageSummary {
  plazas: number;
  withLocation: number;
  withVerifiedLocation: number;
  withAnyCurrentTariff: number;
  withCompleteClassCoverage: number;
  withVerifiedCurrentTariff: number;
  tariffsByStatus: Record<string, number>;
}

export function summariseCoverage(dataset: Dataset, today: ISODate): CoverageSummary {
  const rows = computeCoverage(dataset, today);
  const tariffsByStatus: Record<string, number> = {};
  for (const t of dataset.tariffs) {
    if (t.publicationStatus !== 'published') continue;
    tariffsByStatus[t.verificationStatus] = (tariffsByStatus[t.verificationStatus] ?? 0) + 1;
  }
  return {
    plazas: rows.length,
    withLocation: rows.filter((r) => r.location !== 'no').length,
    withVerifiedLocation: rows.filter((r) => r.location === 'yes').length,
    withAnyCurrentTariff: rows.filter((r) => r.classCoverage.available > 0).length,
    withCompleteClassCoverage: rows.filter(
      (r) => r.classCoverage.total > 0 && r.classCoverage.available === r.classCoverage.total,
    ).length,
    withVerifiedCurrentTariff: rows.filter((r) => r.currentTariff === 'yes' || r.currentTariff === 'partial').length,
    tariffsByStatus,
  };
}
