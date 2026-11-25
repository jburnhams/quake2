// The Quake theme's palette, as code: seeds and lightness ladders in, OKLCH ramps and roles out, so
// the colours are regenerated rather than hand-edited (the rule strata-react keeps for its own).
//
//   node scripts/palette.mjs          writes src/palette.generated.css
//   node scripts/palette.mjs --check  fails if that file is stale (tests/palette.test.ts runs this too)
//
// Why these seeds: the original game is brown-olive metal lit by orange (lava, lamps, the status
// bar's numbers) with the help computer's green phosphor as the one cold light. So the ground is an
// olive-tinted gunmetal, the primary is HUD amber (dark ink on it, like the numbers on the status
// bar), and the secondary is phosphor green, used only where attention already is (focus, the
// active row) as strata-react uses its marigold. Light is the same metal bleached by daylight:
// concrete ground, rust primary. Nothing here is sampled from id's art.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** OKLCH (L 0-1, C, H degrees) to linear sRGB. */
function oklchToLinear(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** The colour with its chroma cut until it fits sRGB, so every value prints the same everywhere. */
function fit({ l, c, h }) {
  let lo = 0;
  let hi = c;
  if (inGamut(oklchToLinear(l, c, h))) return { l, c, h };
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear(l, mid, h))) lo = mid;
    else hi = mid;
  }
  return { l, c: lo, h };
}

/** WCAG 2 relative luminance of an OKLCH colour. */
export function luminance({ l, c, h }) {
  const [r, g, b] = oklchToLinear(l, c, h).map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two OKLCH colours. */
export function contrast(x, y) {
  const [a, b] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (a + 0.05) / (b + 0.05);
}

/** Parses `oklch(L% C H)`. */
export function parse(css) {
  const m = /oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)/.exec(css);
  if (!m) throw new Error(`not an oklch() colour: ${css}`);
  return { l: +m[1] / 100, c: +m[2], h: +m[3] };
}

const print = ({ l, c, h }) => `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;

// Chroma along a ramp, as a share of the seed's: steps 1-2 are grounds (barely tinted), 3-5 fills,
// 6-8 borders, 9-10 solids at full strength, 11-12 text.
const CHROMA = [0.1, 0.14, 0.2, 0.26, 0.32, 0.38, 0.5, 0.66, 1, 0.95, 0.8, 0.35];

const ramp = (hue, chroma, ladder) => ladder.map((l, i) => fit({ l: l / 100, c: chroma * CHROMA[i], h: hue }));
const flat = (hue, chroma, ladder) => ladder.map((l) => fit({ l: l / 100, c: chroma, h: hue }));

export const SEEDS = {
  metal: { hue: 85, light: 0.014, dark: 0.016 },
  amber: { hue: 58, light: 0.15, dark: 0.165 },
  rust: { hue: 42, light: 0.15 },
  phosphor: { hue: 142, light: 0.15, dark: 0.19 },
};

const LADDERS = {
  light: {
    neutral: [94.5, 92.6, 90.2, 87.8, 85.4, 83.2, 75.5, 62.5, 53.5, 49, 40.5, 21],
    primary: [95, 93, 90.5, 88, 85.5, 83.5, 76, 63, 50, 45.5, 41, 22],
    secondary: [95, 93, 90.5, 88, 85.5, 83.5, 76, 63, 52, 47.5, 41, 22],
  },
  dark: {
    neutral: [16.4, 19.4, 22.4, 25.2, 28, 30.6, 37.5, 49.5, 58.5, 63.5, 74.5, 92.5],
    primary: [17, 20, 23.5, 26.5, 29.5, 31, 38, 50, 74, 79, 80, 95],
    secondary: [17, 20, 23.5, 26.5, 29.5, 31, 38, 50, 78, 83, 80, 95],
  },
};

/** Every value, per scheme: the three ramps, the roles strata-react names, and the charts. */
export function buildPalette() {
  const out = {};
  for (const scheme of ['light', 'dark']) {
    const L = LADDERS[scheme];
    const neutral = flat(SEEDS.metal.hue, SEEDS.metal[scheme], L.neutral);
    const primary =
      scheme === 'light' ? ramp(SEEDS.rust.hue, SEEDS.rust.light, L.primary) : ramp(SEEDS.amber.hue, SEEDS.amber.dark, L.primary);
    const secondary = ramp(SEEDS.phosphor.hue, SEEDS.phosphor[scheme], L.secondary);
    const ink = fit({ l: 0.15, c: 0.02, h: SEEDS.amber.hue });
    const white = { l: 1, c: 0, h: 0 };
    const red = fit(scheme === 'light' ? { l: 0.5, c: 0.17, h: 27 } : { l: 0.565, c: 0.18, h: 27 });
    const roles = {
      background: neutral[0],
      foreground: neutral[11],
      card: neutral[1],
      'card-foreground': neutral[11],
      popover: neutral[1],
      'popover-foreground': neutral[11],
      primary: primary[8],
      'primary-foreground': scheme === 'light' ? white : ink,
      secondary: secondary[2],
      'secondary-foreground': secondary[11],
      muted: neutral[2],
      'muted-foreground': neutral[10],
      accent: secondary[2],
      'accent-foreground': secondary[11],
      destructive: red,
      'destructive-foreground': white,
      border: neutral[5],
      input: neutral[7],
      ring: scheme === 'light' ? secondary[8] : secondary[8],
      // Charts: amber, phosphor, blood, steel blue, Strogg violet; each a hue the game lights with.
      'chart-1': scheme === 'light' ? fit({ l: 0.55, c: 0.15, h: 50 }) : fit({ l: 0.76, c: 0.16, h: 62 }),
      'chart-2': scheme === 'light' ? fit({ l: 0.52, c: 0.14, h: 142 }) : fit({ l: 0.78, c: 0.17, h: 142 }),
      'chart-3': scheme === 'light' ? fit({ l: 0.46, c: 0.16, h: 25 }) : fit({ l: 0.66, c: 0.18, h: 25 }),
      'chart-4': scheme === 'light' ? fit({ l: 0.5, c: 0.1, h: 240 }) : fit({ l: 0.72, c: 0.1, h: 235 }),
      'chart-5': scheme === 'light' ? fit({ l: 0.48, c: 0.15, h: 310 }) : fit({ l: 0.7, c: 0.15, h: 310 }),
    };
    const vars = { ...roles };
    neutral.forEach((v, i) => (vars[`neutral-${i + 1}`] = v));
    primary.forEach((v, i) => (vars[`primary-${i + 1}`] = v));
    secondary.forEach((v, i) => (vars[`secondary-${i + 1}`] = v));
    out[scheme] = vars;
  }
  return out;
}

export function paletteCss() {
  const p = buildPalette();
  const block = (vars) =>
    Object.entries(vars)
      .map(([k, v]) => `  --${k}: ${print(v)};`)
      .join('\n');
  return `/* Generated by packages/theme/scripts/palette.mjs; regenerate rather than edit (the reasons are there).
   Ramps: 1-2 grounds, 3-5 component fills, 6-8 borders, 9-10 solids, 11-12 text. Variable names are
   strata-react's contract, so strata.css's @theme maps them to bg-primary, text-muted-foreground and the rest. */
:root {
${block(p.light)}
}

.dark {
${block(p.dark)}
}
`;
}

const target = fileURLToPath(new URL('../src/palette.generated.css', import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = paletteCss();
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== css) {
      console.error('src/palette.generated.css is stale: run node scripts/palette.mjs');
      process.exit(1);
    }
  } else {
    writeFileSync(target, css);
  }
}
