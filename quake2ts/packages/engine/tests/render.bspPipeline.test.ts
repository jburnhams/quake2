import { SURF_FLOWING, SURF_SKY, SURF_TRANS33, SURF_TRANS66, SURF_WARP } from '@quake2ts/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  applySurfaceState,
  BspSurfacePipeline,
  deriveSurfaceRenderState,
  resolveLightStyles,
} from '../src/render/bspPipeline.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

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
  it('binds shader uniforms including dlights and returns the render state', () => {
    const gl = createMockWebGL2Context();

    // Ensure uniform4f is mocked
    if (!gl.uniform4f) {
        (gl as any).uniform4f = vi.fn();
    }
    // Ensure uniform3f is mocked
    if (!gl.uniform3f) {
        (gl as any).uniform3f = vi.fn();
    }

    const uniformNames = [
      'u_modelViewProjection',
      'u_texScroll',
      'u_lightmapScroll',
      'u_lightStyleFactors',
      'u_alpha',
      'u_applyLightmap',
      'u_warp',
      'u_time',
      'u_diffuseMap',
      'u_lightmapAtlas',
      'u_renderMode',
      'u_solidColor',
      'u_numDlights',
      // Dlights
      'u_dlights[0].position', 'u_dlights[0].color', 'u_dlights[0].intensity'
    ];
    for (const name of uniformNames) {
      gl.uniformLocations.set(name, {} as WebGLUniformLocation);
    }

    const pipeline = new BspSurfacePipeline(gl as unknown as WebGL2RenderingContext);
    const mvp = new Float32Array(16);
    mvp[0] = 1;

    const dlights = [{
       origin: { x: 10, y: 20, z: 30 },
       color: { x: 1, y: 0, z: 0 },
       intensity: 200,
       die: 0
    }];

    const state = pipeline.bind({
      modelViewProjection: mvp,
      styleIndices: [0, 2, 255, 255],
      styleValues: [0.1, 0.2, 0.75],
      surfaceFlags: SURF_FLOWING | SURF_TRANS33,
      timeSeconds: 1.5,
      diffuseSampler: 3,
      lightmapSampler: 4,
      dlights: dlights
    });

    const mvpLoc = gl.uniformLocations.get('u_modelViewProjection');
    expect(gl.useProgram).toHaveBeenCalled();
    expect(gl.uniformMatrix4fv).toHaveBeenCalledWith(mvpLoc, false, mvp);
    expect(gl.uniform4fv).toHaveBeenCalledWith(gl.uniformLocations.get('u_lightStyleFactors'), new Float32Array([0.1, 0.75, 0, 0]));
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_applyLightmap'), 1);
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_warp'), 0);
    expect(gl.uniform1f).toHaveBeenCalledWith(gl.uniformLocations.get('u_time'), 1.5);
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_diffuseMap'), 3);
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_lightmapAtlas'), 4);

    // Check Dlights
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_numDlights'), 1);
    expect(gl.uniform3f).toHaveBeenCalledWith(gl.uniformLocations.get('u_dlights[0].position'), 10, 20, 30);
    expect(gl.uniform3f).toHaveBeenCalledWith(gl.uniformLocations.get('u_dlights[0].color'), 1, 0, 0);
    expect(gl.uniform1f).toHaveBeenCalledWith(gl.uniformLocations.get('u_dlights[0].intensity'), 200);

    expect(state.alpha).toBeCloseTo(0.33);
    expect(state.flowOffset[0]).toBeCloseTo(-0.375);

    applySurfaceState(gl as unknown as WebGL2RenderingContext, state);
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND);
    expect(gl.blendFunc).toHaveBeenCalledWith(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    expect(gl.depthMask).toHaveBeenCalledWith(false);
  });
});
