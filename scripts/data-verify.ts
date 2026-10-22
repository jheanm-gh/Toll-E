/**
 * Record a human verification in the data files. Run it only after you have compared each
 * value with the official document yourself.
 *
 * Tariffs (edits data/tariffs/*.csv):
 *   npm run data:verify -- --by "Full Name" --against <official-source-id> --schedule sanral-2026 [--plazas a,b] [--classes class1,class2] [--except id1,id2]
 *   npm run data:verify -- --by "Full Name" --against <official-source-id> --ids <tariff-id>,<tariff-id>
 *   Correct a value while verifying:  --correct <tariff-id>=<amount in rand>   (repeatable via commas)
 * Journey plaza sequences (edits data/journeys.json):
 *   npm run data:verify -- --by "Full Name" --journey jhb-dbn-n3
 *
 * Options: --date YYYY-MM-DD (default: today in South Africa), --dry-run
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isISODate,
  parseCsv,
  parseRandToCents,
  formatZAR,
  toCsv,
  tariffId,
  type Journey,
} from '../packages/core/src/index.ts';
import { list, parseArgs } from './lib/args.ts';
import { DATA_DIR, today } from './lib/data.ts';

const { flags } = parseArgs(process.argv.slice(2));
const by = typeof flags.by === 'string' ? flags.by.trim() : '';
const date = typeof flags.date === 'string' ? flags.date : today();
const dryRun = flags['dry-run'] === true;
const fail = (m: string): never => {
  console.error(`✖ ${m}`);
  process.exit(1);
};

if (by.length < 3) fail('Give your full name with --by "Full Name".');
if (!isISODate(date) || date > today()) fail(`--date must be a real date not in the future (got ${date}).`);

if (typeof flags.journey === 'string') {
  const path = join(DATA_DIR, 'journeys.json');
  const journeys = JSON.parse(readFileSync(path, 'utf8')) as Journey[];
  const j = journeys.find((x) => x.id === flags.journey);
  if (!j) fail(`No journey "${flags.journey}".`);
  j!.sequenceStatus = 'verified';
  j!.sequenceVerifiedOn = date;
  j!.sequenceVerifiedBy = by;
  if (!dryRun) writeFileSync(path, JSON.stringify(journeys, null, 2) + '\n');
  console.log(`${dryRun ? '[dry run] ' : ''}Journey ${j!.id}: plaza sequence marked verified by ${by} on ${date}.`);
  process.exit(0);
}

const against =
  typeof flags.against === 'string'
    ? flags.against
    : fail('Name the official source you checked with --against <source-id>.');
const sources = JSON.parse(readFileSync(join(DATA_DIR, 'sources.json'), 'utf8')) as {
  id: string;
  official: boolean;
  title: string;
}[];
const source = sources.find((s) => s.id === against);
if (!source) fail(`Unknown source "${against}". See data/sources.json.`);
if (!source!.official)
  fail(`"${against}" is not an official source. Verification must be against the Gazette, SANRAL or the operator.`);

const schedule = typeof flags.schedule === 'string' ? flags.schedule : null;
const ids = new Set(list(flags.ids));
const plazas = new Set(list(flags.plazas));
const classes = new Set(list(flags.classes));
const except = new Set(list(flags.except));
const corrections = new Map(
  list(flags.correct).map((c) => {
    const [id, amount] = c.split('=');
    if (!id || !amount) fail(`--correct expects <tariff-id>=<amount>, got "${c}"`);
    return [id!, parseRandToCents(amount!)] as const;
  }),
);
if (!schedule && ids.size === 0) fail('Choose rows with --schedule <id> (optionally --plazas/--classes) or --ids.');

let changed = 0;
const touchedCorrections = new Set<string>();
const dir = join(DATA_DIR, 'tariffs');
for (const file of readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  const comments = text.split('\n').filter((l) => l.startsWith('#'));
  const rows = parseCsv(text).filter((r) => !(r[0] ?? '').startsWith('#'));
  const [header, ...body] = rows;
  if (!header) continue;
  const col = (name: string) => header.indexOf(name);
  let fileChanged = false;
  for (const r of body) {
    const get = (n: string) => r[col(n)] ?? '';
    const set = (n: string, v: string) => (r[col(n)] = v);
    const id = tariffId({
      scheduleId: get('schedule_id'),
      plazaId: get('plaza_id'),
      vehicleClassId: get('vehicle_class'),
      direction: (get('direction') || 'any') as never,
    });
    const selected = ids.size
      ? ids.has(id)
      : get('schedule_id') === schedule &&
        (plazas.size === 0 || plazas.has(get('plaza_id'))) &&
        (classes.size === 0 || classes.has(get('vehicle_class')));
    if (!selected || except.has(id) || get('publication_status') === 'withdrawn') continue;
    const correction = corrections.get(id);
    const notes = [get('notes')];
    if (correction !== undefined) {
      const old = parseRandToCents(get('amount'));
      if (old !== correction) notes.push(`Corrected from ${formatZAR(old)} on verification.`);
      set('amount', (correction / 100).toFixed(2));
      touchedCorrections.add(id);
    }
    if (get('source_id') !== against) notes.push(`Previously sourced from ${get('source_id')}.`);
    notes.push(`Verified against ${source!.title} by ${by} on ${date}.`);
    set('verification_status', 'verified');
    set('verified_on', date);
    set('verified_by', by);
    set('checked_on', date);
    set('source_id', against);
    set('notes', notes.filter(Boolean).join(' '));
    changed++;
    fileChanged = true;
    console.log(`  ✔ ${id}${correction !== undefined ? ` (amount ${formatZAR(correction)})` : ''}`);
  }
  if (fileChanged && !dryRun)
    writeFileSync(path, (comments.length ? comments.join('\n') + '\n' : '') + toCsv(header, body));
}
for (const id of corrections.keys())
  if (!touchedCorrections.has(id)) fail(`--correct ${id}: no selected row has that id.`);
console.log(
  `\n${dryRun ? '[dry run] ' : ''}${changed} tariff rows marked verified against ${against} by ${by} on ${date}.`,
);
console.log('Next: npm run data:validate && npm run data:build, then apply to Supabase (docs/data-operations.md).');
