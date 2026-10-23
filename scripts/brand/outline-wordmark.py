"""Outline the Toll-E wordmark ("Toll" + "-E") in Plus Jakarta Sans Bold as SVG path data.

  python3 -m venv .venv && .venv/bin/pip install fonttools uharfbuzz
  .venv/bin/python scripts/brand/outline-wordmark.py node_modules/@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf > apps/mobile/assets/brand/wordmark.json
"""
import json, sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = sys.argv[1]
SIZE, TRACKING = 24.0, -0.6   # same as components/brand/Logo.tsx
blob = hb.Blob.from_file_path(FONT)
face = hb.Face(blob); font = hb.Font(face)
tt = TTFont(FONT); gs = tt.getGlyphSet()
upem = tt['head'].unitsPerEm; s = SIZE / upem
cap = tt['OS/2'].sCapHeight * s
buf = hb.Buffer(); buf.add_str('Toll-E'); buf.guess_segment_properties()
hb.shape(font, buf, {'kern': True, 'liga': True})
order = tt.getGlyphOrder()
x = 0.0
parts = {'toll': '', 'e': ''}
for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
    name = order[info.codepoint]
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.'))
    gx = x + pos.x_offset * s
    # font units are y-up; SVG is y-down with the baseline at y=0
    gs[name].draw(TransformPen(pen, (s, 0, 0, -s, gx, 0)))
    parts['toll' if info.cluster < 4 else 'e'] += pen.getCommands()
    x += pos.x_advance * s + TRACKING
print(json.dumps({'toll': parts['toll'], 'e': parts['e'], 'width': round(x - TRACKING, 2), 'capHeight': round(cap, 2)}))
