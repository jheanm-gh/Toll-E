/**
 * Check that the database's public feed (published_dataset()) is a valid Dataset and contains
 * exactly the published records from data/. Used by scripts/db-test.sh.
 */
import { readFileSync } from 'node:fs';

import { parseDataset, validateDataset, type Dataset } from '../packages/core/src/index.ts';
import { loadDataset, publishedSubset, today } from './lib/data.ts';

const file = process.argv[2];
if (!file) throw new Error('usage: check-db-dataset <published.json>');

const parsed = parseDataset(JSON.parse(readFileSync(file, 'utf8')));
if (!parsed.ok) {
  console.error('✖ published_dataset() does not match the Dataset schema:');
  for (const e of parsed.errors) console.error(`  ${e}`);
  process.exit(1);
}
const errors = validateDataset(parsed.value, { today: today() }).filter((i) => i.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(`✖ ${e.entity} ${e.id}: ${e.message}`);
  process.exit(1);
}

const normalise = (d: Dataset) => {
  const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(
    {
      ...d,
      generatedAt: null,
      sources: byId(d.sources),
      operators: byId(d.operators),
      tollRoads: byId(d.tollRoads),
      vehicleClassSchemes: byId(d.vehicleClassSchemes),
      plazas: byId(d.plazas),
      schedules: byId(d.schedules),
      tariffs: byId(d.tariffs),
      journeys: byId(d.journeys),
      notices: byId(d.notices),
    },
    (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v),
  );
};

const expected = normalise(publishedSubset(loadDataset().dataset));
const actual = normalise(parsed.value);
if (expected !== actual) {
  const a = JSON.parse(actual);
  const e = JSON.parse(expected);
  for (const key of Object.keys(e)) {
    if (JSON.stringify(a[key]) !== JSON.stringify(e[key])) {
      console.error(`✖ "${key}" differs between the database feed and data/`);
      const ea = e[key];
      const aa = a[key];
      if (Array.isArray(ea) && Array.isArray(aa)) {
        for (let i = 0; i < Math.max(ea.length, aa.length); i++) {
          if (JSON.stringify(ea[i]) !== JSON.stringify(aa[i])) {
            console.error('  expected:', JSON.stringify(ea[i]));
            console.error('  actual:  ', JSON.stringify(aa[i]));
            break;
          }
        }
      }
    }
  }
  process.exit(1);
}
console.log(
  `  ok: feed has ${parsed.value.plazas.length} plazas, ${parsed.value.tariffs.length} tariffs, ${parsed.value.journeys.length} journeys and matches data/`,
);
