import { parseCsvRecords, toCsv } from './csv';
import { MoneyError, formatZAR, parseRandToCents } from './money';
import type { Dataset, Plaza, Tariff, TariffDirection, VerificationStatus } from './model';
import { tariffSchema } from './schema';
import { validateDataset, type DataIssue } from './validation';

/**
 * Structured-file imports.
 *
 * Tariff CSV columns (header row required; lines starting with # are comments):
 *   plaza_id, vehicle_class, amount, schedule_id, effective_from, effective_to,
 *   direction, condition, verification_status, publication_status, source_id,
 *   source_locator, checked_on, verified_on, verified_by, notes
 *
 * `amount` is written in rand as published ("54.50" or "R54.50") and converted to integer cents.
 */

export const TARIFF_CSV_COLUMNS = [
  'plaza_id',
  'vehicle_class',
  'amount',
  'schedule_id',
  'effective_from',
  'effective_to',
  'direction',
  'condition',
  'verification_status',
  'publication_status',
  'source_id',
  'source_locator',
  'checked_on',
  'verified_on',
  'verified_by',
  'notes',
] as const;

export interface RowError {
  row: number;
  message: string;
}

export function tariffId(t: Pick<Tariff, 'scheduleId' | 'plazaId' | 'vehicleClassId' | 'direction'>): string {
  return [t.scheduleId, t.plazaId, t.vehicleClassId, t.direction === 'any' ? null : t.direction]
    .filter(Boolean)
    .join('-');
}

export function parseTariffCsv(
  text: string,
  defaults: { publicationStatus?: Tariff['publicationStatus'] } = {},
): { tariffs: Tariff[]; errors: RowError[] } {
  const { header, records } = parseCsvRecords(text);
  const errors: RowError[] = [];
  const required = ['plaza_id', 'vehicle_class', 'amount', 'schedule_id', 'effective_from', 'source_id', 'checked_on'];
  const missingCols = required.filter((c) => !header.includes(c));
  if (missingCols.length) {
    return { tariffs: [], errors: [{ row: 1, message: `missing columns: ${missingCols.join(', ')}` }] };
  }
  const tariffs: Tariff[] = [];
  records.forEach((r, i) => {
    const rowNo = i + 2;
    let amountCents: number;
    try {
      amountCents = parseRandToCents(r.amount ?? '');
    } catch (e) {
      errors.push({ row: rowNo, message: e instanceof MoneyError ? e.message : 'invalid amount' });
      return;
    }
    const direction = (r.direction || 'any') as TariffDirection;
    const candidate = {
      id: '',
      plazaId: r.plaza_id ?? '',
      vehicleClassId: r.vehicle_class ?? '',
      amountCents,
      currency: 'ZAR' as const,
      vatInclusive: true,
      chargingBasis: 'per_passage' as const,
      direction,
      ...(r.condition ? { condition: r.condition } : {}),
      effectiveFrom: r.effective_from ?? '',
      effectiveTo: r.effective_to ? r.effective_to : null,
      scheduleId: r.schedule_id ?? '',
      sourceId: r.source_id ?? '',
      ...(r.source_locator ? { sourceLocator: r.source_locator } : {}),
      checkedOn: r.checked_on ?? '',
      verifiedOn: r.verified_on ? r.verified_on : null,
      verifiedBy: r.verified_by ? r.verified_by : null,
      verificationStatus: (r.verification_status || 'unverified') as VerificationStatus,
      publicationStatus: (r.publication_status || defaults.publicationStatus || 'draft') as Tariff['publicationStatus'],
      ...(r.notes ? { notes: r.notes } : {}),
    };
    candidate.id = tariffId(candidate);
    const parsed = tariffSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        row: rowNo,
        message: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; '),
      });
      return;
    }
    tariffs.push(parsed.data as Tariff);
  });
  return { tariffs, errors };
}

export function tariffsToCsv(tariffs: readonly Tariff[]): string {
  return toCsv(
    TARIFF_CSV_COLUMNS,
    tariffs.map((t) => [
      t.plazaId,
      t.vehicleClassId,
      formatZAR(t.amountCents).replace(/^R/, '').replace(/ /g, ''),
      t.scheduleId,
      t.effectiveFrom,
      t.effectiveTo ?? '',
      t.direction,
      t.condition ?? '',
      t.verificationStatus,
      t.publicationStatus,
      t.sourceId,
      t.sourceLocator ?? '',
      t.checkedOn,
      t.verifiedOn ?? '',
      t.verifiedBy ?? '',
      t.notes ?? '',
    ]),
  );
}

// ---- import review ------------------------------------------------------------------------

export type ImportAction =
  /** New record. Added as a draft for review. */
  | 'create'
  /** Identical to what we have. Nothing to do. */
  | 'unchanged'
  /** Changes a draft record. Applied to the draft. */
  | 'update_draft'
  /**
   * Changes a published record. Never applied automatically: a reviewer must approve it,
   * and approval withdraws the old record (kept for history) and adds a corrected one.
   */
  | 'propose_correction'
  /** Cannot be imported (validation error). */
  | 'reject';

const VALUE_FIELDS: (keyof Tariff)[] = [
  'amountCents',
  'vehicleClassId',
  'direction',
  'condition',
  'effectiveFrom',
  'effectiveTo',
  'scheduleId',
  'sourceId',
  'sourceLocator',
];

export interface TariffImportItem {
  action: ImportAction;
  incoming: Tariff;
  existing: Tariff | null;
  changedFields: (keyof Tariff)[];
  issues: DataIssue[];
  /** Set when an incoming "verified" status was downgraded (verification cannot be imported). */
  verificationDowngraded: boolean;
}

