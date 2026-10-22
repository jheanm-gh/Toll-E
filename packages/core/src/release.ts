import { calculate, journeyInput } from './calculator';
import { STANDARD_CLASSES } from './coverage';
import type { Dataset, ISODate, Journey, StandardClassId } from './model';
import { buildTariffIndex, resolveStandardTariff, type Trust } from './tariffs';
import { validateDataset } from './validation';

/**
 * The data criteria a public release must meet (scope update, MVP section a/b):
 * - every published plaza has a verified current tariff, from an official source, for every
 *   vehicle class it supports;
 * - every published journey has a verified plaza sequence;
 * - no validation errors and no illustrative data.
 * Anything failing is listed so it can be verified, corrected or unpublished.
 */

/**
 * The journeys a build may offer. Production builds offer only journeys whose full plaza
 * sequence a person has verified; test builds may also offer unverified ones, which the app
 * labels as such.
 */
export function offeredJourneys(journeys: Journey[], opts: { includeUnverifiedSequences: boolean }): Journey[] {
  return journeys.filter(
    (j) => j.publicationStatus === 'published' && (opts.includeUnverifiedSequences || j.sequenceStatus === 'verified'),
  );
}

export interface ReleaseGap {
  kind:
    'tariff_missing' | 'tariff_not_verified' | 'tariff_secondary_source' | 'journey_unverified' | 'validation_error';
  id: string;
  detail: string;
}

export interface CorridorCoverage {
  journeyId: string;
  name: string;
  via: string;
  sequenceVerified: boolean;
  byClass: Record<
    StandardClassId,
    {
      totalCents: number;
      priced: number;
      chargeable: number;
      trust: Trust | null;
      confidence: string;
    }
  >;
}

export interface ReleaseReport {
  ready: boolean;
  date: ISODate;
  gaps: ReleaseGap[];
  plazaClassSlots: number;
  verifiedSlots: number;
  corridors: CorridorCoverage[];
}

export function releaseReadiness(dataset: Dataset, date: ISODate): ReleaseReport {
  const index = buildTariffIndex(dataset);
  const sources = new Map(dataset.sources.map((s) => [s.id, s]));
  const gaps: ReleaseGap[] = [];
  let slots = 0;
  let verified = 0;

  for (const plaza of dataset.plazas) {
    if (plaza.publicationStatus !== 'published' || plaza.status !== 'active') continue;
    for (const c of STANDARD_CLASSES) {
      const r = resolveStandardTariff(index, plaza.id, c, { date });
      if (r.kind === 'none' && r.reason === 'class_not_supported') continue;
      slots++;
      const slot = `${plaza.id} · ${c}`;
      if (r.kind !== 'current') {
        gaps.push({
          kind: 'tariff_missing',
          id: slot,
          detail: r.kind === 'none' ? r.reason : r.reason,
        });
        continue;
      }
      if (r.tariff.verificationStatus !== 'verified') {
        gaps.push({
          kind: 'tariff_not_verified',
          id: slot,
          detail: `${r.tariff.id} is ${r.tariff.verificationStatus}`,
        });
        continue;
      }
      if (!sources.get(r.tariff.sourceId)?.official) {
        gaps.push({
          kind: 'tariff_secondary_source',
          id: slot,
          detail: `${r.tariff.id} cites ${r.tariff.sourceId}`,
        });
        continue;
      }
      verified++;
    }
  }

  const corridors: CorridorCoverage[] = [];
  for (const j of dataset.journeys) {
    if (j.publicationStatus !== 'published') continue;
    if (j.sequenceStatus !== 'verified') {
      gaps.push({
        kind: 'journey_unverified',
        id: j.id,
        detail: `plaza sequence is ${j.sequenceStatus}`,
      });
    }
    const byClass = Object.fromEntries(
      STANDARD_CLASSES.map((c) => {
        const r = calculate(index, journeyInput(j, { trip: 'one_way', standardClass: c, date }));
        return [
          c,
          {
            totalCents: r.totalCents,
            priced: r.pricedCount,
            chargeable: r.chargeableCount,
            trust: r.trust,
            confidence: r.confidence,
          },
        ];
      }),
    ) as CorridorCoverage['byClass'];
    corridors.push({
      journeyId: j.id,
      name: j.name,
      via: j.via,
      sequenceVerified: j.sequenceStatus === 'verified',
      byClass,
    });
  }

  for (const issue of validateDataset(dataset, { today: date })) {
    if (issue.severity === 'error') gaps.push({ kind: 'validation_error', id: issue.id, detail: issue.message });
  }

  return {
    ready: gaps.length === 0,
    date,
    gaps,
    plazaClassSlots: slots,
    verifiedSlots: verified,
    corridors,
  };
}
