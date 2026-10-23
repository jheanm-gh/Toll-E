// Render the Toll-E mark to the PNG sizes Expo needs, using Playwright's Chromium.
//   node scripts/generate-icons.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { COLORS, mark } from './lib/brand.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'apps/mobile/assets/images');
const { navy: NAVY } = COLORS;

const targets = [
  // App icon: full-bleed navy tile (stores apply their own corner masks).
  {
    file: 'icon.png',
    size: 1024,
    svg: `<rect width="64" height="64" fill="${NAVY}"/><g transform="translate(3.2 3.2) scale(0.9)">${mark()}</g>`,
  },
  // Android adaptive foreground: transparent, mark inside the 66% safe zone.
  {
    file: 'android-icon-foreground.png',
    size: 1024,
    svg: `<g transform="translate(14.4 14.4) scale(0.55)">${mark()}</g>`,
  },
  {
    file: 'android-icon-monochrome.png',
    size: 1024,
    svg: `<g transform="translate(14.4 14.4) scale(0.55)">${mark('#000', '#000', '#000', '#000')}</g>`,
  },
  { file: 'android-icon-background.png', size: 1024, svg: `<rect width="64" height="64" fill="${NAVY}"/>` },
  // Splash: transparent mark on the navy splash background.
  { file: 'splash-icon.png', size: 512, svg: `<g transform="translate(2 2) scale(0.94)">${mark()}</g>` },
  {
    file: 'favicon.png',
    size: 96,
    svg: `<rect width="64" height="64" rx="14" fill="${NAVY}"/><g transform="translate(4 4) scale(0.875)">${mark()}</g>`,
  },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <svg xmlns="http://www.w3.org/2000/svg" width="${t.size}" height="${t.size}" viewBox="0 0 64 64">${t.svg}</svg></body></html>`);
  await page.locator('svg').screenshot({ path: join(out, t.file), omitBackground: true });
  console.log('wrote', t.file);
}
await browser.close();
