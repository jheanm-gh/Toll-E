import type { Journey, Plaza } from './model';

/**
 * External navigation links. Toll-E does not navigate; it hands the user to another app.
 *
 * All links are universal https URLs: when the app is installed the OS opens it, otherwise
 * the link opens in the browser, so a missing app is never a dead end. No toll information
 * is passed to these apps, and Toll-E does not claim otherwise.
 *
 * When a plaza's position has not been verified we navigate by **name** rather than by a
 * coordinate that might be several kilometres out.
 */

export type NavigationApp = 'google_maps' | 'waze' | 'apple_maps';

export const NAVIGATION_APPS: { id: NavigationApp; label: string; platforms: ('ios' | 'android' | 'web')[] }[] = [
  { id: 'google_maps', label: 'Google Maps', platforms: ['ios', 'android', 'web'] },
  { id: 'waze', label: 'Waze', platforms: ['ios', 'android', 'web'] },
  { id: 'apple_maps', label: 'Apple Maps', platforms: ['ios', 'web'] },
];

export interface NavigationTarget {
  label: string;
  /** Free-text query understood by map apps, e.g. "Mooi Toll Plaza, N3, South Africa". */
  query: string;
  /** Only set when the position is verified. */
  coordinate: { lat: number; lng: number } | null;
}

const enc = encodeURIComponent;
const coord = (c: { lat: number; lng: number }) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;

export function plazaNavigationTarget(plaza: Plaza): NavigationTarget {
  const query = `${plaza.name} Toll Plaza, ${plaza.route}, South Africa`;
  return {
    label: `${plaza.name} Toll Plaza`,
    query,
    coordinate:
      plaza.location && plaza.location.precision === 'verified'
        ? { lat: plaza.location.lat, lng: plaza.location.lng }
        : null,
  };
}

/** Directions to a single destination. */
export function destinationUrl(app: NavigationApp, target: NavigationTarget): string {
  const dest = target.coordinate ? coord(target.coordinate) : target.query;
  switch (app) {
    case 'google_maps':
      return `https://www.google.com/maps/dir/?api=1&destination=${enc(dest)}&travelmode=driving`;
    case 'waze':
      return target.coordinate
        ? `https://waze.com/ul?ll=${enc(dest)}&navigate=yes&utm_source=toll-e`
        : `https://waze.com/ul?q=${enc(dest)}&navigate=yes&utm_source=toll-e`;
    case 'apple_maps':
      return target.coordinate
        ? `https://maps.apple.com/?ll=${dest}&q=${enc(target.label)}`
        : `https://maps.apple.com/?q=${enc(dest)}`;
  }
}

/** Directions for a whole journey. Waze always routes from the current location. */
export function journeyUrl(app: NavigationApp, journey: Pick<Journey, 'origin' | 'destination'>): string {
  const o = journey.origin.query;
  const d = journey.destination.query;
  switch (app) {
    case 'google_maps':
      return `https://www.google.com/maps/dir/?api=1&origin=${enc(o)}&destination=${enc(d)}&travelmode=driving`;
    case 'waze':
      return `https://waze.com/ul?q=${enc(d)}&navigate=yes&utm_source=toll-e`;
    case 'apple_maps':
      return `https://maps.apple.com/?saddr=${enc(o)}&daddr=${enc(d)}&dirflg=d`;
  }
}
