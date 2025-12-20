import { describe, expect, it } from 'vitest';
import {
  SKYBOX_FRAGMENT_SHADER,
  SKYBOX_VERTEX_SHADER,
  SkyboxPipeline,
  computeSkyScroll,
  removeViewTranslation,
} from '../src/render/skybox.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

describe('Skybox helpers', () => {
  it('removes translation from view matrices', () => {
    const matrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      5, 6, 7, 1,
    ]);

    const withoutTranslation = removeViewTranslation(matrix);
    expect(Array.from(withoutTranslation.slice(12, 15))).toEqual([0, 0, 0]);
  });

  it('computes scrolling offsets over time', () => {
    expect(computeSkyScroll(10)).toEqual([0.1, 0.2]);
    expect(computeSkyScroll(5, [0.2, -0.1])).toEqual([1, -0.5]);
  });
});

describe('SkyboxPipeline', () => {
  it('binds uniforms, binds cubemap, and issues a draw', () => {
    const gl = createMockWebGL2Context();
    const uniformNames = ['u_viewProjectionNoTranslation', 'u_scroll', 'u_skybox'];
    for (const name of uniformNames) {
      gl.uniformLocations.set(name, {} as WebGLUniformLocation);
    }

    const pipeline = new SkyboxPipeline(gl as unknown as WebGL2RenderingContext);
    const vp = new Float32Array(16);
    vp[0] = 1;
    const scroll = computeSkyScroll(2, [0.05, 0.025]);

    pipeline.bind({ viewProjection: vp, scroll, textureUnit: 1 });
    pipeline.draw();

    expect(gl.useProgram).toHaveBeenCalled();
    expect(gl.depthMask).toHaveBeenCalledWith(false);
    expect(gl.uniformMatrix4fv).toHaveBeenCalledWith(gl.uniformLocations.get('u_viewProjectionNoTranslation'), false, vp);
    expect(gl.uniform2f).toHaveBeenCalledWith(gl.uniformLocations.get('u_scroll'), scroll[0], scroll[1]);
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_skybox'), 1);
    expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_CUBE_MAP, pipeline.cubemap.texture);
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 36);

    pipeline.dispose();
    expect(gl.deleteTexture).toHaveBeenCalledWith(pipeline.cubemap.texture);
  });
});

describe('Skybox shader sources', () => {
  it('exposes shader sources for validation', () => {
    expect(SKYBOX_VERTEX_SHADER).toContain('a_position');
    expect(SKYBOX_FRAGMENT_SHADER).toContain('samplerCube');
  });
});
