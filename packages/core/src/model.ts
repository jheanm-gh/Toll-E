/**
 * Toll-E domain model.
 *
 * Conventions:
 * - Money is always an integer number of cents (`amountCents`). Never floats.
 * - Calendar dates are ISO `YYYY-MM-DD` strings interpreted in South African local time
 *   (SAST, UTC+2, no daylight saving). Effective ranges are inclusive on both ends.
 * - Identifiers are stable, lowercase, kebab-case strings. They never change once published.
 */

export type ISODate = string;

/** How much trust a record deserves. Displayed to users verbatim. */
export type VerificationStatus =
  /** A named person checked the value against the cited official source on `verifiedOn`. */
  | 'verified'
  /** Taken from a cited source but not yet checked by a person. */
  | 'unverified'
  /** Flagged because sources conflict or an automated check found something suspicious. */
  | 'pending_review'
  /** Demonstration data. Never shown as a real tariff. */
  | 'illustrative';

/** Whether a record is visible to consumers. */
export type PublicationStatus = 'draft' | 'published' | 'withdrawn';

export type ProvinceCode = 'EC' | 'FS' | 'GP' | 'KZN' | 'LP' | 'MP' | 'NC' | 'NW' | 'WC';

export type SourceKind =
  | 'government_gazette'
  | 'agency_publication'
  | 'operator_publication'
  | 'operator_website'
  | 'news'
  | 'secondary_compilation'
  | 'map_data';

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  kind: SourceKind;
  /** True for primary/authoritative sources (gazettes, the agency, the operator). */
  official: boolean;
  publishedOn?: ISODate;
  /** The date someone last opened or checked this source. */
  retrievedOn: ISODate;
  /** Formal reference, e.g. "Government Gazette Nos. 54087 and 54088". */
  reference?: string;
  notes?: string;
}

export type OperatorKind = 'national_agency' | 'concessionaire' | 'provincial_concession';

export type PaymentMethod = 'cash' | 'contactless_card' | 'e_tag';

export interface PaymentInfo {
  methods: PaymentMethod[];
  status: VerificationStatus;
  sourceIds: string[];
  notes?: string;
}

export interface Operator {
  id: string;
  name: string;
  shortName: string;
  kind: OperatorKind;
  website?: string;
  phone?: string;
  email?: string;
  /** Verification of the contact details above. */
  contactStatus: VerificationStatus;
  payment?: PaymentInfo;
  sourceIds: string[];
  notes?: string;
}

export interface TollRoad {
  id: string;
  name: string;
  /** National/provincial route numbers, e.g. ["N3"]. */
  routes: string[];
  operatorId: string;
  provinces: ProvinceCode[];
  description?: string;
  sourceIds: string[];
}

export type LocationPrecision = 'verified' | 'approximate';

export interface PlazaLocation {
  lat: number;
  lng: number;
  precision: LocationPrecision;
  sourceIds: string[];
  notes?: string;
}

export type PlazaType = 'mainline' | 'ramp' | 'unknown';

export interface Plaza {
  id: string;
  name: string;
  tollRoadId: string;
  operatorId: string;
  route: string;
  type: PlazaType;
  province: ProvinceCode | null;
  /** Free-text locality from the source, e.g. "Between Heidelberg and Villiers". */
  locality?: string;
  /** Which carriageway(s) or movements the plaza serves, when known. */
  carriageway?: string;
  /** null when no position passes our sanity checks. The plaza is then list-only. */
  location: PlazaLocation | null;
  status: 'active' | 'decommissioned';
  /** Vehicle-class scheme the tariffs at this plaza use. */
  classSchemeId: string;
  sourceIds: string[];
  aliases?: string[];
  notes?: string[];
  publicationStatus: PublicationStatus;
}

/** Canonical classes used by SANRAL and the national concessionaires. */
export type StandardClassId = 'class1' | 'class2' | 'class3' | 'class4';

export interface VehicleClass {
  id: string;
  label: string;
  shortDescription: string;
  description: string;
}

export interface VehicleClassScheme {
  id: string;
  name: string;
  classes: VehicleClass[];
  /**
   * How a user's standard class maps onto this scheme. Missing entries mean the
   * scheme has no equivalent and the plaza cannot be priced for that vehicle.
   */
  fromStandard: Partial<Record<StandardClassId, string>>;
  sourceIds: string[];
}

export interface TariffSchedule {
  id: string;
  name: string;
  operatorIds: string[];
  effectiveFrom: ISODate;
  /** Inclusive. null = in force until replaced. */
  effectiveTo: ISODate | null;
  /**
   * When the next adjustment is normally expected (e.g. 1 March each year).
   * After this date, tariffs from this schedule are treated as possibly superseded.
   */
  nextReviewExpected?: ISODate;
  /** Published across-the-board adjustment from the previous schedule, in basis points. */
  adjustmentBps?: number;
  sourceIds: string[];
  notes?: string;
}

export type TravelDirection = 'northbound' | 'southbound' | 'eastbound' | 'westbound';
export type TariffDirection = 'any' | TravelDirection;

export type ChargingBasis =
  /** Paid each time the plaza is passed (conventional open-road plazas). */
  'per_passage';

export interface Tariff {
  id: string;
  plazaId: string;
  vehicleClassId: string;
  amountCents: number;
  currency: 'ZAR';
  vatInclusive: boolean;
  chargingBasis: ChargingBasis;
  direction: TariffDirection;
  /** Human-readable charging condition, e.g. "Charged when exiting at Treverton". */
  condition?: string;
  effectiveFrom: ISODate;
  effectiveTo: ISODate | null;
  scheduleId: string;
  sourceId: string;
  /** Page, table or row reference inside the source. */
  sourceLocator?: string;
  checkedOn: ISODate;
  verifiedOn: ISODate | null;
  verifiedBy: string | null;
  verificationStatus: VerificationStatus;
  publicationStatus: PublicationStatus;
  notes?: string;
}

export interface JourneyEvent {
  plazaId: string;
  direction: TravelDirection;
  requirement: 'required' | 'conditional';
  /** Shown to the user for conditional events. */
  condition?: string;
}

export interface Place {
  label: string;
  /** Used for external navigation. A place name is safer than an unverified coordinate. */
  query: string;
}

export interface Journey {
  id: string;
  name: string;
  origin: Place;
  destination: Place;
  via: string;
  description: string;
  /** Ordered toll events for the outbound leg. */
  events: JourneyEvent[];
  /** Explicit return leg. When omitted, the outbound events are reversed and directions flipped. */
  returnEvents?: JourneyEvent[];
  /** Whether the plaza sequence itself has been checked. */
  sequenceStatus: VerificationStatus;
  /** Who checked the sequence, and when (required when sequenceStatus is 'verified'). */
  sequenceVerifiedOn?: ISODate;
  sequenceVerifiedBy?: string;
  limitations: string[];
  sourceIds: string[];
  publicationStatus: PublicationStatus;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning';
  showFrom: ISODate;
  showUntil: ISODate | null;
  sourceIds: string[];
}

export interface Dataset {
  schemaVersion: 1;
  /** Monotonic, sortable version string, e.g. "2026-10-21.1". */
  datasetVersion: string;
  generatedAt: string;
  country: 'ZA';
  sources: Source[];
  operators: Operator[];
  tollRoads: TollRoad[];
  vehicleClassSchemes: VehicleClassScheme[];
  plazas: Plaza[];
  schedules: TariffSchedule[];
  tariffs: Tariff[];
  journeys: Journey[];
  notices: Notice[];
}
