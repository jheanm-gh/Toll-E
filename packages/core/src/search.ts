import { haversineMetres, type LatLng } from './geo';
import type { Dataset, Plaza, PlazaType, ProvinceCode } from './model';

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

  return results.sort((a, b) => {
    if (near) {
      const da = a.distanceMetres ?? Number.POSITIVE_INFINITY;
      const db = b.distanceMetres ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
    }
    if (b.score !== a.score) return b.score - a.score;
    return (
      a.plaza.route.localeCompare(b.plaza.route, 'en', { numeric: true }) || a.plaza.name.localeCompare(b.plaza.name)
    );
  });
}

/** Distinct routes present in the published dataset, in natural order (N1, N2, …, N17). */
export function availableRoutes(dataset: Dataset): string[] {
  return [...new Set(dataset.plazas.filter((p) => p.publicationStatus === 'published').map((p) => p.route))].sort(
    (a, b) => a.localeCompare(b, 'en', { numeric: true }),
  );
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
