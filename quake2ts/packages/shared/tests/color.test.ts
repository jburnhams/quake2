import { describe, expect, it } from 'vitest';
import { addBlendColor, type Color4 } from '../src/math/color.js';

describe('color blend helpers (G_AddBlend)', () => {
  it('returns the existing blend when alpha is non-positive', () => {
    const base: Color4 = [0.2, 0.3, 0.4, 0.5];
    expect(addBlendColor(1, 0, 0, 0, base)).toBe(base);
    expect(addBlendColor(1, 0, 0, -0.1, base)).toBe(base);
  });

  it('accumulates alpha and mixes colors proportionally', () => {
    const start: Color4 = [0, 0, 0, 0];

    // First, add a half-strength red
    const afterRed = addBlendColor(1, 0, 0, 0.5, start);
    expect(afterRed[0]).toBeCloseTo(1, 4);
    expect(afterRed[1]).toBeCloseTo(0, 4);
    expect(afterRed[2]).toBeCloseTo(0, 4);
    expect(afterRed[3]).toBeCloseTo(0.5, 4);

    // Then add a half-strength blue on top of that
    const afterBlue = addBlendColor(0, 0, 1, 0.5, afterRed);

    // New alpha: a2 = 0.5 + (1 - 0.5) * 0.5 = 0.75
    expect(afterBlue[3]).toBeCloseTo(0.75, 4);

    // Old contribution factor
    const a3 = 0.5 / 0.75;
    const expectedR = 1 * a3 + 0 * (1 - a3);
    const expectedG = 0 * a3 + 0 * (1 - a3);
    const expectedB = 0 * a3 + 1 * (1 - a3);

    expect(afterBlue[0]).toBeCloseTo(expectedR, 4);
    expect(afterBlue[1]).toBeCloseTo(expectedG, 4);
    expect(afterBlue[2]).toBeCloseTo(expectedB, 4);
  });

  it('handles fully opaque new colors by treating alpha as fully applied', () => {
    const base: Color4 = [0.1, 0.2, 0.3, 0.4];
    const result = addBlendColor(0.8, 0.6, 0.4, 1, base);

    expect(result[0]).toBeCloseTo(0.52, 4);
    expect(result[1]).toBeCloseTo(0.44, 4);
    expect(result[2]).toBeCloseTo(0.36, 4);
    expect(result[3]).toBeCloseTo(1, 4);
  });
});
