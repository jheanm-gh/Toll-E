import { haversineMetres, type LatLng } from './geo';
import type { Dataset, Operator, Plaza, PlazaType, ProvinceCode } from './model';

export const PROVINCE_NAMES: Record<ProvinceCode, string> = {
  EC: 'Eastern Cape',
  FS: 'Free State',
  GP: 'Gauteng',
  KZN: 'KwaZulu-Natal',
  LP: 'Limpopo',
  MP: 'Mpumalanga',
  NC: 'Northern Cape',
  NW: 'North West',
  WC: 'Western Cape',
};

export interface PlazaFilter {
  query?: string;
  route?: string;
  operatorId?: string;
  province?: ProvinceCode;
  type?: PlazaType;
}

export interface PlazaSearchResult {
  plaza: Plaza;
  score: number;
  /** Present when sorting by distance and the plaza has a location. */
  distanceMetres?: number;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Search and filter published, active plazas. Text matches plaza name and aliases most
 * strongly, then route, operator, toll road, locality and province.
 */
export function searchPlazas(dataset: Dataset, filter: PlazaFilter = {}, near?: LatLng): PlazaSearchResult[] {
  const operators = new Map(dataset.operators.map((o) => [o.id, o]));
  const roads = new Map(dataset.tollRoads.map((r) => [r.id, r]));
  const terms = filter.query ? fold(filter.query).split(' ').filter(Boolean) : [];

  const results: PlazaSearchResult[] = [];
  for (const plaza of dataset.plazas) {
    if (plaza.publicationStatus !== 'published' || plaza.status !== 'active') continue;
    if (filter.route && plaza.route !== filter.route) continue;
    if (filter.operatorId && plaza.operatorId !== filter.operatorId) continue;
    if (filter.province && plaza.province !== filter.province) continue;
    if (filter.type && plaza.type !== filter.type) continue;

    let score = 1;
    if (terms.length) {
      const name = fold(plaza.name);
      const aliases = (plaza.aliases ?? []).map(fold);
      const op = operators.get(plaza.operatorId);
      const road = roads.get(plaza.tollRoadId);
      const haystack = fold(
        [
          plaza.route,
          op?.name,
          op?.shortName,
          road?.name,
          plaza.locality,
          plaza.province ? PROVINCE_NAMES[plaza.province] : '',
          plaza.type,
        ]
          .filter(Boolean)
          .join(' '),
      );
      score = 0;
      for (const term of terms) {
        let s = 0;
        if (name === term || aliases.includes(term)) s = 100;
        else if (name.startsWith(term) || aliases.some((a) => a.startsWith(term))) s = 60;
        else if (name.includes(term) || aliases.some((a) => a.includes(term))) s = 40;
        else if (haystack.split(' ').includes(term)) s = 25;
        else if (haystack.includes(term)) s = 10;
        if (s === 0) {
          score = 0;
          break;
        }
        score += s;
      }
      if (score === 0) continue;
    }
    const result: PlazaSearchResult = { plaza, score };
    if (near && plaza.location) result.distanceMetres = haversineMetres(near, plaza.location);
    results.push(result);
  }

  return sortPlazaResults(results, near ? 'distance' : 'relevance');
}

/**
 * Orders for a list of plazas. `relevance` is the best match to the search text, then road order.
 * The price orders use the price shown in the list (one vehicle class).
 */
export type PlazaSort = 'relevance' | 'name' | 'price_low' | 'price_high' | 'province' | 'distance';

const byRoad = (a: Plaza, b: Plaza) =>
  a.route.localeCompare(b.route, 'en', { numeric: true }) || a.name.localeCompare(b.name, 'en');
const lastIfMissing = (a: unknown, b: unknown) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : 0);

/**
 * Sorts search results (a new array; the input is unchanged). Plazas missing the value being sorted on (no current
 * price, no recorded province, no known position) always come last, in road order, whichever direction is chosen.
 * `priceCents` returns the price to sort by, or null when there is no current tariff.
 */
export function sortPlazaResults(
  results: readonly PlazaSearchResult[],
  sort: PlazaSort,
  priceCents: (plaza: Plaza) => number | null = () => null,
): PlazaSearchResult[] {
  const prices =
    sort === 'price_low' || sort === 'price_high' ? new Map(results.map((r) => [r, priceCents(r.plaza)])) : null;
  return [...results].sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.plaza.name.localeCompare(b.plaza.name, 'en', { sensitivity: 'base' }) || byRoad(a.plaza, b.plaza);
      case 'price_low':
      case 'price_high': {
        const pa = prices!.get(a) ?? null;
        const pb = prices!.get(b) ?? null;
        const missing = lastIfMissing(pa, pb);
        if (missing || pa === null || pb === null) return missing || byRoad(a.plaza, b.plaza);
        return (sort === 'price_low' ? pa - pb : pb - pa) || byRoad(a.plaza, b.plaza);
      }
      case 'province': {
        const pa = a.plaza.province ? PROVINCE_NAMES[a.plaza.province] : null;
        const pb = b.plaza.province ? PROVINCE_NAMES[b.plaza.province] : null;
        const missing = lastIfMissing(pa, pb);
        if (missing || pa === null || pb === null) return missing || byRoad(a.plaza, b.plaza);
        return pa.localeCompare(pb, 'en') || byRoad(a.plaza, b.plaza);
      }
      case 'distance': {
        const missing = lastIfMissing(a.distanceMetres, b.distanceMetres);
        if (missing) return missing;
        const d = (a.distanceMetres ?? 0) - (b.distanceMetres ?? 0);
        if (d !== 0) return d;
        break;
      }
      case 'relevance':
        break;
    }
    return b.score - a.score || byRoad(a.plaza, b.plaza);
  });
}

/** Distinct routes present in the published dataset, in natural order (N1, N2, …, N17). */
export function availableRoutes(dataset: Dataset): string[] {
  return [...new Set(dataset.plazas.filter((p) => p.publicationStatus === 'published').map((p) => p.route))].sort(
    (a, b) => a.localeCompare(b, 'en', { numeric: true }),
  );
}

/** Operators with at least one published, active plaza, by short name. */
export function availableOperators(dataset: Dataset): Operator[] {
  const ids = new Set(
    dataset.plazas.filter((p) => p.publicationStatus === 'published' && p.status === 'active').map((p) => p.operatorId),
  );
  return dataset.operators.filter((o) => ids.has(o.id)).sort((a, b) => a.shortName.localeCompare(b.shortName, 'en'));
}

export function availableProvinces(dataset: Dataset): ProvinceCode[] {
  return [
    ...new Set(
      dataset.plazas
        .filter((p) => p.publicationStatus === 'published' && p.province)
        .map((p) => p.province as ProvinceCode),
    ),
  ].sort((a, b) => PROVINCE_NAMES[a].localeCompare(PROVINCE_NAMES[b]));
}
