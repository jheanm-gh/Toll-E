import { isISODate, rangesOverlap } from './dates';
import { PROVINCE_BBOX, SOUTH_AFRICA_BBOX, haversineMetres, inBBox, isValidCoordinate } from './geo';
import { applyBps } from './money';
import type { Dataset, Tariff } from './model';
import { parseDataset } from './schema';

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
  | 'schema_invalid'
  | 'duplicate_id'
  | 'missing_reference'
  | 'missing_source'
  | 'invalid_coordinates'
  | 'location_outside_south_africa'
  | 'location_outside_province'
  | 'possible_duplicate_plaza'
  | 'invalid_price'
  | 'implausible_price'
  | 'class_not_in_scheme'
  | 'invalid_date_range'
  | 'overlapping_tariffs'
  | 'outside_schedule'
  | 'incomplete_class_coverage'
  | 'class_order_violation'
  | 'suspicious_change'
  | 'verified_without_verifier'
  | 'verified_against_secondary_source'
  | 'checked_in_future'
  | 'illustrative_published'
  | 'journey_duplicate_event'
  | 'journey_inactive_plaza'
  | 'incomplete_operator'
  | 'insecure_source_url';

export type EntityKind =
  'dataset' | 'source' | 'operator' | 'toll_road' | 'scheme' | 'plaza' | 'schedule' | 'tariff' | 'journey' | 'notice';

export interface DataIssue {
  severity: IssueSeverity;
  code: IssueCode;
  entity: EntityKind;
  id: string;
  message: string;
}

export interface ValidationOptions {
  /** "Today" in SA local time; used for date sanity checks. */
  today: string;
  /** Allow illustrative records to be published (demo datasets only). */
  allowIllustrative?: boolean;
}

