import { describe, expect, it, vi } from 'vitest';
import { createWebGLContext } from '../src/render/context.js';
import { createMockWebGL2Context as createMockGL } from '@quake2ts/test-utils';

describe('createWebGLContext', () => {
  it('initializes default GL state and queries extensions', () => {
    const canvas = document.createElement('canvas');
    const gl = createMockGL();
    gl.extensions.set('EXT_texture_compression', {});
    const getContext = vi.fn(() => gl as unknown as WebGL2RenderingContext);
    canvas.getContext = getContext as unknown as typeof canvas.getContext;

    const state = createWebGLContext(canvas, {
      requiredExtensions: ['EXT_texture_compression'],
      optionalExtensions: ['OES_vertex_array_object'],
    });

    expect(getContext).toHaveBeenCalledWith('webgl2', { antialias: true });
    expect(gl.enable).toHaveBeenCalledWith(gl.DEPTH_TEST);
    expect(gl.depthFunc).toHaveBeenCalledWith(gl.LEQUAL);
    expect(gl.enable).toHaveBeenCalledWith(gl.CULL_FACE);
    expect(gl.cullFace).toHaveBeenCalledWith(gl.BACK);
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND);
    expect(gl.blendFuncSeparate).toHaveBeenCalledWith(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
    expect(gl.getExtension).toHaveBeenCalledWith('EXT_texture_compression');
    expect(state.extensions.get('EXT_texture_compression')).toBeDefined();
    expect(state.extensions.has('OES_vertex_array_object')).toBe(false);
    state.dispose();
  });

  it('throws when a required extension is missing', () => {
    const canvas = document.createElement('canvas');
    const gl = createMockGL();
    canvas.getContext = vi.fn(() => gl as unknown as WebGL2RenderingContext) as unknown as typeof canvas.getContext;

    expect(() =>
      createWebGLContext(canvas, { requiredExtensions: ['WEBGL_lose_context'] })
    ).toThrowError(/Missing required WebGL extension/);
  });

  it('tracks context loss and restoration callbacks', () => {
    const canvas = document.createElement('canvas');
    const gl = createMockGL();
    canvas.getContext = vi.fn(() => gl as unknown as WebGL2RenderingContext) as unknown as typeof canvas.getContext;

    const state = createWebGLContext(canvas);
    const lost = vi.fn();
    const restored = vi.fn();
    state.onLost(lost);
    state.onRestored(restored);

    const lostEvent = new Event('webglcontextlost');
    canvas.dispatchEvent(lostEvent);
    expect(state.isLost()).toBe(true);
    expect(lost).toHaveBeenCalledTimes(1);

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(state.isLost()).toBe(false);
    expect(restored).toHaveBeenCalledTimes(1);

    state.dispose();
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(lost).toHaveBeenCalledTimes(1);
  });
});
