import { describe, it, expect } from 'vitest';
import {
  deriveSurfaceRenderState,
  resolveLightStyles,
} from '../../src/render/bspPipeline.js';
import {
  SURF_FLOWING,
  SURF_SKY,
  SURF_TRANS33,
  SURF_TRANS66,
  SURF_WARP,
} from '@quake2ts/shared';

describe('bspPipeline', () => {
  describe('resolveLightStyles', () => {
    it('should resolve default light styles', () => {
      const styles = resolveLightStyles();
      expect(styles).toEqual(new Float32Array([1, 0, 0, 0]));
    });

    it('should resolve light styles with values', () => {
      const styleValues = [1.0, 0.5, 0.25, 0.125];
      const styleIndices = [0, 1, 2, 3];
      const styles = resolveLightStyles(styleIndices, styleValues);
      expect(styles).toEqual(new Float32Array([1.0, 0.5, 0.25, 0.125]));
    });
  });

  describe('deriveSurfaceRenderState', () => {
    it('should derive default surface render state', () => {
      const state = deriveSurfaceRenderState();
      expect(state).toEqual({
        alpha: 1,
        blend: false,
        depthWrite: true,
        warp: false,
        flowOffset: [0, 0],
        sky: false,
      });
    });

    it('should derive state for flowing surface', () => {
      const state = deriveSurfaceRenderState(SURF_FLOWING, 1.0);
      expect(state.flowOffset).toEqual([-0.25, 0]);
    });

    it('should derive state for warp surface', () => {
      const state = deriveSurfaceRenderState(SURF_WARP);
      expect(state.warp).toBe(true);
    });

    it('should derive state for sky surface', () => {
      const state = deriveSurfaceRenderState(SURF_SKY);
      expect(state.sky).toBe(true);
      expect(state.depthWrite).toBe(false);
    });

    it('should derive state for transparent surfaces', () => {
      const state33 = deriveSurfaceRenderState(SURF_TRANS33);
      expect(state33.alpha).toBe(0.33);
      expect(state33.blend).toBe(true);
      expect(state33.depthWrite).toBe(false);

      const state66 = deriveSurfaceRenderState(SURF_TRANS66);
      expect(state66.alpha).toBe(0.66);
      expect(state66.blend).toBe(true);
      expect(state66.depthWrite).toBe(false);
    });
  });
});