/** Highest plausible tariff for any class at a single plaza (R2 000). */
export const MAX_PLAUSIBLE_CENTS = 200_000;
/** Above this, a light-vehicle (class 1) tariff is flagged for review (R250). */
export const MAX_PLAUSIBLE_CLASS1_CENTS = 25_000;
/** Allowed deviation from a published across-the-board adjustment: max(R1.50, 2%). */
export const ADJUSTMENT_TOLERANCE_CENTS = 150;
export const ADJUSTMENT_TOLERANCE_BPS = 200;
/** Without a published adjustment, a year-on-year change above this is suspicious. */
export const UNEXPLAINED_CHANGE_BPS = 1_500;
/** Plazas closer than this with different ids may be duplicates. */
export const DUPLICATE_DISTANCE_METRES = 300;

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(toll|plaza|mainline|main)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function validateDataset(dataset: Dataset, options: ValidationOptions): DataIssue[] {
  const issues: DataIssue[] = [];
  const add = (severity: IssueSeverity, code: IssueCode, entity: EntityKind, id: string, message: string) =>
    issues.push({ severity, code, entity, id, message });

  // ---- unique ids -------------------------------------------------------------------------
  const collections: [EntityKind, { id: string }[]][] = [
    ['source', dataset.sources],
    ['operator', dataset.operators],
    ['toll_road', dataset.tollRoads],
    ['scheme', dataset.vehicleClassSchemes],
    ['plaza', dataset.plazas],
    ['schedule', dataset.schedules],
    ['tariff', dataset.tariffs],
    ['journey', dataset.journeys],
    ['notice', dataset.notices],
  ];
  for (const [entity, items] of collections) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) add('error', 'duplicate_id', entity, item.id, `duplicate ${entity} id`);
      seen.add(item.id);
    }
  }

  const sources = new Map(dataset.sources.map((s) => [s.id, s]));
  const operators = new Map(dataset.operators.map((o) => [o.id, o]));
  const roads = new Map(dataset.tollRoads.map((r) => [r.id, r]));
  const schemes = new Map(dataset.vehicleClassSchemes.map((s) => [s.id, s]));
  const plazas = new Map(dataset.plazas.map((p) => [p.id, p]));
  const schedules = new Map(dataset.schedules.map((s) => [s.id, s]));

  const checkSources = (entity: EntityKind, id: string, ids: readonly string[], required: boolean) => {
    if (required && ids.length === 0) add('error', 'missing_source', entity, id, 'no source cited');
    for (const sid of ids) {
      if (!sources.has(sid)) add('error', 'missing_reference', entity, id, `unknown source "${sid}"`);
    }
  };

  // ---- sources ----------------------------------------------------------------------------
  for (const s of dataset.sources) {
    if (!s.url.startsWith('https://')) {
      add('warning', 'insecure_source_url', 'source', s.id, 'source URL is not https');
    }
    if (s.retrievedOn > options.today) {
      add('error', 'checked_in_future', 'source', s.id, `retrievedOn ${s.retrievedOn} is in the future`);
    }
  }

  // ---- operators --------------------------------------------------------------------------
  for (const o of dataset.operators) {
    checkSources('operator', o.id, o.sourceIds, true);
    if (o.payment) checkSources('operator', o.id, o.payment.sourceIds, true);
    if (!o.website && !o.phone && !o.email) {
      add('warning', 'incomplete_operator', 'operator', o.id, 'no website or contact details');
    }
  }

  // ---- toll roads -------------------------------------------------------------------------
  for (const r of dataset.tollRoads) {
    if (!operators.has(r.operatorId)) {
      add('error', 'missing_reference', 'toll_road', r.id, `unknown operator "${r.operatorId}"`);
    }
    checkSources('toll_road', r.id, r.sourceIds, false);
  }

  // ---- plazas -----------------------------------------------------------------------------
  for (const p of dataset.plazas) {
    if (!operators.has(p.operatorId)) {
      add('error', 'missing_reference', 'plaza', p.id, `unknown operator "${p.operatorId}"`);
    }
    const road = roads.get(p.tollRoadId);
    if (!road) add('error', 'missing_reference', 'plaza', p.id, `unknown toll road "${p.tollRoadId}"`);
    else if (!road.routes.includes(p.route)) {
      add('warning', 'missing_reference', 'plaza', p.id, `route ${p.route} is not on toll road ${road.id}`);
    }
    if (!schemes.has(p.classSchemeId)) {
      add('error', 'missing_reference', 'plaza', p.id, `unknown class scheme "${p.classSchemeId}"`);
    }
    checkSources('plaza', p.id, p.sourceIds, true);
    if (p.location) {
      checkSources('plaza', p.id, p.location.sourceIds, true);
      if (!isValidCoordinate(p.location)) {
        add('error', 'invalid_coordinates', 'plaza', p.id, 'coordinates out of range');
      } else if (!inBBox(p.location, SOUTH_AFRICA_BBOX)) {
        add('error', 'location_outside_south_africa', 'plaza', p.id, 'location is outside South Africa');
      } else if (p.province && !inBBox(p.location, PROVINCE_BBOX[p.province])) {
        add(
          'warning',
          'location_outside_province',
          'plaza',
          p.id,
          `location is outside the expected bounds for ${p.province}`,
        );
      }
    }
  }
  // possible duplicates: same normalised name on the same route and type, or very close together
  const plazaList = dataset.plazas.filter((p) => p.publicationStatus !== 'withdrawn');
  for (let i = 0; i < plazaList.length; i++) {
    for (let j = i + 1; j < plazaList.length; j++) {
      const a = plazaList[i]!;
      const b = plazaList[j]!;
      const sameName = normalise(a.name) === normalise(b.name) && a.route === b.route && a.type === b.type;
      const close = a.location && b.location && haversineMetres(a.location, b.location) < DUPLICATE_DISTANCE_METRES;
      if (sameName || close) {
        add(
          'warning',
          'possible_duplicate_plaza',
          'plaza',
          b.id,
          `may duplicate ${a.id} (${sameName ? 'same name and route' : 'within 300 m'})`,
        );
      }
    }
  }

  // ---- schedules --------------------------------------------------------------------------
  for (const s of dataset.schedules) {
    checkSources('schedule', s.id, s.sourceIds, true);
    if (s.effectiveTo !== null && s.effectiveTo < s.effectiveFrom) {
      add('error', 'invalid_date_range', 'schedule', s.id, 'effectiveTo is before effectiveFrom');
    }
    for (const oid of s.operatorIds) {
      if (!operators.has(oid)) add('error', 'missing_reference', 'schedule', s.id, `unknown operator "${oid}"`);
    }
  }

  // ---- tariffs ----------------------------------------------------------------------------
  for (const t of dataset.tariffs) {
    const plaza = plazas.get(t.plazaId);
    if (!plaza) {
      add('error', 'missing_reference', 'tariff', t.id, `unknown plaza "${t.plazaId}"`);
      continue;
    }
    const scheme = schemes.get(plaza.classSchemeId);
    if (scheme && !scheme.classes.some((c) => c.id === t.vehicleClassId)) {
      add('error', 'class_not_in_scheme', 'tariff', t.id, `class "${t.vehicleClassId}" is not in scheme ${scheme.id}`);
    }
    const source = sources.get(t.sourceId);
    if (!source) add('error', 'missing_source', 'tariff', t.id, `unknown source "${t.sourceId}"`);
    const schedule = schedules.get(t.scheduleId);
    if (!schedule) {
      add('error', 'missing_reference', 'tariff', t.id, `unknown schedule "${t.scheduleId}"`);
    }
    if (!Number.isSafeInteger(t.amountCents) || t.amountCents <= 0 || t.amountCents > MAX_PLAUSIBLE_CENTS) {
      add('error', 'invalid_price', 'tariff', t.id, `amount ${t.amountCents} cents is not a valid tariff`);
    } else if (t.vehicleClassId === 'class1' && t.amountCents > MAX_PLAUSIBLE_CLASS1_CENTS) {
      add('warning', 'implausible_price', 'tariff', t.id, 'unusually high light-vehicle tariff');
    }
    if (!isISODate(t.effectiveFrom) || (t.effectiveTo !== null && !isISODate(t.effectiveTo))) {
      add('error', 'invalid_date_range', 'tariff', t.id, 'invalid effective date');
    } else if (t.effectiveTo !== null && t.effectiveTo < t.effectiveFrom) {
      add('error', 'invalid_date_range', 'tariff', t.id, 'effectiveTo is before effectiveFrom');
    }
    if (
      schedule &&
      (t.effectiveFrom < schedule.effectiveFrom ||
        (schedule.effectiveTo !== null && (t.effectiveTo === null || t.effectiveTo > schedule.effectiveTo)))
    ) {
      add('warning', 'outside_schedule', 'tariff', t.id, `dates fall outside schedule ${schedule.id}`);
    }
    if (t.checkedOn > options.today) {
      add('error', 'checked_in_future', 'tariff', t.id, `checkedOn ${t.checkedOn} is in the future`);
    }
    if (t.verificationStatus === 'verified') {
      if (!t.verifiedOn || !t.verifiedBy) {
        add('error', 'verified_without_verifier', 'tariff', t.id, 'verified tariffs need verifiedOn and verifiedBy');
      }
      if (source && !source.official) {
        add(
          'warning',
          'verified_against_secondary_source',
          'tariff',
          t.id,
          'verified against a non-official source; cite the Gazette or the operator',
        );
      }
    }
    if (t.verificationStatus === 'illustrative' && t.publicationStatus === 'published' && !options.allowIllustrative) {
      add('error', 'illustrative_published', 'tariff', t.id, 'illustrative data must not be published');
    }
  }

  // overlapping published tariffs for the same plaza/class/direction
  const groups = new Map<string, Tariff[]>();
  for (const t of dataset.tariffs) {
    if (t.publicationStatus !== 'published') continue;
    const key = `${t.plazaId}|${t.vehicleClassId}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const directionsClash = a.direction === 'any' || b.direction === 'any' || a.direction === b.direction;
        if (directionsClash && rangesOverlap(a.effectiveFrom, a.effectiveTo, b.effectiveFrom, b.effectiveTo)) {
          add('error', 'overlapping_tariffs', 'tariff', b.id, `overlaps ${a.id}`);
        }
      }
    }
    // suspicious changes between consecutive tariffs in the same direction
    const byDirection = new Map<string, Tariff[]>();
    for (const t of list) {
      const l = byDirection.get(t.direction);
      if (l) l.push(t);
      else byDirection.set(t.direction, [t]);
    }
    for (const series of byDirection.values()) {
      series.sort((x, y) => x.effectiveFrom.localeCompare(y.effectiveFrom));
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1]!;
        const cur = series[i]!;
        const message = suspiciousChange(prev, cur, schedules.get(cur.scheduleId)?.adjustmentBps);
        if (message) add('warning', 'suspicious_change', 'tariff', cur.id, message);
      }
    }
  }

  // class coverage and ordering per plaza and schedule
  const byPlazaSchedule = new Map<string, Tariff[]>();
  for (const t of dataset.tariffs) {
    if (t.publicationStatus === 'withdrawn') continue;
    const key = `${t.plazaId}|${t.scheduleId}|${t.direction}`;
    const l = byPlazaSchedule.get(key);
    if (l) l.push(t);
    else byPlazaSchedule.set(key, [t]);
  }
  for (const [key, list] of byPlazaSchedule) {
    const [plazaId, scheduleId] = key.split('|') as [string, string];
    const plaza = plazas.get(plazaId);
    const scheme = plaza ? schemes.get(plaza.classSchemeId) : undefined;
    if (!plaza || !scheme) continue;
    const present = new Set(list.map((t) => t.vehicleClassId));
    const missing = scheme.classes.filter((c) => !present.has(c.id)).map((c) => c.label);
    if (missing.length > 0) {
      add(
        'warning',
        'incomplete_class_coverage',
        'plaza',
        plazaId,
        `${scheduleId}: no tariff for ${missing.join(', ')}`,
      );
    }
    if (scheme.id === 'za-standard') {
      const amounts = scheme.classes
        .map((c) => list.find((t) => t.vehicleClassId === c.id)?.amountCents)
        .filter((v): v is number => v !== undefined);
      for (let i = 1; i < amounts.length; i++) {
        if (amounts[i]! < amounts[i - 1]!) {
          add(
            'warning',
            'class_order_violation',
            'plaza',
            plazaId,
            `${scheduleId}: a heavier class costs less than a lighter one`,
          );
          break;
        }
      }
    }
  }

  // ---- journeys ---------------------------------------------------------------------------
  for (const j of dataset.journeys) {
    checkSources('journey', j.id, j.sourceIds, false);
    if (j.sequenceStatus === 'verified' && (!j.sequenceVerifiedOn || !j.sequenceVerifiedBy)) {
      add(
        'error',
        'verified_without_verifier',
        'journey',
        j.id,
        'verified sequences need sequenceVerifiedOn and sequenceVerifiedBy',
      );
    }
    for (const [leg, events] of [
      ['outbound', j.events],
      ['return', j.returnEvents ?? []],
    ] as const) {
      const seen = new Set<string>();
      for (const e of events) {
        const plaza = plazas.get(e.plazaId);
        if (!plaza) {
          add('error', 'missing_reference', 'journey', j.id, `unknown plaza "${e.plazaId}" (${leg})`);
          continue;
        }
        if (plaza.status !== 'active') {
          add('warning', 'journey_inactive_plaza', 'journey', j.id, `${e.plazaId} is not active`);
        }
        if (seen.has(e.plazaId)) {
          add('error', 'journey_duplicate_event', 'journey', j.id, `${e.plazaId} appears twice in the ${leg} leg`);
        }
        seen.add(e.plazaId);
      }
    }
  }

  // ---- notices ----------------------------------------------------------------------------
  for (const n of dataset.notices) checkSources('notice', n.id, n.sourceIds, false);

  return issues;
}

/** Explain why a change between two consecutive tariffs looks wrong, or return null. */
export function suspiciousChange(prev: Tariff, cur: Tariff, adjustmentBps?: number): string | null {
  if (adjustmentBps !== undefined) {
    const expected = applyBps(prev.amountCents, adjustmentBps);
    const tolerance = Math.max(ADJUSTMENT_TOLERANCE_CENTS, Math.round((expected * ADJUSTMENT_TOLERANCE_BPS) / 10_000));
    if (Math.abs(cur.amountCents - expected) > tolerance) {
      return `changed from ${prev.amountCents} to ${cur.amountCents} cents; the published ${(
        adjustmentBps / 100
      ).toFixed(2)}% adjustment implies about ${expected}`;
    }
    return null;
  }
  const changeBps = Math.round(((cur.amountCents - prev.amountCents) * 10_000) / prev.amountCents);
  if (Math.abs(changeBps) > UNEXPLAINED_CHANGE_BPS) {
    return `changed by ${(changeBps / 100).toFixed(1)}% with no published adjustment to explain it`;
  }
  return null;
}

export function hasErrors(issues: readonly DataIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

/**
 * Parse and validate untrusted input in one step. Used by the app before accepting remote
 * data and by the CLI. Returns structural errors as `schema_invalid` issues.
 */
export function parseAndValidate(
  input: unknown,
  options: ValidationOptions,
): { dataset: Dataset | null; issues: DataIssue[] } {
  const parsed = parseDataset(input);
  if (!parsed.ok) {
    return {
      dataset: null,
      issues: parsed.errors.map((message) => ({
        severity: 'error' as const,
        code: 'schema_invalid' as const,
        entity: 'dataset' as const,
        id: '(dataset)',
        message,
      })),
    };
  }
  return { dataset: parsed.value, issues: validateDataset(parsed.value, options) };
}
