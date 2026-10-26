import { describe, expect, it } from 'vitest';

import {
  availableOperators,
  availableRoutes,
  destinationUrl,
  journeyUrl,
  plazaNavigationTarget,
  searchPlazas,
  sortPlazaResults,
} from '../src';
import { dataset, plaza } from './fixtures';

const loc = (lat: number, lng: number, precision: 'verified' | 'approximate' = 'approximate') => ({
  lat,
  lng,
  precision,
  sourceIds: ['src-official'],
});

const ds = dataset({
  plazas: [
    plaza('p-mooi', { name: 'Mooi', route: 'N3', province: 'KZN', aliases: ['Mooi River'] }),
    plaza('p-mooi-ramp', { name: 'Mooi South Ramp', route: 'N3', type: 'ramp', province: 'KZN' }),
    plaza('p-grasmere', { name: 'Grasmere', route: 'N1', location: loc(-26.41, 27.88) }),
    plaza('p-stormvoel', { name: 'Stormvoël', route: 'N1', aliases: ['Stormvoel'] }),
    plaza('p-draft', { name: 'Hidden', publicationStatus: 'draft' }),
    plaza('p-old', { name: 'Closed', status: 'decommissioned' }),
    plaza('p-n17', { name: 'Dalpark', route: 'N17', location: loc(-26.25, 28.33) }),
  ],
});

describe('searchPlazas', () => {
  it('ranks exact name matches above partial ones', () => {
    expect(searchPlazas(ds, { query: 'mooi' }).map((r) => r.plaza.id)).toEqual(['p-mooi', 'p-mooi-ramp']);
  });
  it('matches aliases and accent-insensitive names', () => {
    expect(searchPlazas(ds, { query: 'mooi river' })[0]?.plaza.id).toBe('p-mooi');
    expect(searchPlazas(ds, { query: 'stormvoel' })[0]?.plaza.id).toBe('p-stormvoel');
  });
  it('searches by road and province', () => {
    expect(
      searchPlazas(ds, { query: 'N3' })
        .map((r) => r.plaza.id)
        .sort(),
    ).toEqual(['p-mooi', 'p-mooi-ramp']);
    expect(searchPlazas(ds, { query: 'kwazulu' })).toHaveLength(2);
  });
  it('filters by route, province and type', () => {
    expect(searchPlazas(ds, { route: 'N1' }).map((r) => r.plaza.id)).toEqual(['p-grasmere', 'p-stormvoel']);
    expect(searchPlazas(ds, { type: 'ramp' }).map((r) => r.plaza.id)).toEqual(['p-mooi-ramp']);
    expect(searchPlazas(ds, { province: 'KZN', type: 'mainline' }).map((r) => r.plaza.id)).toEqual(['p-mooi']);
  });
  it('hides drafts and decommissioned plazas', () => {
    const ids = searchPlazas(ds).map((r) => r.plaza.id);
    expect(ids).not.toContain('p-draft');
    expect(ids).not.toContain('p-old');
  });
  it('sorts by distance when a location is given, unlocated plazas last', () => {
    const near = searchPlazas(ds, {}, { lat: -26.26, lng: 28.3 });
    expect(near[0]?.plaza.id).toBe('p-n17');
    expect(near[1]?.plaza.id).toBe('p-grasmere');
    expect(near[0]?.distanceMetres).toBeLessThan(5000);
    expect(near.at(-1)?.distanceMetres).toBeUndefined();
  });
  it('sorts routes naturally', () => {
    expect(availableRoutes(ds)).toEqual(['N1', 'N3', 'N9', 'N17']);
  });
});

