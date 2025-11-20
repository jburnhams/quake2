import { describe, it, expect, vi } from 'vitest';
import {
  BspSurfacePipeline,
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

// Mock ShaderProgram to avoid real WebGL calls during instantiation.
// Store mock locations to be able to reference them in tests.
const mockLocations = {
  u_modelViewProjection: { id: 1 },
  u_texScroll: { id: 2 },
  u_lightmapScroll: { id: 3 },
  u_lightStyleFactors: { id: 4 },
  u_alpha: { id: 5 },
  u_applyLightmap: { id: 6 },
  u_warp: { id: 7 },
  u_diffuseMap: { id: 8 },
  u_lightmapAtlas: { id: 9 },
  u_time: { id: 10 },
};

vi.mock('../../src/render/shaderProgram.js', () => {
  const getUniformLocation = vi.fn(
    (name: keyof typeof mockLocations) => mockLocations[name]
  );
  const use = vi.fn();
  const dispose = vi.fn();

  const ShaderProgram = vi.fn(() => ({
    getUniformLocation,
    use,
    dispose,
  }));

  ShaderProgram.create = vi.fn(() => ({
    getUniformLocation,
    use,
    dispose,
  }));

  return { ShaderProgram };
});

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

  describe('BspSurfacePipeline', () => {
    const createMockGl = (): WebGL2RenderingContext =>
      ({
        uniformMatrix4fv: vi.fn(),
        uniform2f: vi.fn(),
        uniform4fv: vi.fn(),
        uniform1f: vi.fn(),
        uniform1i: vi.fn(),
      } as any);

    const mockMvp = new Float32Array(16);

    it('should bind warp uniforms when SURF_WARP is set', () => {
      const gl = createMockGl();
      const pipeline = new BspSurfacePipeline(gl);

      pipeline.bind({
        modelViewProjection: mockMvp,
        surfaceFlags: SURF_WARP,
      });

      const warpUniformCall = (gl.uniform1i as any).mock.calls.find(
        (call: any) => call[0] === mockLocations.u_warp
      );
      expect(warpUniformCall).toBeDefined();
      expect(warpUniformCall[1]).toBe(1);
    });

    it('should bind flow uniforms when SURF_FLOWING is set', () => {
      const gl = createMockGl();
      const pipeline = new BspSurfacePipeline(gl);
      const timeSeconds = 2.0;
      const expectedOffset = -0.5; // (2.0 * 0.25) % 1 = 0.5

      pipeline.bind({
        modelViewProjection: mockMvp,
        surfaceFlags: SURF_FLOWING,
        timeSeconds,
      });

      const texScrollCall = (gl.uniform2f as any).mock.calls.find(
        (call: any) => call[0] === mockLocations.u_texScroll
      );
      expect(texScrollCall).toBeDefined();
      expect(texScrollCall[1]).toBe(expectedOffset);
      expect(texScrollCall[2]).toBe(0);

      const lmScrollCall = (gl.uniform2f as any).mock.calls.find(
        (call: any) => call[0] === mockLocations.u_lightmapScroll
      );
      expect(lmScrollCall).toBeDefined();
      expect(lmScrollCall[1]).toBe(expectedOffset);
      expect(lmScrollCall[2]).toBe(0);
    });
  });
});
