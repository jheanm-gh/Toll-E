// Export the Toll-E brand files for editing and for use outside the app:
//   node scripts/export-brand.mjs   → apps/mobile/assets/brand/*.svg and *.png
// The SVGs are plain vector files (the wordmark is outlined, so no font is needed). They open in
// Figma, Illustrator, Inkscape, Affinity and Canva. See apps/mobile/assets/brand/README.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

import { COLORS, mark } from './lib/brand.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'apps/mobile/assets/brand');
const word = JSON.parse(readFileSync(join(out, 'wordmark.json'), 'utf8'));

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n` +
  `  <title>${title}</title>\n${body}\n</svg>\n`;
const tile = `<rect width="64" height="64" rx="16" fill="${COLORS.navy}"/>`;

// Logo: the 36-unit mark tile, a 10-unit gap, then the wordmark with its capitals centred on the tile.
const MARK = 36;
const GAP = 10;
// Two units of margin on the right so the "E" is never clipped.
const width = Math.ceil(MARK + GAP + word.width + 2);
const baseline = (MARK / 2 + word.capHeight / 2).toFixed(2);
const logo = (toll, e) =>
  `  <g transform="scale(${MARK / 64})">${tile}${mark()}</g>\n` +
  `  <g transform="translate(${MARK + GAP} ${baseline})">\n` +
  `    <path d="${word.toll}" fill="${toll}"/>\n    <path d="${word.e}" fill="${e}"/>\n  </g>`;

const files = {
  'toll-e-logo.svg': svg(width, MARK, logo(COLORS.navy, COLORS.teal600), 'Toll-E logo (light backgrounds)'),
  'toll-e-logo-inverse.svg': svg(width, MARK, logo(COLORS.white, COLORS.teal100), 'Toll-E logo (dark backgrounds)'),
  'toll-e-mark.svg': svg(64, 64, `  ${tile}${mark()}`, 'Toll-E mark on its navy tile'),
  'toll-e-symbol.svg': svg(64, 64, `  ${mark()}`, 'Toll-E boom-gate symbol (transparent, for dark backgrounds)'),
  'toll-e-app-icon.svg': svg(
    64,
    64,
    `  <rect width="64" height="64" fill="${COLORS.navy}"/><g transform="translate(3.2 3.2) scale(0.9)">${mark()}</g>`,
    'Toll-E app icon artwork (square; stores apply their own corner mask)',
  ),
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(out, name), content);
  console.log('wrote', name);
}

// PNG renders for documents and slides.
const renders = [
  ['toll-e-logo.svg', 'toll-e-logo.png', 10, 'white'],
  ['toll-e-logo-inverse.svg', 'toll-e-logo-inverse.png', 10, COLORS.navy],
  ['toll-e-mark.svg', 'toll-e-mark-1024.png', 16, 'transparent'],
  ['toll-e-app-icon.svg', 'toll-e-app-icon-1024.png', 16, 'transparent'],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, png, scale, bg] of renders) {
  const content = files[src];
  const [, w, h] = content.match(/width="(\d+)" height="(\d+)"/);
  await page.setViewportSize({ width: w * scale, height: h * scale });
  await page.setContent(
    `<html><body style="margin:0;background:${bg}">${content.replace(/width="\d+" height="\d+"/, `width="${w * scale}" height="${h * scale}"`)}</body></html>`,
  );
  await page.locator('svg').screenshot({ path: join(out, png), omitBackground: bg === 'transparent' });
  console.log('wrote', png);
}
await browser.close();
