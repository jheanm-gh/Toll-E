import type { ProvinceCode } from './model';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Mainland South Africa, generously bounded. Used as a hard sanity check. */
export const SOUTH_AFRICA_BBOX: BBox = { minLat: -35.0, maxLat: -22.0, minLng: 16.3, maxLng: 33.0 };

/**
 * Coarse provincial bounding boxes (degrees, with roughly 0.3° margin). They catch gross
 * errors such as a KwaZulu-Natal plaza placed in the Free State; they cannot prove a
 * location is correct.
 */
export const PROVINCE_BBOX: Record<ProvinceCode, BBox> = {
  WC: { minLat: -35.0, maxLat: -30.1, minLng: 17.4, maxLng: 24.6 },
  EC: { minLat: -34.5, maxLat: -29.7, minLng: 22.4, maxLng: 30.5 },
  NC: { minLat: -33.2, maxLat: -24.4, minLng: 16.3, maxLng: 25.6 },
  FS: { minLat: -31.0, maxLat: -26.3, minLng: 24.0, maxLng: 30.1 },
  KZN: { minLat: -31.4, maxLat: -26.5, minLng: 28.5, maxLng: 33.0 },
  NW: { minLat: -28.3, maxLat: -24.3, minLng: 22.3, maxLng: 28.7 },
  GP: { minLat: -27.0, maxLat: -24.8, minLng: 27.0, maxLng: 28.9 },
  MP: { minLat: -28.1, maxLat: -24.1, minLng: 28.0, maxLng: 32.2 },
  LP: { minLat: -25.8, maxLat: -22.0, minLng: 26.1, maxLng: 32.2 },
};

export function inBBox(p: LatLng, b: BBox): boolean {
  return p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;
}

export function isValidCoordinate(p: LatLng): boolean {
  return (
    Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180
  );
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north. */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface PolylineProjection {
  /** Distance from the point to the closest point on the line, metres. */
  distanceMetres: number;
  /** Distance along the line from its start to the closest point, metres. */
  alongMetres: number;
  /** Index of the segment containing the closest point. */
  segmentIndex: number;
  /** Bearing of that segment. */
  segmentBearing: number;
}

/**
 * Project a point onto a polyline using a local equirectangular approximation per segment.
 * Accurate to well under 1% for the segment lengths routing providers return.
 */
export function projectOntoPolyline(point: LatLng, line: readonly LatLng[]): PolylineProjection | null {
  if (line.length < 2) return null;
  let best: PolylineProjection | null = null;
  let along = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const cosLat = Math.cos(toRad((a.lat + b.lat) / 2));
    const ax = 0;
    const ay = 0;
    const bx = toRad(b.lng - a.lng) * cosLat * EARTH_RADIUS_M;
    const by = toRad(b.lat - a.lat) * EARTH_RADIUS_M;
    const px = toRad(point.lng - a.lng) * cosLat * EARTH_RADIUS_M;
    const py = toRad(point.lat - a.lat) * EARTH_RADIUS_M;
    const segLen2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = segLen2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / segLen2));
    const cx = t * bx;
    const cy = t * by;
    const dist = Math.hypot(px - cx, py - cy);
    const segLen = Math.sqrt(segLen2);
    if (best === null || dist < best.distanceMetres) {
      best = {
        distanceMetres: dist,
        alongMetres: along + t * segLen,
        segmentIndex: i,
        segmentBearing: bearingDegrees(a, b),
      };
    }
    along += segLen;
  }
  return best;
}

/** Smallest absolute difference between two bearings, 0–180. */
export function bearingDifference(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
