# Toll-E brand files

Editable vector masters (SVG) and ready-made renders (PNG). The SVGs open in Figma, Illustrator, Inkscape,
Affinity Designer and Canva. The wordmark is outlined, so no font needs to be installed.

| File | What it is |
| --- | --- |
| `toll-e-logo.svg` / `.png` | Mark + "Toll-E" wordmark, for light backgrounds |
| `toll-e-logo-inverse.svg` / `.png` | The same, for navy or dark backgrounds |
| `toll-e-mark.svg` / `toll-e-mark-1024.png` | The boom-gate symbol on its rounded navy tile |
| `toll-e-symbol.svg` | The symbol alone, transparent background (for dark backgrounds) |
| `toll-e-app-icon.svg` / `toll-e-app-icon-1024.png` | App-icon artwork: square, full-bleed navy (stores round the corners) |

## Colours

| Name | Hex | Used for |
| --- | --- | --- |
| Navy | `#0B1F3A` | Tile, "Toll" on light backgrounds |
| Teal | `#16A3A5` | Gate arm |
| Teal (dark) | `#0E8A8C` | "-E" on light backgrounds |
| Teal (light) | `#D3EFEF` | Base; "-E" on dark backgrounds |
| Amber | `#F2A93B` | Hinge |
| White | `#FFFFFF` | Post, arm stripes, "Toll" on dark backgrounds |

Typeface: **Plus Jakarta Sans Bold** (open source, SIL Open Font License), tracking −0.6 at 24 pt.

## Changing the design

Edit the SVGs however you like, then send back the edited SVG (or a 1024 × 1024 PNG for the icon). To put a new
design into the app, a developer:

1. updates the shapes in `scripts/lib/brand.mjs` **and** `apps/mobile/src/components/brand/Logo.tsx` (the in-app logo);
2. runs `node scripts/generate-icons.mjs` (the app icons, Android adaptive icon, splash and favicon in
   `apps/mobile/assets/images/`) and `node scripts/export-brand.mjs` (these files);
3. reruns `node scripts/store-assets.mjs` for the Play Store icon and feature graphic.

Keep the symbol simple. It has to read at 48 × 48 pixels on a phone home screen. Android crops icons to
a circle or squircle, so keep important detail inside the middle two-thirds.
