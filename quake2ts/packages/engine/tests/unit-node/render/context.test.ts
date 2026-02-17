import { describe, expect, it, vi } from 'vitest';
import { createWebGLContext } from '../../../src/render/context.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

class MockEvent {
    constructor(public type: string) {}
    preventDefault() {}
}

const createMockCanvas = () => {
    const listeners: Record<string, Function[]> = {};
    return {
        width: 800,
        height: 600,
        getContext: vi.fn(),
        addEventListener: vi.fn((event, callback) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(callback);
        }),
        removeEventListener: vi.fn((event, callback) => {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter(cb => cb !== callback);
            }
        }),
        dispatchEvent: vi.fn((event) => {
            if (listeners[event.type]) {
                listeners[event.type].forEach(cb => cb(event));
            }
            return true;
        })
    } as unknown as HTMLCanvasElement;
};

describe('createWebGLContext', () => {
  it('initializes default GL state and queries extensions', () => {
    const canvas = createMockCanvas();
    const gl = createMockWebGL2Context();
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
    const canvas = createMockCanvas();
    const gl = createMockWebGL2Context();
    canvas.getContext = vi.fn(() => gl as unknown as WebGL2RenderingContext) as unknown as typeof canvas.getContext;

    expect(() =>
      createWebGLContext(canvas, { requiredExtensions: ['WEBGL_lose_context'] })
    ).toThrowError(/Missing required WebGL extension/);
  });

  it('tracks context loss and restoration callbacks', () => {
    const canvas = createMockCanvas();
    const gl = createMockWebGL2Context();
    canvas.getContext = vi.fn(() => gl as unknown as WebGL2RenderingContext) as unknown as typeof canvas.getContext;

    const state = createWebGLContext(canvas);
    const lost = vi.fn();
    const restored = vi.fn();
    state.onLost(lost);
    state.onRestored(restored);

    const lostEvent = new MockEvent('webglcontextlost');
    canvas.dispatchEvent(lostEvent as unknown as Event);
    expect(state.isLost()).toBe(true);
    expect(lost).toHaveBeenCalledTimes(1);

    canvas.dispatchEvent(new MockEvent('webglcontextrestored') as unknown as Event);
    expect(state.isLost()).toBe(false);
    expect(restored).toHaveBeenCalledTimes(1);

    state.dispose();
    canvas.dispatchEvent(new MockEvent('webglcontextlost') as unknown as Event);
    expect(lost).toHaveBeenCalledTimes(1);
  });
});
