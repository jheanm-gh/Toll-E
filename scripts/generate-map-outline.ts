/**
 * Generate the bundled offline map outline (South Africa and neighbours) from Natural Earth
 * 1:50m country boundaries (public domain) via the world-atlas package.
 *   npx tsx scripts/generate-map-outline.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

import { ROOT } from './lib/data.ts';

const topo = JSON.parse(readFileSync(join(ROOT, 'node_modules/world-atlas/countries-50m.json'), 'utf8')) as Topology<{
  countries: GeometryCollection<{ name: string }>;
}>;

// ISO 3166-1 numeric codes
const WANTED: Record<string, string> = {
  '710': 'South Africa',
  '426': 'Lesotho',
  '748': 'Eswatini',
  '516': 'Namibia',
  '072': 'Botswana',
  '716': 'Zimbabwe',
  '508': 'Mozambique',
};

const all = feature(topo, topo.objects.countries) as FeatureCollection<Polygon | MultiPolygon, { name: string }>;
const round = (p: Position): Position => [Math.round(p[0]! * 1000) / 1000, Math.round(p[1]! * 1000) / 1000];
const roundRing = (ring: Position[]) =>
  ring.map(round).filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1]![0] || p[1] !== arr[i - 1]![1]);

const features: Feature<Polygon | MultiPolygon, { iso: string; name: string; home: boolean }>[] = all.features
  .filter((f) => WANTED[String(f.id)])
  .map((f) => {
    const g = f.geometry;
    const geometry: Polygon | MultiPolygon =
      g.type === 'Polygon'
        ? { type: 'Polygon', coordinates: g.coordinates.map(roundRing) }
        : { type: 'MultiPolygon', coordinates: g.coordinates.map((poly) => poly.map(roundRing)) };
    return {
      type: 'Feature',
      properties: { iso: String(f.id), name: WANTED[String(f.id)]!, home: String(f.id) === '710' },
      geometry,
    };
  });

const out: FeatureCollection = { type: 'FeatureCollection', features };
const path = join(ROOT, 'apps/mobile/src/components/map/region-outline.json');
writeFileSync(path, JSON.stringify(out));
console.log(`wrote ${path} with ${features.length} countries (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
