// Capture phone-sized screenshots of the web build for visual review.
//   npm run build:web && npx serve -s apps/mobile/dist -l 8081 &
//   node scripts/screenshots.mjs <outDir> "/path|name[|full]" ...
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [outDir, ...routes] = process.argv.slice(2);
const base = process.env.BASE_URL ?? 'http://localhost:8081';
const width = Number(process.env.WIDTH ?? 390);
const height = Number(process.env.HEIGHT ?? 844);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => errors.push(`PAGEERROR ${String(e).slice(0, 300)}`));
for (const r of routes) {
  const [path, name, mode] = r.split('|');
  await page.goto(base + path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: mode === 'full' });
  console.log('shot', name);
}
if (errors.length) console.log('console errors:', JSON.stringify([...new Set(errors)].slice(0, 20), null, 1));
await browser.close();
