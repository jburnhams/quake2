import { describe, it, expect } from 'vitest';
import {
  removeViewTranslation,
  computeSkyScroll,
} from '../../src/render/skybox.js';
import { mat4 } from 'gl-matrix';

describe('skybox', () => {
  describe('removeViewTranslation', () => {
    it('should remove the translation from a view matrix', () => {
      const viewMatrix = mat4.fromTranslation(mat4.create(), [10, 20, 30]);
      const noTranslation = removeViewTranslation(viewMatrix);
      expect(noTranslation[12]).toBe(0);
      expect(noTranslation[13]).toBe(0);
      expect(noTranslation[14]).toBe(0);
    });
  });

  describe('computeSkyScroll', () => {
    it('should compute sky scroll based on time and default speeds', () => {
      const scroll = computeSkyScroll(1.0);
      expect(scroll).toEqual([0.01, 0.02]);
    });

    it('should compute sky scroll based on time and custom speeds', () => {
      const scroll = computeSkyScroll(2.0, [0.1, 0.2]);
      expect(scroll).toEqual([0.2, 0.4]);
    });
  });
});
