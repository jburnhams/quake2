import { describe, expect, it, vi } from 'vitest';
import { applySurfaceState, SurfaceRenderState } from '../../../src/render/bspPipeline.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

describe('applySurfaceState', () => {
  it('applies depth mask and blending state', () => {
    const gl = createMockWebGL2Context();

    const state: SurfaceRenderState = {
      alpha: 1,
      blend: true,
      depthWrite: false,
      warp: false,
      flowOffset: [0, 0],
      sky: false
    };

    applySurfaceState(gl as unknown as WebGL2RenderingContext, state);

    expect(gl.depthMask).toHaveBeenCalledWith(false);
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND);
    expect(gl.blendFunc).toHaveBeenCalledWith(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  });

  it('disables blending when not needed', () => {
    const gl = createMockWebGL2Context();

    const state: SurfaceRenderState = {
      alpha: 1,
      blend: false,
      depthWrite: true,
      warp: false,
      flowOffset: [0, 0],
      sky: false
    };

    applySurfaceState(gl as unknown as WebGL2RenderingContext, state);

    expect(gl.depthMask).toHaveBeenCalledWith(true);
    expect(gl.disable).toHaveBeenCalledWith(gl.BLEND);
  });
});
