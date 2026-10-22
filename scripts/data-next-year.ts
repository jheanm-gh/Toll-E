/**
 * Start next year's tariff schedule from the current one.
 *   npm run data:next-year -- --from sanral-2026 --to sanral-2027 --effective 2027-03-01 --source <new-source-id>
 *
 * Creates data/tariffs/<to>.csv with one row per plaza and class, the previous amount shown
 * for reference and the NEW amount left blank (so nothing can be carried over by mistake),
 * and adds the schedule to data/schedules.json. Add the new Gazette/operator source to
 * data/sources.json first.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatZAR, isISODate, toCsv, type TariffSchedule } from '../packages/core/src/index.ts';
import { parseArgs } from './lib/args.ts';
import { DATA_DIR, loadDataset, today } from './lib/data.ts';
import { writeJsonFile } from './lib/json-file.ts';

const { flags } = parseArgs(process.argv.slice(2));
const from = String(flags.from ?? '');
const to = String(flags.to ?? '');
const effective = String(flags.effective ?? '');
const sourceId = String(flags.source ?? '');
const fail = (m: string): never => {
  console.error(`✖ ${m}`);
  process.exit(1);
};
if (!from || !to || !isISODate(effective) || !sourceId) {
  fail(
    'Usage: npm run data:next-year -- --from <schedule> --to <new-schedule> --effective YYYY-MM-DD --source <source-id>',
  );
}
const { dataset } = loadDataset();
const prev = dataset.schedules.find((s) => s.id === from) ?? fail(`unknown schedule ${from}`);
if (dataset.schedules.some((s) => s.id === to)) fail(`schedule ${to} already exists`);
if (!dataset.sources.some((s) => s.id === sourceId)) fail(`add source "${sourceId}" to data/sources.json first`);
const csvPath = join(DATA_DIR, 'tariffs', `${to}.csv`);
if (existsSync(csvPath)) fail(`${csvPath} already exists`);

const current = dataset.tariffs.filter((t) => t.scheduleId === from && t.publicationStatus === 'published');
const header = [
  'plaza_id',
  'vehicle_class',
  'previous_amount',
  'amount',
  'schedule_id',
  'effective_from',
  'effective_to',
  'direction',
  'condition',
  'verification_status',
  'publication_status',
  'source_id',
  'source_locator',
  'checked_on',
  'verified_on',
  'verified_by',
  'notes',
];
const rows = current.map((t) => [
  t.plazaId,
  t.vehicleClassId,
  formatZAR(t.amountCents).replace('R', '').replace(/ /g, ''),
  '',
  to,
  effective,
  '',
  t.direction,
  t.condition ?? '',
  'unverified',
  'published',
  sourceId,
  '',
  today(),
  '',
  '',
  '',
]);
writeFileSync(
  csvPath,
  `# ${to}: fill in the "amount" column from the official document. previous_amount is for reference only.\n` +
    toCsv(header, rows),
);

const schedules = JSON.parse(readFileSync(join(DATA_DIR, 'schedules.json'), 'utf8')) as TariffSchedule[];
const year = Number(effective.slice(0, 4));
schedules.push({
  id: to,
  name: `${prev.name.replace(/\d{4}.*$/, '').trim()} ${effective.slice(0, 4)}`.trim(),
  operatorIds: prev.operatorIds,
  effectiveFrom: effective,
  effectiveTo: prev.effectiveTo === null ? null : `${year + 1}-02-28`,
  nextReviewExpected: `${year + 1}${effective.slice(4)}`,
  sourceIds: [sourceId],
  notes: 'Set adjustmentBps to the published percentage × 100 (e.g. 3.12% → 312) so unusual changes are flagged.',
});
void writeJsonFile(join(DATA_DIR, 'schedules.json'), schedules).then(() => {
  console.log(`Created ${csvPath} with ${rows.length} rows to fill in, and schedule ${to} in data/schedules.json.`);
  console.log('Check the schedule name, end date and adjustmentBps in data/schedules.json.');
});
