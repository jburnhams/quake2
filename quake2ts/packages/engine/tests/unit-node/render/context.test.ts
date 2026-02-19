import { describe, expect, it, vi } from 'vitest';
import { createWebGLContext } from '../../../src/render/context.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

describe('createWebGLContext', () => {
  // Mock Event class
  class MockEvent {
    type: string;
    defaultPrevented = false;
    constructor(type: string) {
      this.type = type;
    }
    preventDefault = vi.fn(() => { this.defaultPrevented = true; });
  }

  // Helper to create a mock canvas
  function createMockCanvas() {
    const listeners: Record<string, EventListener[]> = {};
    const gl = createMockWebGL2Context();

    const canvas = {
      getContext: vi.fn(() => gl as unknown as WebGL2RenderingContext),
      addEventListener: vi.fn((event: string, listener: EventListener) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(listener);
      }),
      removeEventListener: vi.fn((event: string, listener: EventListener) => {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(l => l !== listener);
      }),
      dispatchEvent: (event: Event) => {
          if (listeners[event.type]) {
              listeners[event.type].forEach(l => l(event));
          }
          return true;
      }
    };

    return { canvas: canvas as unknown as HTMLCanvasElement, gl, listeners };
  }

  it('initializes default GL state and queries extensions', () => {
    const { canvas, gl } = createMockCanvas();
    gl.extensions.set('EXT_texture_compression', {});

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
    const { canvas } = createMockCanvas();

    expect(() =>
      createWebGLContext(canvas, { requiredExtensions: ['WEBGL_lose_context'] })
    ).toThrowError(/Missing required WebGL extension/);
  });

  it('tracks context loss and restoration callbacks', () => {
    const { canvas } = createMockCanvas();

    const state = createWebGLContext(canvas);
    const lost = vi.fn();
    const restored = vi.fn();
    state.onLost(lost);
    state.onRestored(restored);

    const lostEvent = new MockEvent('webglcontextlost') as unknown as Event;

    canvas.dispatchEvent(lostEvent);
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
