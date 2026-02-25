import { describe, expect, it, vi } from 'vitest';
import { createWebGLContext } from '../../../src/render/context.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

// Mock Event since it's not available in Node environment
class MockEvent {
  constructor(public type: string) {}
  preventDefault() {}
}
global.Event = MockEvent as any;

const createMockCanvas = () => {
    const listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
    return {
        getContext: vi.fn(),
        addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(listener);
        }),
        removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
             if (listeners[type]) {
                 const idx = listeners[type].indexOf(listener);
                 if (idx !== -1) listeners[type].splice(idx, 1);
             }
        }),
        dispatchEvent: vi.fn((event: Event) => {
            if (listeners[event.type]) {
                listeners[event.type].forEach(l => {
                    if (typeof l === 'function') l(event);
                    else l.handleEvent(event);
                });
            }
            return true;
        }),
        width: 800,
        height: 600
    } as unknown as HTMLCanvasElement;
};

describe('createWebGLContext', () => {
  it('initializes default GL state and queries extensions', () => {
    const canvas = createMockCanvas();
    const gl = createMockWebGL2Context();
    gl.extensions.set('EXT_texture_compression', {});

    // Setup getContext to return our mock GL
    (canvas.getContext as any).mockReturnValue(gl);

    const state = createWebGLContext(canvas, {
      requiredExtensions: ['EXT_texture_compression'],
      optionalExtensions: ['OES_vertex_array_object'],
    });

    expect(canvas.getContext).toHaveBeenCalledWith('webgl2', { antialias: true });
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
    (canvas.getContext as any).mockReturnValue(gl);

    expect(() =>
      createWebGLContext(canvas, { requiredExtensions: ['WEBGL_lose_context'] })
    ).toThrowError(/Missing required WebGL extension/);
  });

  it('tracks context loss and restoration callbacks', () => {
    const canvas = createMockCanvas();
    const gl = createMockWebGL2Context();
    (canvas.getContext as any).mockReturnValue(gl);

    const state = createWebGLContext(canvas);
    const lost = vi.fn();
    const restored = vi.fn();
    state.onLost(lost);
    state.onRestored(restored);

    const lostEvent = new MockEvent('webglcontextlost');
    canvas.dispatchEvent(lostEvent as any);
    expect(state.isLost()).toBe(true);
    expect(lost).toHaveBeenCalledTimes(1);

    canvas.dispatchEvent(new MockEvent('webglcontextrestored') as any);
    expect(state.isLost()).toBe(false);
    expect(restored).toHaveBeenCalledTimes(1);

    state.dispose();
    canvas.dispatchEvent(new MockEvent('webglcontextlost') as any);
    expect(lost).toHaveBeenCalledTimes(1);
  });
});
