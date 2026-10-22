import { sumCents } from './money';
import type { ISODate, Journey, JourneyEvent, StandardClassId, TravelDirection } from './model';
import { resolveStandardTariff, weakestTrust, type TariffIndex, type TariffResolution, type Trust } from './tariffs';

export type TripType = 'one_way' | 'return';
export type Leg = 'outbound' | 'return';

export interface TollEventInput {
  plazaId: string;
  /** Travel direction through the plaza. Unknown for manual selections. */
  direction?: TravelDirection;
  requirement: 'required' | 'conditional';
  condition?: string;
  /** Conditional events are only charged when the user confirms they apply. */
  include: boolean;
}

export interface CalculationInput {
  mode: 'journey' | 'manual';
  journeyId?: string;
  /** Whether the plaza sequence itself is verified (journey mode). */
  sequenceVerified: boolean;
  outbound: TollEventInput[];
  /** Required when `trip` is 'return'. */
  inbound?: TollEventInput[];
  trip: TripType;
  standardClass: StandardClassId;
  date: ISODate;
}

export type LineStatus = 'priced' | 'unavailable' | 'ambiguous' | 'excluded' | 'duplicate';

export interface CalculationLine {
  leg: Leg;
  sequence: number;
  plazaId: string;
  direction?: TravelDirection;
  status: LineStatus;
  amountCents: number | null;
  trust: Trust | null;
  possiblySuperseded: boolean;
  tariffId: string | null;
  vehicleClassId: string | null;
  sourceId: string | null;
  scheduleId: string | null;
  effectiveFrom: ISODate | null;
  /** Machine-readable reason for non-priced lines. */
  reason?: string;
  condition?: string;
}

export type WarningCode =
  | 'unpriced_events'
  | 'ambiguous_events'
  | 'excluded_conditional'
  | 'duplicate_event'
  | 'unverified_tariffs'
  | 'under_review_tariffs'
  | 'stale_tariffs'
  | 'possibly_superseded'
  | 'sequence_unverified'
  | 'manual_selection'
  | 'no_events'
  | 'discounts_not_applied';

export interface CalculationWarning {
  code: WarningCode;
  plazaIds?: string[];
}

export type ResultConfidence =
  /** Every event priced, all tariffs confirmed current, sequence verified. */
  | 'confirmed'
  /** Every event priced but at least one input is unverified, stale or under review. */
  | 'estimate'
  /** At least one required event could not be priced — the total is partial. */
  | 'partial'
  /** Nothing could be priced. */
  | 'unavailable';

export interface CalculationResult {
  input: CalculationInput;
  lines: CalculationLine[];
  totalCents: number;
  outboundCents: number;
  returnCents: number;
  chargeableCount: number;
  pricedCount: number;
  confidence: ResultConfidence;
  trust: Trust | null;
  warnings: CalculationWarning[];
  sourceIds: string[];
  scheduleIds: string[];
}

export function flipDirection(d: TravelDirection): TravelDirection {
  switch (d) {
    case 'northbound':
      return 'southbound';
    case 'southbound':
      return 'northbound';
    case 'eastbound':
      return 'westbound';
    case 'westbound':
      return 'eastbound';
  }
}

/** The return leg of a journey: explicit when provided, otherwise reversed and flipped. */
export function returnEvents(journey: Journey): JourneyEvent[] {
  if (journey.returnEvents) return journey.returnEvents;
  return [...journey.events].reverse().map((e) => ({ ...e, direction: flipDirection(e.direction) }));
}

export function journeyInput(
  journey: Journey,
  options: {
    trip: TripType;
    standardClass: StandardClassId;
    date: ISODate;
    /** Plaza ids of conditional events the user has confirmed. */
    includeConditional?: ReadonlySet<string>;
  },
): CalculationInput {
  const toInput = (e: JourneyEvent): TollEventInput => ({
    plazaId: e.plazaId,
    direction: e.direction,
    requirement: e.requirement,
    condition: e.condition,
    include: e.requirement === 'required' || !!options.includeConditional?.has(e.plazaId),
  });
  return {
    mode: 'journey',
    journeyId: journey.id,
    sequenceVerified: journey.sequenceStatus === 'verified',
    outbound: journey.events.map(toInput),
    inbound: options.trip === 'return' ? returnEvents(journey).map(toInput) : undefined,
    trip: options.trip,
    standardClass: options.standardClass,
    date: options.date,
  };
}

/** Plazas picked by the user, in the order picked. The return leg passes them in reverse. */
export function manualInput(
  plazaIds: readonly string[],
  options: { trip: TripType; standardClass: StandardClassId; date: ISODate },
): CalculationInput {
  const toInput = (plazaId: string): TollEventInput => ({
    plazaId,
    requirement: 'required',
    include: true,
  });
  return {
    mode: 'manual',
    sequenceVerified: false,
    outbound: plazaIds.map(toInput),
    inbound: options.trip === 'return' ? [...plazaIds].reverse().map(toInput) : undefined,
    trip: options.trip,
    standardClass: options.standardClass,
    date: options.date,
  };
}

