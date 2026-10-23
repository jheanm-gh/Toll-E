// The Toll-E mark, shared by scripts/generate-icons.mjs and scripts/export-brand.mjs.
// apps/mobile/src/components/brand/Logo.tsx draws the same geometry for the in-app logo:
// change both together.
export const COLORS = {
  navy: '#0B1F3A',
  teal: '#16A3A5',
  teal600: '#0E8A8C',
  teal100: '#D3EFEF',
  amber: '#F2A93B',
  white: '#FFFFFF',
};

/** The boom gate: post, striped arm, amber hinge and base, in a 64-unit box. */
export const mark = (fg = COLORS.white, bar = COLORS.teal, hinge = COLORS.amber, base = COLORS.teal100) => `
  <rect x="14" y="16" width="8" height="30" rx="2.5" fill="${fg}"/>
  <rect x="18" y="18" width="36" height="8" rx="4" fill="${bar}"/>
  <rect x="30" y="18" width="6" height="8" fill="${fg}"/>
  <rect x="42" y="18" width="6" height="8" fill="${fg}"/>
  <circle cx="18" cy="22" r="5.5" fill="${hinge}"/>
  <rect x="10" y="44" width="16" height="4" rx="2" fill="${base}"/>`;
