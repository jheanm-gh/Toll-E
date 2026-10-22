import { daysBetween, isWithin } from './dates';
import type {
  Dataset,
  ISODate,
  Plaza,
  StandardClassId,
  Tariff,
  TariffSchedule,
  TravelDirection,
  VehicleClassScheme,
} from './model';

/**
 * How far a displayed price can be trusted. These five states are used consistently by the
 * data model, the calculator and every screen:
 *
 * - `confirmed`     verified by a person, recently, and no newer schedule is expected yet
 * - `stale`         verified, but the verification is old or a scheduled adjustment date has passed
 * - `unverified`    from a cited source, not yet checked by a person
 * - `under_review`  flagged: sources conflict or an automated check found a suspicious value
 * - `illustrative`  demonstration data (never mixed with real totals)
 *
 * "Unavailable" is represented by the absence of a current tariff (see `TariffResolution`).
 */
export type Trust = 'confirmed' | 'stale' | 'unverified' | 'under_review' | 'illustrative';

/** Verified data older than this is treated as potentially stale. */
export const STALE_AFTER_DAYS = 365;

const TRUST_RANK: Record<Trust, number> = {
  illustrative: 0,
  under_review: 1,
  unverified: 2,
  stale: 3,
  confirmed: 4,
};

export function weakestTrust(values: readonly Trust[]): Trust | null {
  let worst: Trust | null = null;
  for (const t of values) if (worst === null || TRUST_RANK[t] < TRUST_RANK[worst]) worst = t;
  return worst;
}

export function assessTrust(
  tariff: Tariff,
  schedule: TariffSchedule | undefined,
  today: ISODate,
): { trust: Trust; possiblySuperseded: boolean } {
  const possiblySuperseded =
    !!schedule?.nextReviewExpected &&
    schedule.effectiveTo === null &&
    tariff.effectiveTo === null &&
    today >= schedule.nextReviewExpected;

  switch (tariff.verificationStatus) {
    case 'illustrative':
      return { trust: 'illustrative', possiblySuperseded };
    case 'pending_review':
      return { trust: 'under_review', possiblySuperseded };
    case 'unverified':
      return { trust: 'unverified', possiblySuperseded };
    case 'verified': {
      const old = tariff.verifiedOn === null || daysBetween(tariff.verifiedOn, today) > STALE_AFTER_DAYS;
      return { trust: old || possiblySuperseded ? 'stale' : 'confirmed', possiblySuperseded };
    }
  }
}

export type TariffResolution =
  | {
      kind: 'current';
      tariff: Tariff;
      trust: Trust;
      /** A scheduled adjustment date has passed without a newer schedule being loaded. */
      possiblySuperseded: boolean;
      upcoming: Tariff | null;
    }
  | {
      kind: 'none';
      reason:
        | 'class_not_supported'
        | 'no_tariff_for_class'
        /** Tariffs exist only for other directions; the plaza may not charge this way. */
        | 'no_tariff_in_direction'
        | 'expired'
        | 'not_yet_effective'
        | 'plaza_inactive';
      latestExpired: Tariff | null;
      upcoming: Tariff | null;
    }
  | {
      kind: 'ambiguous';
      reason: 'direction_required' | 'overlapping_tariffs';
      candidates: Tariff[];
    };

export interface TariffIndex {
  byPlaza: Map<string, Tariff[]>;
  schedules: Map<string, TariffSchedule>;
  schemes: Map<string, VehicleClassScheme>;
  plazas: Map<string, Plaza>;
}

export function buildTariffIndex(dataset: Dataset): TariffIndex {
  const byPlaza = new Map<string, Tariff[]>();
  for (const t of dataset.tariffs) {
    const list = byPlaza.get(t.plazaId);
    if (list) list.push(t);
    else byPlaza.set(t.plazaId, [t]);
  }
  return {
    byPlaza,
    schedules: new Map(dataset.schedules.map((s) => [s.id, s])),
    schemes: new Map(dataset.vehicleClassSchemes.map((s) => [s.id, s])),
    plazas: new Map(dataset.plazas.map((p) => [p.id, p])),
  };
}

export interface ResolveOptions {
  date: ISODate;
  /** Direction of travel through the plaza, when known. */
  direction?: TravelDirection;
  /** Include drafts (admin preview only). Consumers only ever see published tariffs. */
  includeDrafts?: boolean;
  /** Include illustrative records (demo mode only). */
  includeIllustrative?: boolean;
}

/** Map a user's standard vehicle class to the class id used at a particular plaza. */
export function classForPlaza(index: TariffIndex, plaza: Plaza, standardClass: StandardClassId): string | null {
  const scheme = index.schemes.get(plaza.classSchemeId);
  if (!scheme) return null;
  return scheme.fromStandard[standardClass] ?? null;
}

