import type { CalculationResult, CalculationWarning, ResultConfidence } from './calculator';
import { formatLongDate } from './dates';
import type { PlazaType, StandardClassId, VerificationStatus } from './model';
import type { TariffResolution, Trust } from './tariffs';

/** Shared user-facing wording so the app, admin and docs describe states identically. */

export const TRUST_LABEL: Record<Trust, string> = {
  confirmed: 'Verified current',
  stale: 'Verified · may be out of date',
  unverified: 'Unverified',
  under_review: 'Under review',
  illustrative: 'Illustrative only',
};

export const TRUST_EXPLANATION: Record<Trust, string> = {
  confirmed: 'Checked by Toll-E against the official source and currently in force.',
  stale:
    'Checked against the official source, but the check is old or a scheduled tariff adjustment date has passed. Confirm with the operator.',
  unverified:
    'Taken from the cited source but not yet checked by a person at Toll-E. Confirm with the operator before relying on it.',
  under_review: 'Sources disagree or an automated check flagged this value. Treat it as indicative only.',
  illustrative: 'Demonstration data. Not a real tariff.',
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: 'Verified',
  unverified: 'Unverified',
  pending_review: 'Under review',
  illustrative: 'Illustrative',
};

export const PLAZA_TYPE_LABEL: Record<PlazaType, string> = {
  mainline: 'Mainline plaza',
  ramp: 'Ramp plaza',
  unknown: 'Plaza type not confirmed',
};

export const STANDARD_CLASS_LABEL: Record<StandardClassId, { label: string; short: string; detail: string }> = {
  class1: { label: 'Class 1', short: 'Light vehicle', detail: 'Cars, bakkies, SUVs and other light vehicles' },
  class2: { label: 'Class 2', short: 'Medium heavy', detail: 'Heavy vehicles with 2 axles' },
  class3: { label: 'Class 3', short: 'Large heavy', detail: 'Heavy vehicles with 3 or 4 axles' },
  class4: { label: 'Class 4', short: 'Extra-large heavy', detail: 'Heavy vehicles with 5 or more axles' },
};

export function unavailableReason(r: Extract<TariffResolution, { kind: 'none' }>): string {
  switch (r.reason) {
    case 'class_not_supported':
      return 'This plaza uses a different vehicle classification, and there is no equivalent for this class.';
    case 'no_tariff_for_class':
      return 'Toll-E has no tariff for this vehicle class yet.';
    case 'no_tariff_in_direction':
      return 'No tariff is published for this direction. The plaza may not charge this way — check the source.';
    case 'expired':
      return r.latestExpired?.effectiveTo
        ? `The last tariff Toll-E holds expired on ${formatLongDate(r.latestExpired.effectiveTo)}. A current tariff has not been loaded.`
        : 'The last known tariff has expired.';
    case 'not_yet_effective':
      return r.upcoming
        ? `The announced tariff takes effect on ${formatLongDate(r.upcoming.effectiveFrom)}.`
        : 'No tariff is in force yet.';
    case 'plaza_inactive':
      return 'This plaza is not in operation.';
  }
}

export function ambiguousReason(r: Extract<TariffResolution, { kind: 'ambiguous' }>): string {
  return r.reason === 'direction_required'
    ? 'This plaza charges differently by direction. Choose a direction of travel.'
    : 'More than one tariff applies on this date. Toll-E will not guess — the record needs review.';
}

export const CONFIDENCE_HEADLINE: Record<ResultConfidence, string> = {
  confirmed: 'Total toll cost',
  estimate: 'Estimated toll cost',
  partial: 'Partial total',
  unavailable: 'No price available',
};

export function warningText(w: CalculationWarning, plazaName: (id: string) => string): string {
  const names = (w.plazaIds ?? []).map(plazaName).join(', ');
  switch (w.code) {
    case 'unpriced_events':
      return `No current tariff for: ${names}. These are not included in the total.`;
    case 'ambiguous_events':
      return `Could not determine the charge at: ${names}. These are not included in the total.`;
    case 'excluded_conditional':
      return `Not included unless your route uses them: ${names}.`;
    case 'duplicate_event':
      return `Listed more than once in the same direction and counted once: ${names}.`;
    case 'unverified_tariffs':
      return `Includes tariffs not yet checked by a person: ${names}.`;
    case 'under_review_tariffs':
      return `Includes tariffs under review because sources disagree: ${names}.`;
    case 'stale_tariffs':
      return `Includes tariffs whose verification may be out of date: ${names}.`;
    case 'possibly_superseded':
      return `A scheduled tariff adjustment date has passed for: ${names}. Newer tariffs may apply.`;
    case 'sequence_unverified':
      return 'The list of plazas on this route has not been verified on the road. Check it matches your route.';
    case 'manual_selection':
      return 'Based only on the plazas you selected. Make sure the list matches your route.';
    case 'no_events':
      return 'No toll plazas selected.';
    case 'discounts_not_applied':
      return 'Frequent-user, local-user and e-tag discounts are not applied.';
  }
}

export function resultSummary(result: CalculationResult): string {
  if (result.confidence === 'partial') {
    return `${result.pricedCount} of ${result.chargeableCount} toll plazas priced`;
  }
  return `${result.pricedCount} toll ${result.pricedCount === 1 ? 'plaza' : 'plazas'}`;
}
