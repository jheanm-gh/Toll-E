/**
 * Release gate: fails unless the published data meets the MVP release criteria
 * (verified official tariffs for every published plaza and class; verified journey sequences).
 *   npm run release:check            summary + first gaps
 *   npm run release:check -- --all   every gap
 */
import { formatZAR, releaseReadiness } from '../packages/core/src/index.ts';
import { loadDataset, publishedSubset, today } from './lib/data.ts';

const all = process.argv.includes('--all');
const report = releaseReadiness(publishedSubset(loadDataset().dataset), today());

console.log(`Release readiness for ${report.date}`);
console.log(
  `  plaza/class tariffs verified against an official source: ${report.verifiedSlots} of ${report.plazaClassSlots}`,
);
const byKind = new Map<string, number>();
for (const g of report.gaps) byKind.set(g.kind, (byKind.get(g.kind) ?? 0) + 1);
for (const [k, n] of byKind) console.log(`  ${k}: ${n}`);
console.log('\nCorridors (one way):');
for (const c of report.corridors) {
  const cells = Object.entries(c.byClass)
    .map(([cls, v]) => `${cls} ${v.priced}/${v.chargeable} ${formatZAR(v.totalCents)} ${v.trust ?? '-'}`)
    .join(' | ');
  console.log(`  ${c.name} (${c.via}) sequence ${c.sequenceVerified ? 'verified' : 'NOT verified'}: ${cells}`);
}
const shown = all ? report.gaps : report.gaps.slice(0, 15);
if (shown.length) {
  console.log(`\nGaps${all ? '' : ' (first 15; --all for every one)'}:`);
  for (const g of shown) console.log(`  ✖ [${g.kind}] ${g.id}: ${g.detail}`);
}
if (!report.ready) {
  console.error('\nNOT READY for a public release. See docs/verification/README.md.');
  process.exit(1);
}
console.log('\nReady: every published tariff and journey meets the release criteria.');
