import { SURF_FLOWING, SURF_SKY, SURF_TRANS33, SURF_TRANS66, SURF_WARP } from '@quake2ts/shared';
import { describe, expect, it } from 'vitest';
import {
  applySurfaceState,
  BspSurfacePipeline,
  deriveSurfaceRenderState,
  resolveLightStyles,
} from '../src/render/bspPipeline.js';
import { createMockGL } from './helpers/mockWebGL.js';

describe('resolveLightStyles', () => {
  it('fills in style defaults for missing lightstyle values', () => {
    const factors = resolveLightStyles([0, 1, 255, 2], [0.25, 0.5]);
    expect(Array.from(factors)).toEqual([0.25, 0.5, 0, 1]);
  });
});

describe('deriveSurfaceRenderState', () => {
  it('computes blend/alpha and flowing offsets based on surface flags', () => {
    const flowing = deriveSurfaceRenderState(SURF_FLOWING | SURF_TRANS66, 2);
    expect(flowing.blend).toBe(true);
    expect(flowing.alpha).toBeCloseTo(0.66);
    expect(flowing.depthWrite).toBe(false);
    expect(flowing.flowOffset[0]).toBeCloseTo(-0.5);
    expect(flowing.flowOffset[1]).toBe(0);

    const warpSky = deriveSurfaceRenderState(SURF_WARP | SURF_SKY);
    expect(warpSky.warp).toBe(true);
    expect(warpSky.sky).toBe(true);
    expect(warpSky.depthWrite).toBe(false);
  });
});

describe('BspSurfacePipeline', () => {
  it('binds shader uniforms and returns the render state', () => {
    const gl = createMockGL();
    const uniformNames = [
      'u_modelViewProjection',
      'u_texScroll',
      'u_lightmapScroll',
      'u_lightStyleFactors',
      'u_alpha',
      'u_applyLightmap',
      'u_warp',
      'u_diffuseMap',
      'u_lightmapAtlas',
    ];
    for (const name of uniformNames) {
      gl.uniformLocations.set(name, {} as WebGLUniformLocation);
    }

    const pipeline = new BspSurfacePipeline(gl as unknown as WebGL2RenderingContext);
    const mvp = new Float32Array(16);
    mvp[0] = 1;
    const state = pipeline.bind({
      modelViewProjection: mvp,
      styleIndices: [0, 2, 255, 255],
      styleValues: [0.1, 0.2, 0.75],
      surfaceFlags: SURF_FLOWING | SURF_TRANS33,
      timeSeconds: 1.5,
      diffuseSampler: 3,
      lightmapSampler: 4,
    });

    const mvpLoc = gl.uniformLocations.get('u_modelViewProjection');
    expect(gl.useProgram).toHaveBeenCalled();
    expect(gl.uniformMatrix4fv).toHaveBeenCalledWith(mvpLoc, false, mvp);
    expect(gl.uniform4fv).toHaveBeenCalledWith(gl.uniformLocations.get('u_lightStyleFactors'), new Float32Array([0.1, 0.75, 0, 0]));
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_applyLightmap'), 1);
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_warp'), 0);
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_diffuseMap'), 3);
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_lightmapAtlas'), 4);
    expect(state.alpha).toBeCloseTo(0.33);
    expect(state.flowOffset[0]).toBeCloseTo(-0.375);

    applySurfaceState(gl as unknown as WebGL2RenderingContext, state);
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND);
    expect(gl.blendFunc).toHaveBeenCalledWith(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    expect(gl.depthMask).toHaveBeenCalledWith(false);
  });
});