export interface TariffImportReview {
  items: TariffImportItem[];
  counts: Record<ImportAction, number>;
  /** Dataset-level issues introduced by the import (overlaps, suspicious changes, ...). */
  issues: DataIssue[];
}

/**
 * Compare incoming tariffs with the current dataset and decide what may happen to each.
 * Nothing is applied here; see `applyTariffImport`.
 */
export function reviewTariffImport(
  current: Dataset,
  incoming: readonly Tariff[],
  options: { today: string },
): TariffImportReview {
  const existingById = new Map(current.tariffs.map((t) => [t.id, t]));
  const items: TariffImportItem[] = incoming.map((raw) => {
    const verificationDowngraded = raw.verificationStatus === 'verified';
    const t: Tariff = {
      ...raw,
      publicationStatus: 'draft',
      ...(verificationDowngraded
        ? { verificationStatus: 'unverified' as const, verifiedOn: null, verifiedBy: null }
        : {}),
    };
    const existing = existingById.get(t.id) ?? null;
    if (!existing) {
      return { action: 'create', incoming: t, existing, changedFields: [], issues: [], verificationDowngraded };
    }
    const changedFields = VALUE_FIELDS.filter((f) => existing[f] !== t[f]);
    if (changedFields.length === 0) {
      return { action: 'unchanged', incoming: t, existing, changedFields, issues: [], verificationDowngraded };
    }
    return {
      action: existing.publicationStatus === 'draft' ? 'update_draft' : 'propose_correction',
      incoming: t,
      existing,
      changedFields,
      issues: [],
      verificationDowngraded,
    };
  });

  // Validate the dataset as it would look with creates and draft updates applied, treating the
  // incoming rows as published so overlap and change checks run against live data.
  const preview = withTariffs(
    current,
    items
      .filter((i) => i.action === 'create' || i.action === 'update_draft')
      .map((i) => ({ ...i.incoming, publicationStatus: 'published' as const })),
  );
  const before = new Set(validateDataset(current, options).map((i) => `${i.code}|${i.id}|${i.message}`));
  const introduced = validateDataset(preview, options).filter((i) => !before.has(`${i.code}|${i.id}|${i.message}`));
  for (const item of items) {
    item.issues = introduced.filter((i) => i.id === item.incoming.id || i.message.includes(item.incoming.id));
    if (item.issues.some((i) => i.severity === 'error')) item.action = 'reject';
  }
  const counts: Record<ImportAction, number> = {
    create: 0,
    unchanged: 0,
    update_draft: 0,
    propose_correction: 0,
    reject: 0,
  };
  for (const item of items) counts[item.action]++;
  return { items, counts, issues: introduced };
}

function withTariffs(dataset: Dataset, tariffs: readonly Tariff[]): Dataset {
  const replaced = new Map(tariffs.map((t) => [t.id, t]));
  return {
    ...dataset,
    tariffs: [...dataset.tariffs.filter((t) => !replaced.has(t.id)), ...tariffs],
  };
}

/**
 * Apply a reviewed import. Creates and draft updates are added as drafts. Corrections to
 * published records are applied only when listed in `approvedCorrections`; the old record is
 * withdrawn (never deleted) and a corrected revision is added as a draft for publication.
 */
export function applyTariffImport(
  current: Dataset,
  review: TariffImportReview,
  options: { approvedCorrections?: ReadonlySet<string>; reviewer: string; today: string },
): Dataset {
  let tariffs = [...current.tariffs];
  for (const item of review.items) {
    if (item.action === 'create' || item.action === 'update_draft') {
      tariffs = tariffs.filter((t) => t.id !== item.incoming.id);
      tariffs.push(item.incoming);
    } else if (item.action === 'propose_correction' && options.approvedCorrections?.has(item.incoming.id)) {
      const old = item.existing!;
      const revision = nextRevisionId(old.id, tariffs);
      tariffs = tariffs.map((t) =>
        t.id === old.id
          ? {
              ...t,
              publicationStatus: 'withdrawn' as const,
              notes: [t.notes, `Withdrawn ${options.today} by ${options.reviewer}: superseded by ${revision}.`]
                .filter(Boolean)
                .join(' '),
            }
          : t,
      );
      tariffs.push({
        ...item.incoming,
        id: revision,
        publicationStatus: 'draft',
        notes: [item.incoming.notes, `Correction of ${old.id} approved ${options.today} by ${options.reviewer}.`]
          .filter(Boolean)
          .join(' '),
      });
    }
  }
  return { ...current, tariffs };
}

function nextRevisionId(id: string, tariffs: readonly Tariff[]): string {
  const base = id.replace(/-r\d+$/, '');
  let n = 2;
  while (tariffs.some((t) => t.id === `${base}-r${n}`)) n++;
  return `${base}-r${n}`;
}

// ---- plaza diffs ---------------------------------------------------------------------------

export interface PlazaChange {
  id: string;
  kind: 'created' | 'changed' | 'unchanged';
  fields: string[];
}

/** Field-level differences between current and incoming plaza records. */
export function diffPlazas(current: readonly Plaza[], incoming: readonly Plaza[]): PlazaChange[] {
  const byId = new Map(current.map((p) => [p.id, p]));
  return incoming.map((p) => {
    const old = byId.get(p.id);
    if (!old) return { id: p.id, kind: 'created', fields: [] };
    const fields = (Object.keys({ ...old, ...p }) as (keyof Plaza)[]).filter(
      (k) => JSON.stringify(old[k]) !== JSON.stringify(p[k]),
    );
    return { id: p.id, kind: fields.length ? 'changed' : 'unchanged', fields };
  });
}
