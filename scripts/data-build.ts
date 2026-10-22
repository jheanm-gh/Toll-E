/**
 * Build everything derived from data/:
 *   apps/mobile/src/data/generated/dataset.json  bundled offline snapshot (published records only)
 *   supabase/seed.sql                            database seed (all records)
 *   docs/coverage-register.md                    honest per-plaza coverage
 *
 * Refuses to build if validation finds errors.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parseDataset, validateDataset } from '../packages/core/src/index.ts';
import { renderCoverageMarkdown } from './lib/coverage-md.ts';
import { ROOT, loadDataset, publishedSubset, today } from './lib/data.ts';
import { datasetToSeedSql } from './lib/seed-sql.ts';

const { dataset, csvErrors } = loadDataset();
if (csvErrors.length) {
  for (const { file, errors } of csvErrors) for (const e of errors) console.error(`✖ ${file}:${e.row} ${e.message}`);
  process.exit(1);
}
const parsed = parseDataset(dataset);
if (!parsed.ok) {
  for (const e of parsed.errors) console.error(`✖ ${e}`);
  process.exit(1);
}
const errors = validateDataset(dataset, { today: today() }).filter((i) => i.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(`✖ ${e.entity} ${e.id}: [${e.code}] ${e.message}`);
  console.error('Refusing to build: fix the errors above (npm run data:validate).');
  process.exit(1);
}

const write = (rel: string, content: string) => {
  const path = join(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`wrote ${rel} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
};

const bundle = publishedSubset(dataset);
// Stable output so diffs only show real data changes.
bundle.generatedAt = `${dataset.datasetVersion.slice(0, 10)}T00:00:00Z`;
write('apps/mobile/src/data/generated/dataset.json', JSON.stringify(bundle));
write('supabase/seed.sql', datasetToSeedSql(dataset));
write('docs/coverage-register.md', renderCoverageMarkdown(dataset, today()));
