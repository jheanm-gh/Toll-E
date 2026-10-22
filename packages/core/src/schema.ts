import { z } from 'zod';

import { isISODate } from './dates';
import type { Dataset } from './model';

/**
 * Runtime schemas for everything that crosses a trust boundary: files in `data/`, imports,
 * the backend's published dataset, and anything read back from device storage.
 */

const isoDate = z.string().refine(isISODate, { message: 'expected a YYYY-MM-DD date' });
const id = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'ids are lowercase kebab-case' });
const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), { message: 'URLs must use https' });
/** Sources may be plain http (some third-party sites); the validator warns about them. */
const webUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//.test(u), { message: 'URLs must be http(s)' });

export const verificationStatusSchema = z.enum(['verified', 'unverified', 'pending_review', 'illustrative']);
export const publicationStatusSchema = z.enum(['draft', 'published', 'withdrawn']);
export const provinceSchema = z.enum(['EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC']);
export const travelDirectionSchema = z.enum(['northbound', 'southbound', 'eastbound', 'westbound']);
export const tariffDirectionSchema = z.enum(['any', 'northbound', 'southbound', 'eastbound', 'westbound']);
export const standardClassSchema = z.enum(['class1', 'class2', 'class3', 'class4']);

export const sourceSchema = z.strictObject({
  id,
  title: z.string().min(3),
  publisher: z.string().min(2),
  url: webUrl,
  kind: z.enum([
    'government_gazette',
    'agency_publication',
    'operator_publication',
    'operator_website',
    'news',
    'secondary_compilation',
    'map_data',
  ]),
  official: z.boolean(),
  publishedOn: isoDate.optional(),
  retrievedOn: isoDate,
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const paymentSchema = z.strictObject({
  methods: z.array(z.enum(['cash', 'contactless_card', 'e_tag'])),
  status: verificationStatusSchema,
  sourceIds: z.array(id),
  notes: z.string().optional(),
});

export const operatorSchema = z.strictObject({
  id,
  name: z.string().min(2),
  shortName: z.string().min(2),
  kind: z.enum(['national_agency', 'concessionaire', 'provincial_concession']),
  website: httpsUrl.optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  contactStatus: verificationStatusSchema,
  payment: paymentSchema.optional(),
  sourceIds: z.array(id),
  notes: z.string().optional(),
});

export const tollRoadSchema = z.strictObject({
  id,
  name: z.string().min(2),
  routes: z.array(z.string().regex(/^[NRM]\d{1,3}$/)).min(1),
  operatorId: id,
  provinces: z.array(provinceSchema).min(1),
  description: z.string().optional(),
  sourceIds: z.array(id),
});

export const plazaSchema = z.strictObject({
  id,
  name: z.string().min(2),
  tollRoadId: id,
  operatorId: id,
  route: z.string().regex(/^[NRM]\d{1,3}$/),
  type: z.enum(['mainline', 'ramp', 'unknown']),
  province: provinceSchema.nullable(),
  locality: z.string().optional(),
  carriageway: z.string().optional(),
  location: z
    .strictObject({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      precision: z.enum(['verified', 'approximate']),
      sourceIds: z.array(id),
      notes: z.string().optional(),
    })
    .nullable(),
  status: z.enum(['active', 'decommissioned']),
  classSchemeId: id,
  sourceIds: z.array(id),
  aliases: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
  publicationStatus: publicationStatusSchema,
});

export const vehicleClassSchemeSchema = z.strictObject({
  id,
  name: z.string(),
  classes: z
    .array(
      z.strictObject({
        id,
        label: z.string(),
        shortDescription: z.string(),
        description: z.string(),
      }),
    )
    .min(1),
  fromStandard: z.partialRecord(standardClassSchema, id),
  sourceIds: z.array(id),
});

export const scheduleSchema = z.strictObject({
  id,
  name: z.string(),
  operatorIds: z.array(id).min(1),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable(),
  nextReviewExpected: isoDate.optional(),
  adjustmentBps: z.number().int().optional(),
  sourceIds: z.array(id),
  notes: z.string().optional(),
});

export const tariffSchema = z.strictObject({
  id,
  plazaId: id,
  vehicleClassId: id,
  amountCents: z.number().int().positive(),
  currency: z.literal('ZAR'),
  vatInclusive: z.boolean(),
  chargingBasis: z.literal('per_passage'),
  direction: tariffDirectionSchema,
  condition: z.string().optional(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable(),
  scheduleId: id,
  sourceId: id,
  sourceLocator: z.string().optional(),
  checkedOn: isoDate,
  verifiedOn: isoDate.nullable(),
  verifiedBy: z.string().nullable(),
  verificationStatus: verificationStatusSchema,
  publicationStatus: publicationStatusSchema,
  notes: z.string().optional(),
});

const journeyEventSchema = z.strictObject({
  plazaId: id,
  direction: travelDirectionSchema,
  requirement: z.enum(['required', 'conditional']),
  condition: z.string().optional(),
});

const placeSchema = z.strictObject({ label: z.string(), query: z.string() });

export const journeySchema = z.strictObject({
  id,
  name: z.string(),
  origin: placeSchema,
  destination: placeSchema,
  via: z.string(),
  description: z.string(),
  events: z.array(journeyEventSchema).min(1),
  returnEvents: z.array(journeyEventSchema).optional(),
  sequenceStatus: verificationStatusSchema,
  sequenceVerifiedOn: isoDate.optional(),
  sequenceVerifiedBy: z.string().min(2).optional(),
  limitations: z.array(z.string()),
  sourceIds: z.array(id),
  publicationStatus: publicationStatusSchema,
});

export const noticeSchema = z.strictObject({
  id,
  title: z.string(),
  body: z.string(),
  severity: z.enum(['info', 'warning']),
  showFrom: isoDate,
  showUntil: isoDate.nullable(),
  sourceIds: z.array(id),
});

export const datasetSchema = z.strictObject({
  schemaVersion: z.literal(1),
  datasetVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/),
  generatedAt: z.string(),
  country: z.literal('ZA'),
  sources: z.array(sourceSchema),
  operators: z.array(operatorSchema),
  tollRoads: z.array(tollRoadSchema),
  vehicleClassSchemes: z.array(vehicleClassSchemeSchema),
  plazas: z.array(plazaSchema),
  schedules: z.array(scheduleSchema),
  tariffs: z.array(tariffSchema),
  journeys: z.array(journeySchema),
  notices: z.array(noticeSchema),
});

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function parseDataset(input: unknown): ParseResult<Dataset> {
  const r = datasetSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data as Dataset };
  return {
    ok: false,
    errors: r.error.issues.slice(0, 50).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

/** Compare dataset versions ("2026-10-21.2" > "2026-10-21.1" > "2026-10-20.9"). */
export function compareDatasetVersions(a: string, b: string): number {
  const [ad, an] = a.split('.');
  const [bd, bn] = b.split('.');
  if (ad !== bd) return (ad ?? '').localeCompare(bd ?? '');
  return Number(an) - Number(bn);
}
