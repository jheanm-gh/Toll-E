/**
 * Validate the canonical dataset in data/. Exits non-zero on any error.
 *   npm run data:validate            errors and a warning summary
 *   npm run data:validate -- --all   list every warning
 */
import { parseDataset, validateDataset } from '../packages/core/src/index.ts';
import { loadDataset, today } from './lib/data.ts';

const showAll = process.argv.includes('--all');
const { dataset, csvErrors } = loadDataset();
let failed = false;

for (const { file, errors } of csvErrors) {
  failed = true;
  for (const e of errors) console.error(`✖ ${file}:${e.row} ${e.message}`);
}

const parsed = parseDataset(dataset);
if (!parsed.ok) {
  failed = true;
  for (const e of parsed.errors) console.error(`✖ schema: ${e}`);
} else {
  const issues = validateDataset(parsed.value, { today: today() });
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  for (const e of errors) console.error(`✖ ${e.entity} ${e.id}: [${e.code}] ${e.message}`);
  if (errors.length) failed = true;

  const byCode = new Map<string, number>();
  for (const w of warnings) byCode.set(w.code, (byCode.get(w.code) ?? 0) + 1);
  if (showAll) for (const w of warnings) console.warn(`⚠ ${w.entity} ${w.id}: [${w.code}] ${w.message}`);
  console.log(
    `\n${dataset.plazas.length} plazas, ${dataset.tariffs.length} tariffs, ${dataset.journeys.length} journeys, ${dataset.sources.length} sources`,
  );
  console.log(`${errors.length} errors, ${warnings.length} warnings`);
  for (const [code, n] of [...byCode].sort((a, b) => b[1] - a[1])) console.log(`  ${code}: ${n}`);
}

if (failed) {
  console.error('\nData validation failed.');
  process.exit(1);
}
console.log('\nData validation passed.');
