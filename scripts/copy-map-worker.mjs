// MapLibre GL JS v6 locates its web worker with import.meta.url, which Metro does not support.
// Copy the worker into Expo's public/ folder so it is served next to the web bundle.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'apps/mobile/package.json'));
const src = join(dirname(require.resolve('maplibre-gl/package.json')), 'dist/maplibre-gl-worker.mjs');
const destDir = join(root, 'apps/mobile/public');
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, 'maplibre-gl-worker.mjs'));
console.log('copied maplibre-gl-worker.mjs to apps/mobile/public/');
