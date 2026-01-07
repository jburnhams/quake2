import { describe, test, expect } from 'vitest';
import { evaluateLightStyle, prepareLightStyles } from '../../../../src/render/utils/lighting.js';

describe('Lighting Utilities', () => {
  describe('evaluateLightStyle', () => {
    test('returns 1.0 for empty pattern', () => {
      expect(evaluateLightStyle('', 0)).toBe(1.0);
    });

    test('evaluates pattern at specific time', () => {
      const pattern = 'abcdefghijk'; // 11 characters
      const time = 0.1; // frame = floor(0.1 * 10) % 11 = 1

      // 'b' has char code 98, so (98 - 97) / 12 = 1/12
      expect(evaluateLightStyle(pattern, time)).toBeCloseTo(1/12, 5);
    });

    test('wraps around pattern length', () => {
      const pattern = 'abc';
      const time = 0.3; // frame = floor(0.3 * 10) % 3 = 0

      // 'a' has char code 97, so (97 - 97) / 12 = 0
      expect(evaluateLightStyle(pattern, time)).toBe(0);
    });

    test('evaluates at different time points', () => {
      const pattern = 'mz'; // 'm'=109, 'z'=122

      // Time 0.0: frame 0 -> 'm' -> (109-97)/12 = 1.0
      expect(evaluateLightStyle(pattern, 0.0)).toBe(1.0);

      // Time 0.1: frame 1 -> 'z' -> (122-97)/12 = 25/12
      expect(evaluateLightStyle(pattern, 0.1)).toBeCloseTo(25/12, 5);
    });
  });

  describe('prepareLightStyles', () => {
    test('returns base styles when no overrides', () => {
      const base = [1.0, 0.5, 0.8];
      expect(prepareLightStyles(base, undefined)).toBe(base);
      expect(prepareLightStyles(base, new Map())).toBe(base);
    });

    test('applies overrides to existing indices', () => {
      const base = [1.0, 1.0, 1.0];
      const overrides = new Map([[1, 'az']]);
      const time = 0.0; // 'a' -> 0.0

      const result = prepareLightStyles(base, overrides, time);

      expect(result).toEqual([1.0, 0.0, 1.0]);
    });

    test('expands array for out-of-bounds overrides', () => {
      const base = [1.0, 1.0];
      const overrides = new Map([[5, 'a']]);

      const result = prepareLightStyles(base, overrides, 0);

      expect(result.length).toBeGreaterThanOrEqual(6);
      expect(result[5]).toBe(0); // 'a' -> 0
      // Filled indices should be 1.0
      for (let i = 2; i < 5; i++) {
        expect(result[i]).toBe(1.0);
      }
    });

    test('applies multiple overrides', () => {
      const base = [1.0, 1.0, 1.0, 1.0];
      const overrides = new Map([
        [0, 'a'],  // 0.0
        [2, 'm'],  // 1.0
      ]);

      const result = prepareLightStyles(base, overrides, 0);

      expect(result[0]).toBe(0.0);
      expect(result[1]).toBe(1.0); // unchanged
      expect(result[2]).toBe(1.0);
      expect(result[3]).toBe(1.0); // unchanged
    });

    test('does not mutate base array', () => {
      const base = [1.0, 1.0];
      const baseCopy = [...base];
      const overrides = new Map([[0, 'a']]);

      prepareLightStyles(base, overrides, 0);

      expect(base).toEqual(baseCopy);
    });
  });
});
