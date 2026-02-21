import { describe, expect, it, vi } from 'vitest';
import { createWebGLContext } from '../../../src/render/context.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

class MockEvent {
  type: string;
  defaultPrevented: boolean = false;

  constructor(type: string) {
    this.type = type;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }
}

class MockCanvas {
  getContext: any = vi.fn();
  listeners: Record<string, ((event: any) => void)[]> = {};

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }
  }

  dispatchEvent(event: any) {
    if (this.listeners[event.type]) {
      this.listeners[event.type].forEach(l => l(event));
    }
    return !event.defaultPrevented;
  }
}

describe('createWebGLContext', () => {
  it('initializes default GL state and queries extensions', () => {
    const canvas = new MockCanvas();
    const gl = createMockWebGL2Context();
    gl.extensions.set('EXT_texture_compression', {});
    const getContext = vi.fn(() => gl as unknown as WebGL2RenderingContext);
    canvas.getContext = getContext;

    const state = createWebGLContext(canvas as unknown as HTMLCanvasElement, {
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
    const canvas = new MockCanvas();
    const gl = createMockWebGL2Context();
    canvas.getContext = vi.fn(() => gl as unknown as WebGL2RenderingContext);

    expect(() =>
      createWebGLContext(canvas as unknown as HTMLCanvasElement, { requiredExtensions: ['WEBGL_lose_context'] })
    ).toThrowError(/Missing required WebGL extension/);
  });

  it('tracks context loss and restoration callbacks', () => {
    const canvas = new MockCanvas();
    const gl = createMockWebGL2Context();
    canvas.getContext = vi.fn(() => gl as unknown as WebGL2RenderingContext);

    const state = createWebGLContext(canvas as unknown as HTMLCanvasElement);
    const lost = vi.fn();
    const restored = vi.fn();
    state.onLost(lost);
    state.onRestored(restored);

    const lostEvent = new MockEvent('webglcontextlost');
    canvas.dispatchEvent(lostEvent);
    expect(state.isLost()).toBe(true);
    expect(lost).toHaveBeenCalledTimes(1);

    canvas.dispatchEvent(new MockEvent('webglcontextrestored'));
    expect(state.isLost()).toBe(false);
    expect(restored).toHaveBeenCalledTimes(1);

    state.dispose();
    canvas.dispatchEvent(new MockEvent('webglcontextlost'));
    expect(lost).toHaveBeenCalledTimes(1);
  });
});
