/**
 * Write the SQL that loads one tariff schedule into Supabase as drafts.
 *   npm run data:supabase-sql -- --schedule sanral-2027
 *   → imports/sanral-2027.sql (paste into Supabase → SQL editor)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseDataset, validateDataset } from '../packages/core/src/index.ts';
import { parseArgs } from './lib/args.ts';
import { ROOT, loadDataset, today } from './lib/data.ts';
import { scheduleUpdateSql } from './lib/schedule-sql.ts';

const { flags } = parseArgs(process.argv.slice(2));
const scheduleId = typeof flags.schedule === 'string' ? flags.schedule : '';
if (!scheduleId) {
  console.error('Usage: npm run data:supabase-sql -- --schedule <schedule-id>');
  process.exit(1);
}
const { dataset, csvErrors } = loadDataset();
const parsed = parseDataset(dataset);
const errors = parsed.ok ? validateDataset(dataset, { today: today() }).filter((i) => i.severity === 'error') : [];
if (csvErrors.length || !parsed.ok || errors.length) {
  console.error('✖ Fix the data errors first: npm run data:validate');
  process.exit(1);
}
const sql = scheduleUpdateSql(dataset, scheduleId);
const out = typeof flags.out === 'string' ? flags.out : join(ROOT, 'imports', `${scheduleId}.sql`);
mkdirSync(join(out, '..'), { recursive: true });
writeFileSync(out, sql);
console.log(`wrote ${out}`);
