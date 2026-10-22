import type { TollEventInput } from './calculator';
import { projectOntoPolyline, type LatLng } from './geo';
import type { Dataset, Plaza, TravelDirection } from './model';

/**
 * Route → toll-plaza matching.
 *
 * A routing provider gives us geometry; deciding which plazas are actually charged is our job.
 * Proximity alone is not enough: a route can pass beside a ramp plaza without using the ramp,
 * or run on a parallel road. The matcher therefore combines:
 *   - distance to the route line, with a tolerance that depends on how well we know the
 *     plaza's position;
 *   - road identity (the provider's road references, e.g. "N3") where available;
 *   - plaza type (ramp plazas are never auto-confirmed);
 *   - order along the route (the journey sequence) and the travel direction at the plaza.
 * Anything uncertain is returned for the user to confirm, never silently charged.
 */

export interface RouteGeometry {
  points: LatLng[];
  /** Road references along the route, as index ranges into `points`. */
  roadRefs?: { fromIndex: number; toIndex: number; ref: string }[];
  /** Provider attribution, shown with any result. */
  attribution: string;
}

export interface RouteProvider {
  id: string;
  name: string;
  /** Returns null when the provider is not configured or the request fails. */
  route(origin: LatLng, destination: LatLng): Promise<RouteGeometry[] | null>;
  limitations: string[];
}

export interface MatchCandidate {
  plazaId: string;
  alongMetres: number;
  distanceMetres: number;
  direction: TravelDirection;
  confidence: 'high' | 'low';
  reasons: string[];
}

export interface RouteMatch {
  candidates: MatchCandidate[];
  /** Plazas on roads this route uses whose position is unknown — the user must check them. */
  unlocatedOnRoute: string[];
  needsConfirmation: boolean;
}

export const MATCH_TOLERANCE_VERIFIED_M = 150;
export const MATCH_TOLERANCE_APPROXIMATE_M = 3_000;

export function directionFromBearing(bearing: number): TravelDirection {
  if (bearing >= 315 || bearing < 45) return 'northbound';
  if (bearing < 135) return 'eastbound';
  if (bearing < 225) return 'southbound';
  return 'westbound';
}

function refAt(route: RouteGeometry, segmentIndex: number): string | null {
  const r = route.roadRefs?.find((x) => segmentIndex >= x.fromIndex && segmentIndex < x.toIndex);
  return r ? r.ref.toUpperCase() : null;
}

export function matchRouteToPlazas(dataset: Dataset, route: RouteGeometry): RouteMatch {
  const candidates: MatchCandidate[] = [];
  const refsOnRoute = new Set((route.roadRefs ?? []).map((r) => r.ref.toUpperCase()));
  const unlocatedOnRoute: string[] = [];

  for (const plaza of dataset.plazas) {
    if (plaza.status !== 'active' || plaza.publicationStatus !== 'published') continue;
    if (!plaza.location) {
      if (refsOnRoute.has(plaza.route.toUpperCase())) unlocatedOnRoute.push(plaza.id);
      continue;
    }
    const proj = projectOntoPolyline(plaza.location, route.points);
    if (!proj) continue;
    const verified = plaza.location.precision === 'verified';
    const tolerance = verified ? MATCH_TOLERANCE_VERIFIED_M : MATCH_TOLERANCE_APPROXIMATE_M;
    if (proj.distanceMetres > tolerance) continue;

    const reasons: string[] = [];
    let confident = verified;
    if (!verified) reasons.push('plaza position is approximate');

    const ref = refAt(route, proj.segmentIndex);
    if (ref) {
      if (ref !== plaza.route.toUpperCase()) {
        // A plaza on another road beside our route is almost never charged.
        if (proj.distanceMetres > 50) continue;
        confident = false;
        reasons.push(`route is on ${ref} but plaza is on ${plaza.route}`);
      }
    } else {
      confident = false;
      reasons.push('provider did not identify the road');
    }
    if (plaza.type !== 'mainline') {
      confident = false;
      reasons.push(plaza.type === 'ramp' ? 'ramp plazas depend on the exact interchange used' : 'plaza type unknown');
    }
    candidates.push({
      plazaId: plaza.id,
      alongMetres: proj.alongMetres,
      distanceMetres: proj.distanceMetres,
      direction: directionFromBearing(proj.segmentBearing),
      confidence: confident ? 'high' : 'low',
      reasons,
    });
  }

  candidates.sort((a, b) => a.alongMetres - b.alongMetres);
  return {
    candidates,
    unlocatedOnRoute,
    needsConfirmation: candidates.some((c) => c.confidence === 'low') || unlocatedOnRoute.length > 0 || !route.roadRefs,
  };
}

/** Turn a match into calculator events: confident matches are charged, the rest await confirmation. */
export function matchToEvents(match: RouteMatch, plazas: ReadonlyMap<string, Plaza>): TollEventInput[] {
  return match.candidates.map((c) => ({
    plazaId: c.plazaId,
    direction: c.direction,
    requirement: c.confidence === 'high' ? 'required' : 'conditional',
    condition:
      c.confidence === 'high'
        ? undefined
        : `Possibly on your route (${c.reasons.join('; ')}). Confirm before including ${plazas.get(c.plazaId)?.name ?? c.plazaId}.`,
    include: c.confidence === 'high',
  }));
}

/** Placeholder provider used until a real routing provider is configured. */
export const unconfiguredRouteProvider: RouteProvider = {
  id: 'none',
  name: 'Not configured',
  route: async () => null,
  limitations: ['Automatic route pricing is disabled until a routing provider is configured and validated.'],
};