function lineFromResolution(
  base: Omit<
    CalculationLine,
    | 'status'
    | 'amountCents'
    | 'trust'
    | 'possiblySuperseded'
    | 'tariffId'
    | 'vehicleClassId'
    | 'sourceId'
    | 'scheduleId'
    | 'effectiveFrom'
  >,
  r: TariffResolution & { vehicleClassId: string | null },
): CalculationLine {
  const empty = {
    amountCents: null,
    trust: null,
    possiblySuperseded: false,
    tariffId: null,
    vehicleClassId: r.vehicleClassId,
    sourceId: null,
    scheduleId: null,
    effectiveFrom: null,
  };
  switch (r.kind) {
    case 'current':
      return {
        ...base,
        status: 'priced',
        amountCents: r.tariff.amountCents,
        trust: r.trust,
        possiblySuperseded: r.possiblySuperseded,
        tariffId: r.tariff.id,
        vehicleClassId: r.vehicleClassId,
        sourceId: r.tariff.sourceId,
        scheduleId: r.tariff.scheduleId,
        effectiveFrom: r.tariff.effectiveFrom,
      };
    case 'none':
      return { ...base, ...empty, status: 'unavailable', reason: r.reason };
    case 'ambiguous':
      return { ...base, ...empty, status: 'ambiguous', reason: r.reason };
  }
}

/**
 * Price a journey. Never invents a charge: events that cannot be priced are reported, and the
 * total is labelled partial. Conditional events are excluded unless the user confirms them.
 */
export function calculate(index: TariffIndex, input: CalculationInput): CalculationResult {
  const lines: CalculationLine[] = [];
  const legs: [Leg, TollEventInput[]][] = [['outbound', input.outbound]];
  if (input.trip === 'return') legs.push(['return', input.inbound ?? []]);

  for (const [leg, events] of legs) {
    const seen = new Set<string>();
    events.forEach((event, i) => {
      const base = {
        leg,
        sequence: i + 1,
        plazaId: event.plazaId,
        direction: event.direction,
        condition: event.condition,
      };
      if (event.requirement === 'conditional' && !event.include) {
        lines.push({
          ...base,
          status: 'excluded',
          amountCents: null,
          trust: null,
          possiblySuperseded: false,
          tariffId: null,
          vehicleClassId: null,
          sourceId: null,
          scheduleId: null,
          effectiveFrom: null,
          reason: 'conditional_not_confirmed',
        });
        return;
      }
      if (seen.has(event.plazaId)) {
        lines.push({
          ...base,
          status: 'duplicate',
          amountCents: null,
          trust: null,
          possiblySuperseded: false,
          tariffId: null,
          vehicleClassId: null,
          sourceId: null,
          scheduleId: null,
          effectiveFrom: null,
          reason: 'duplicate_in_leg',
        });
        return;
      }
      seen.add(event.plazaId);
      const r = resolveStandardTariff(index, event.plazaId, input.standardClass, {
        date: input.date,
        direction: event.direction,
      });
      lines.push(lineFromResolution(base, r));
    });
  }

  const priced = lines.filter((l) => l.status === 'priced');
  const chargeable = lines.filter((l) => l.status !== 'excluded' && l.status !== 'duplicate');
  const amounts = priced.map((l) => l.amountCents as number);
  const totalCents = sumCents(amounts);
  const outboundCents = sumCents(priced.filter((l) => l.leg === 'outbound').map((l) => l.amountCents as number));
  const returnCents = sumCents(priced.filter((l) => l.leg === 'return').map((l) => l.amountCents as number));
  if (outboundCents + returnCents !== totalCents) {
    throw new Error('Calculation integrity check failed: leg totals do not reconstruct the total');
  }

  const trust = weakestTrust(priced.map((l) => l.trust as Trust));
  const warnings: CalculationWarning[] = [];
  const idsWhere = (pred: (l: CalculationLine) => boolean) => [...new Set(lines.filter(pred).map((l) => l.plazaId))];
  const addWarning = (code: WarningCode, plazaIds?: string[]) => {
    if (plazaIds && plazaIds.length === 0) return;
    warnings.push(plazaIds ? { code, plazaIds } : { code });
  };

  if (chargeable.length === 0) addWarning('no_events');
  addWarning(
    'unpriced_events',
    idsWhere((l) => l.status === 'unavailable'),
  );
  addWarning(
    'ambiguous_events',
    idsWhere((l) => l.status === 'ambiguous'),
  );
  addWarning(
    'excluded_conditional',
    idsWhere((l) => l.status === 'excluded'),
  );
  addWarning(
    'duplicate_event',
    idsWhere((l) => l.status === 'duplicate'),
  );
  addWarning(
    'under_review_tariffs',
    idsWhere((l) => l.trust === 'under_review'),
  );
  addWarning(
    'unverified_tariffs',
    idsWhere((l) => l.trust === 'unverified'),
  );
  addWarning(
    'stale_tariffs',
    idsWhere((l) => l.trust === 'stale'),
  );
  addWarning(
    'possibly_superseded',
    idsWhere((l) => l.possiblySuperseded),
  );
  if (input.mode === 'manual') addWarning('manual_selection');
  else if (!input.sequenceVerified) addWarning('sequence_unverified');
  if (priced.length > 0) addWarning('discounts_not_applied');

  let confidence: ResultConfidence;
  if (priced.length === 0) confidence = 'unavailable';
  else if (priced.length < chargeable.length) confidence = 'partial';
  else if (
    trust === 'confirmed' &&
    input.mode === 'journey' &&
    input.sequenceVerified &&
    !priced.some((l) => l.possiblySuperseded)
  )
    confidence = 'confirmed';
  else confidence = 'estimate';

  return {
    input,
    lines,
    totalCents,
    outboundCents,
    returnCents,
    chargeableCount: chargeable.length,
    pricedCount: priced.length,
    confidence,
    trust,
    warnings,
    sourceIds: [...new Set(priced.map((l) => l.sourceId as string))],
    scheduleIds: [...new Set(priced.map((l) => l.scheduleId as string))],
  };
}

/** Recompute the total from the itemised lines. Used by tests and by saved-calculation checks. */
export function reconstructTotal(result: Pick<CalculationResult, 'lines'>): number {
  return sumCents(result.lines.filter((l) => l.status === 'priced').map((l) => l.amountCents as number));
}
