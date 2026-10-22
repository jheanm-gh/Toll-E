/**
 * Used by scripts/db-test.sh: generate the Supabase update SQL for a mock 2027 schedule
 * (Verkeerdevlei, all classes, +3%) exactly as data:supabase-sql would.
 */
import { writeFileSync } from 'node:fs';

import { applyBps, type Tariff } from '../packages/core/src/index.ts';
import { loadDataset } from './lib/data.ts';
import { scheduleUpdateSql } from './lib/schedule-sql.ts';

const out = process.argv[2]!;
const { dataset } = loadDataset();
dataset.schedules.push({
  id: 'sanral-2027-drill',
  name: 'Drill 2027',
  operatorIds: ['sanral'],
  effectiveFrom: '2027-03-01',
  effectiveTo: null,
  nextReviewExpected: '2028-03-01',
  adjustmentBps: 300,
  sourceIds: ['sanral-tariffs-2026-poster'],
});
const current = dataset.tariffs.filter((t) => t.scheduleId === 'sanral-2026' && t.plazaId === 'n1-verkeerdevlei');
const drafts: Tariff[] = current.map((t) => ({
  ...t,
  id: `sanral-2027-drill-${t.plazaId}-${t.vehicleClassId}`,
  scheduleId: 'sanral-2027-drill',
  amountCents: applyBps(t.amountCents, 300),
  effectiveFrom: '2027-03-01',
  verificationStatus: 'unverified',
  verifiedOn: null,
  verifiedBy: null,
}));
dataset.tariffs.push(...drafts);
writeFileSync(out, scheduleUpdateSql(dataset, 'sanral-2027-drill'));
console.log(`  drill SQL: ${drafts.length} draft tariffs`);
