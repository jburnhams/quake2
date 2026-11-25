// The palette is code (scripts/palette.mjs), so its promises are checked here rather than by eye:
// the generated CSS is current, and every pair a reader depends on clears WCAG's ratios in both
// schemes (4.5:1 for text, 3:1 for a control's edge, focus ring and filled button against the ground).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs script, without types
import { buildPalette, contrast, paletteCss, parse } from '../scripts/palette.mjs';

type Oklch = { l: number; c: number; h: number };
const palette = buildPalette() as Record<'light' | 'dark', Record<string, Oklch>>;
const themeCss = readFileSync(new URL('../src/quake.css', import.meta.url), 'utf8');

describe('palette.generated.css', () => {
  it('is what scripts/palette.mjs writes', () => {
    const onDisk = readFileSync(new URL('../src/palette.generated.css', import.meta.url), 'utf8');
    expect(onDisk).toBe(paletteCss());
  });
});

const TEXT: [string, string][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  // Links (TextLink) and the HUD ink of pane names and figures.
  ['primary-11', 'background'],
  ['primary-11', 'neutral-4'],
];
const EDGES: [string, string][] = [
  ['input', 'background'],
  ['ring', 'background'],
  ['primary', 'background'],
  ['chart-1', 'background'],
  ['chart-2', 'background'],
  ['chart-3', 'background'],
  ['chart-4', 'background'],
  ['chart-5', 'background'],
];

describe.each(['light', 'dark'] as const)('%s scheme', (scheme) => {
  const p = palette[scheme];
  it.each(TEXT)('%s on %s reads at 4.5:1 or better', (fg, bg) => {
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(EDGES)('%s against %s stands out at 3:1 or better', (fg, bg) => {
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(3);
  });

  // Strata's status inks are kept (a status means the same in every app); check they still read on
  // this theme's grounds and on the info wash the theme greys.
  it.each(['success', 'warning', 'danger', 'info'])('strata-react\'s %s ink reads on the ground', (status) => {
    const ink = STRATA_STATUS[scheme][status];
    expect(contrast(ink, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink, p.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('strata-react\'s info ink reads on the theme\'s info wash', () => {
    const block = scheme === 'light' ? themeCss.split('.dark {')[0] : themeCss.split('.dark {')[1];
    const wash = parse(/--info-subtle:\s*(oklch\([^)]*\))/.exec(block!)![1]);
    expect(contrast(STRATA_STATUS[scheme].info, wash)).toBeGreaterThanOrEqual(4.5);
  });
});

// strata-react 1.3.16 src/styles/theme.css, the status inks.
const STRATA_STATUS: Record<'light' | 'dark', Record<string, Oklch>> = {
  light: {
    success: parse('oklch(45.9% 0.109 150.1)'),
    warning: parse('oklch(45.5% 0.105 66)'),
    danger: parse('oklch(48% 0.111 27)'),
    info: parse('oklch(46.5% 0.11 244.6)'),
  },
  dark: {
    success: parse('oklch(70.5% 0.09 150.1)'),
    warning: parse('oklch(76% 0.1 80)'),
    danger: parse('oklch(71.7% 0.089 27.3)'),
    info: parse('oklch(70.8% 0.09 245.3)'),
  },
};