describe('sortPlazaResults', () => {
  const all = searchPlazas(ds);
  const ids = (rs: { plaza: { id: string } }[]) => rs.map((r) => r.plaza.id);
  // Prices in cents for the class shown; Stormvoël and the Mooi ramp have none.
  const price = (p: { id: string }) =>
    (({ 'p-mooi': 9_000, 'p-grasmere': 4_500, 'p-n17': 4_500 }) as Record<string, number>)[p.id] ?? null;

  it('sorts by name, ignoring accents and case', () => {
    expect(ids(sortPlazaResults(all, 'name'))).toEqual(['p-n17', 'p-grasmere', 'p-mooi', 'p-mooi-ramp', 'p-stormvoel']);
  });
  it('sorts by price both ways, plazas without a current price always last', () => {
    expect(ids(sortPlazaResults(all, 'price_low', price))).toEqual([
      'p-grasmere',
      'p-n17',
      'p-mooi',
      'p-stormvoel',
      'p-mooi-ramp',
    ]);
    expect(ids(sortPlazaResults(all, 'price_high', price))).toEqual([
      'p-mooi',
      'p-grasmere',
      'p-n17',
      'p-stormvoel',
      'p-mooi-ramp',
    ]);
  });
  it('sorts by province name, plazas without a province last', () => {
    const someUnknown = all.map((r) =>
      r.plaza.id === 'p-stormvoel' ? { ...r, plaza: { ...r.plaza, province: null } } : r,
    );
    // Gauteng (N1 Grasmere, N17 Dalpark), then KwaZulu-Natal (both N3, by name), then no province.
    expect(ids(sortPlazaResults(someUnknown, 'province'))).toEqual([
      'p-grasmere',
      'p-n17',
      'p-mooi',
      'p-mooi-ramp',
      'p-stormvoel',
    ]);
  });
  it('keeps best-match order for relevance and does not change its input', () => {
    const found = searchPlazas(ds, { query: 'mooi' });
    const before = ids(found);
    expect(ids(sortPlazaResults(found, 'name'))).toEqual(['p-mooi', 'p-mooi-ramp']);
    expect(ids(sortPlazaResults(found, 'relevance'))).toEqual(before);
    expect(ids(found)).toEqual(before);
  });
  it('can re-sort distance results by another order', () => {
    const near = searchPlazas(ds, {}, { lat: -26.26, lng: 28.3 });
    expect(ids(sortPlazaResults(near, 'distance'))).toEqual(ids(near));
    expect(sortPlazaResults(near, 'name')[0]?.plaza.id).toBe('p-n17');
    expect(sortPlazaResults(near, 'name')[0]?.distanceMetres).toBeLessThan(5000);
  });
  it('lists only operators that have an active, published plaza', () => {
    const base = dataset();
    const withSpare = dataset({
      plazas: ds.plazas,
      operators: [...base.operators, { ...base.operators[0]!, id: 'op-unused', shortName: 'AAA' }],
    });
    expect(availableOperators(withSpare).map((o) => o.id)).toEqual(['op-a']);
  });
});

describe('external navigation links', () => {
  const unverified = plaza('p-g', { name: 'Grasmere', route: 'N1', location: loc(-26.4114, 27.8842) });
  const verified = plaza('p-v', { name: 'Vaal', route: 'N1', location: loc(-26.8564, 27.6353, 'verified') });

  it('navigates by name when the position is not verified', () => {
    const target = plazaNavigationTarget(unverified);
    expect(target.coordinate).toBeNull();
    expect(destinationUrl('google_maps', target)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Grasmere%20Toll%20Plaza%2C%20N1%2C%20South%20Africa&travelmode=driving',
    );
    expect(destinationUrl('waze', target)).toBe(
      'https://waze.com/ul?q=Grasmere%20Toll%20Plaza%2C%20N1%2C%20South%20Africa&navigate=yes&utm_source=toll-e',
    );
    expect(destinationUrl('apple_maps', target)).toBe(
      'https://maps.apple.com/?q=Grasmere%20Toll%20Plaza%2C%20N1%2C%20South%20Africa',
    );
  });

  it('navigates by coordinate when the position is verified', () => {
    const target = plazaNavigationTarget(verified);
    expect(destinationUrl('google_maps', target)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-26.856400%2C27.635300&travelmode=driving',
    );
    expect(destinationUrl('waze', target)).toBe(
      'https://waze.com/ul?ll=-26.856400%2C27.635300&navigate=yes&utm_source=toll-e',
    );
    expect(destinationUrl('apple_maps', target)).toBe(
      'https://maps.apple.com/?ll=-26.856400,27.635300&q=Vaal%20Toll%20Plaza',
    );
  });

  it('builds journey links (all https so a missing app falls back to the browser)', () => {
    const j = {
      origin: { label: 'JHB', query: 'Johannesburg, South Africa' },
      destination: { label: 'DBN', query: 'Durban, South Africa' },
    };
    for (const app of ['google_maps', 'waze', 'apple_maps'] as const) {
      expect(journeyUrl(app, j).startsWith('https://')).toBe(true);
    }
    expect(journeyUrl('google_maps', j)).toContain('origin=Johannesburg%2C%20South%20Africa');
    expect(journeyUrl('google_maps', j)).toContain('destination=Durban%2C%20South%20Africa');
  });
});
