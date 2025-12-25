import { describe, it, expect, vi } from 'vitest';
import { createMockWebGL2Context } from '@quake2ts/test-utils';
import {
  BspSurfacePipeline,
  deriveSurfaceRenderState,
  resolveLightStyles,
  BSP_SURFACE_VERTEX_SOURCE,
  BSP_SURFACE_FRAGMENT_SOURCE
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
  u_renderMode: { id: 11 },
  u_solidColor: { id: 12 },
  u_styleLayerMapping: { id: 13 },
  u_numDlights: { id: 14 },
  'u_dlights[0].position': { id: 15 },
  'u_dlights[0].color': { id: 16 },
  'u_dlights[0].intensity': { id: 17 },
};

vi.mock('../../src/render/shaderProgram', () => {
  // Hardcode locations in the mock to avoid hoisting issues accessing outer variables
  const locations: any = {
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
    u_renderMode: { id: 11 },
    u_solidColor: { id: 12 },
    u_styleLayerMapping: { id: 13 },
    u_numDlights: { id: 14 },
    'u_dlights[0].position': { id: 15 },
    'u_dlights[0].color': { id: 16 },
    'u_dlights[0].intensity': { id: 17 },
  };

  const getUniformLocation = vi.fn(
    (name: string) => {
        return locations[name] || { id: 999 };
    }
  );
  const use = vi.fn();
  const dispose = vi.fn();

  const ShaderProgram = vi.fn(() => ({
    getUniformLocation,
    use,
    dispose,
    sourceSize: 100,
  }));

  ShaderProgram.create = vi.fn(() => ({
    getUniformLocation,
    use,
    dispose,
    sourceSize: 100,
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
    const createMockGl = () => createMockWebGL2Context({
      getUniformLocation: vi.fn((_, name) => mockLocations[name] || { id: 999 }),
      uniform1i: vi.fn((...args) => console.log('uniform1i:', args)),
    } as any);

    const mockMvp = new Float32Array(16);

    it('disables lightmap uniforms when no lightmap is provided', () => {
      const gl = createMockGl();
      const pipeline = new BspSurfacePipeline(gl as unknown as WebGL2RenderingContext);

      pipeline.bind({
        modelViewProjection: mockMvp,
        surfaceFlags: SURF_FLOWING,
      });

      const applyLmCall = (gl.uniform1i as any).mock.calls.find(
        (call: any) => call[0] === mockLocations.u_applyLightmap
      );
      expect(applyLmCall).toBeDefined();
      expect(applyLmCall[1]).toBe(0);

      const lightmapCall = (gl.uniform1i as any).mock.calls.find(
        (call: any) => call[0] === mockLocations.u_lightmapAtlas
      );
      expect(lightmapCall).toBeDefined();
      expect(lightmapCall[1]).toBe(0);
    });

    it('enables lightmap uniforms when a sampler is provided', () => {
      const gl = createMockGl();
      const pipeline = new BspSurfacePipeline(gl as unknown as WebGL2RenderingContext);

      pipeline.bind({
        modelViewProjection: mockMvp,
        lightmapSampler: 2,
      });

      const applyLmCall = (gl.uniform1i as any).mock.calls.find(
        (call: any) => call[0] === mockLocations.u_applyLightmap
      );
      expect(applyLmCall).toBeDefined();
      expect(applyLmCall[1]).toBe(1);

      const lightmapCall = (gl.uniform1i as any).mock.calls.find(
        (call: any) => call[0] === mockLocations.u_lightmapAtlas
      );
      expect(lightmapCall).toBeDefined();
      expect(lightmapCall[1]).toBe(2);
    });

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

    it.each([
      { timeSeconds: 2.0, expectedOffset: -0.5 },
      { timeSeconds: 5.0, expectedOffset: -0.25 },
      { timeSeconds: 0.0, expectedOffset: -0.0 },
      { timeSeconds: 4.0, expectedOffset: -0.0 },
    ])(
      'should bind flow uniforms for time $timeSeconds',
      ({ timeSeconds, expectedOffset }) => {
        const gl = createMockGl();
        const pipeline = new BspSurfacePipeline(gl);

        pipeline.bind({
          modelViewProjection: mockMvp,
          surfaceFlags: SURF_FLOWING,
          timeSeconds,
        });

        const texScrollCall = (gl.uniform2f as any).mock.calls.find(
          (call: any) => call[0] === mockLocations.u_texScroll
        );
        expect(texScrollCall).toBeDefined();
        expect(texScrollCall[1]).toBeCloseTo(expectedOffset, 5);
        expect(texScrollCall[2]).toBe(0);

        const lmScrollCall = (gl.uniform2f as any).mock.calls.find(
          (call: any) => call[0] === mockLocations.u_lightmapScroll
        );
        expect(lmScrollCall).toBeDefined();
        expect(lmScrollCall[1]).toBeCloseTo(expectedOffset, 5);
        expect(lmScrollCall[2]).toBe(0);
      }
    );

    it('should bind style layer mapping and factors', () => {
        const gl = createMockGl();
        const pipeline = new BspSurfacePipeline(gl);

        pipeline.bind({
          modelViewProjection: mockMvp,
          styleIndices: [0, 255, 2, 255],
          styleLayers: [0, -1, 1, -1],
          styleValues: [1.0, 0.5, 0.5], // Style 0=1.0, Style 2=0.5
        });

        // Check u_styleLayerMapping
        const layerCall = (gl.uniform4fv as any).mock.calls.find(
            (call: any) => call[0] === mockLocations.u_styleLayerMapping
        );
        expect(layerCall).toBeDefined();
        expect(layerCall[1]).toEqual([0, -1, 1, -1]);

        // Check u_lightStyleFactors
        // Float32Array [1, 0, 0.5, 0]
        const factorsCall = (gl.uniform4fv as any).mock.calls.find(
             (call: any) => call[0] === mockLocations.u_lightStyleFactors
        );
        expect(factorsCall).toBeDefined();
        // Compare with Float32Array values
        expect(factorsCall[1][0]).toBe(1);
        expect(factorsCall[1][1]).toBe(0);
        expect(factorsCall[1][2]).toBe(0.5);
        expect(factorsCall[1][3]).toBe(0);
    });

    it('should contain new attributes in vertex shader source', () => {
        expect(BSP_SURFACE_VERTEX_SOURCE).toContain('layout(location = 3) in float a_lightmapStep;');
        expect(BSP_SURFACE_VERTEX_SOURCE).toContain('out float v_lightmapStep;');
    });

    it('should use new uniforms in fragment shader source', () => {
        expect(BSP_SURFACE_FRAGMENT_SOURCE).toContain('uniform vec4 u_styleLayerMapping;');
        expect(BSP_SURFACE_FRAGMENT_SOURCE).toContain('in float v_lightmapStep;');
        expect(BSP_SURFACE_FRAGMENT_SOURCE).toContain('layer * v_lightmapStep');
    });

  });

  describe('warpCoords GLSL logic', () => {
    // Replicating the GLSL function in JS for testing purposes
    const warpCoords = (
      uv: readonly [number, number],
      time: number
    ): [number, number] => {
      const s = uv[0] + Math.sin(uv[1] * 0.125 + time) * 0.125;
      const t = uv[1] + Math.sin(uv[0] * 0.125 + time) * 0.125;
      return [s, t];
    };

    it('should return original coords at time 0 and uv 0,0', () => {
      const uv: [number, number] = [0, 0];
      const time = 0;
      const result = warpCoords(uv, time);
      expect(result[0]).toBeCloseTo(0);
      expect(result[1]).toBeCloseTo(0);
    });

    it('should calculate warped coordinates correctly for given inputs', () => {
      const uv: [number, number] = [0.5, 0.5];
      const time = 1.0;
      const expectedS = 0.5 + Math.sin(0.5 * 0.125 + 1.0) * 0.125;
      const expectedT = 0.5 + Math.sin(0.5 * 0.125 + 1.0) * 0.125;
      const result = warpCoords(uv, time);
      expect(result[0]).toBeCloseTo(expectedS);
      expect(result[1]).toBeCloseTo(expectedT);
    });
  });
});