function isVisible(t: Tariff, opts: ResolveOptions): boolean {
  if (t.publicationStatus === 'withdrawn') return false;
  if (t.publicationStatus === 'draft' && !opts.includeDrafts) return false;
  if (t.verificationStatus === 'illustrative' && !opts.includeIllustrative) return false;
  return true;
}

/**
 * Select the tariff in force at a plaza for a vehicle class on a date.
 *
 * Rules (each is covered by tests):
 * - A tariff applies only on dates within its inclusive effective range.
 * - A future tariff is never returned as current; it is reported as `upcoming`.
 * - An expired tariff is never returned as current, even if it is the newest record.
 * - Overlapping applicable tariffs are reported as ambiguous instead of guessing.
 * - Direction-specific tariffs need a travel direction.
 */
export function resolveTariff(
  index: TariffIndex,
  plazaId: string,
  vehicleClassId: string,
  opts: ResolveOptions,
): TariffResolution {
  const plaza = index.plazas.get(plazaId);
  if (plaza && plaza.status !== 'active') {
    return { kind: 'none', reason: 'plaza_inactive', latestExpired: null, upcoming: null };
  }
  const all = (index.byPlaza.get(plazaId) ?? []).filter(
    (t) => t.vehicleClassId === vehicleClassId && isVisible(t, opts),
  );
  const matchingDirection = all.filter(
    (t) => opts.direction === undefined || t.direction === 'any' || t.direction === opts.direction,
  );

  const active = matchingDirection.filter((t) => isWithin(opts.date, t.effectiveFrom, t.effectiveTo));
  const future = matchingDirection
    .filter((t) => t.effectiveFrom > opts.date)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const upcoming = future[0] ?? null;

  if (active.length === 0) {
    const past = matchingDirection
      .filter((t) => t.effectiveTo !== null && t.effectiveTo < opts.date)
      .sort((a, b) => (b.effectiveTo ?? '').localeCompare(a.effectiveTo ?? ''));
    const latestExpired = past[0] ?? null;
    if (all.length === 0) {
      return { kind: 'none', reason: 'no_tariff_for_class', latestExpired: null, upcoming: null };
    }
    if (matchingDirection.length === 0) {
      return { kind: 'none', reason: 'no_tariff_in_direction', latestExpired: null, upcoming: null };
    }
    return {
      kind: 'none',
      reason: latestExpired ? 'expired' : upcoming ? 'not_yet_effective' : 'no_tariff_for_class',
      latestExpired,
      upcoming,
    };
  }

  if (active.length > 1) {
    const directions = new Set(active.map((t) => t.direction));
    const directionSpecific = active.every((t) => t.direction !== 'any');
    if (opts.direction === undefined && directionSpecific && directions.size === active.length) {
      return { kind: 'ambiguous', reason: 'direction_required', candidates: active };
    }
    return { kind: 'ambiguous', reason: 'overlapping_tariffs', candidates: active };
  }

  const tariff = active[0]!;
  if (opts.direction === undefined && tariff.direction !== 'any') {
    return { kind: 'ambiguous', reason: 'direction_required', candidates: active };
  }
  const { trust, possiblySuperseded } = assessTrust(tariff, index.schedules.get(tariff.scheduleId), opts.date);
  return { kind: 'current', tariff, trust, possiblySuperseded, upcoming };
}

/** Resolve using a standard class, applying the plaza's class-scheme mapping. */
export function resolveStandardTariff(
  index: TariffIndex,
  plazaId: string,
  standardClass: StandardClassId,
  opts: ResolveOptions,
): TariffResolution & { vehicleClassId: string | null } {
  const plaza = index.plazas.get(plazaId);
  const classId = plaza ? classForPlaza(index, plaza, standardClass) : null;
  if (!classId) {
    return {
      kind: 'none',
      reason: 'class_not_supported',
      latestExpired: null,
      upcoming: null,
      vehicleClassId: null,
    };
  }
  return { ...resolveTariff(index, plazaId, classId, opts), vehicleClassId: classId };
}

/** All tariffs for a plaza/class, newest first — the plaza's tariff history. */
export function tariffHistory(
  index: TariffIndex,
  plazaId: string,
  vehicleClassId: string,
  opts: Pick<ResolveOptions, 'includeDrafts' | 'includeIllustrative'> = {},
): Tariff[] {
  return (index.byPlaza.get(plazaId) ?? [])
    .filter((t) => t.vehicleClassId === vehicleClassId && isVisible(t, { date: '0000-00-00', ...opts }))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
}

/** The tariff that applied on a past date — used for historical lookups. */
export function historicalTariff(
  index: TariffIndex,
  plazaId: string,
  vehicleClassId: string,
  date: ISODate,
): Tariff | null {
  const r = resolveTariff(index, plazaId, vehicleClassId, { date });
  return r.kind === 'current' ? r.tariff : null;
}
