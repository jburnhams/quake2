import { describe, expect, it, vi } from 'vitest';
import { createWebGLContext } from '../../../src/render/context.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

// Minimal mock for Event
class MockEvent {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
  preventDefault() {}
}
vi.stubGlobal('Event', MockEvent);

// Minimal mock for HTMLCanvasElement
class MockCanvas {
  listeners: Record<string, EventListenerOrEventListenerObject[]> = {};

  getContext = vi.fn();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (!this.listeners[type]) return;
    const idx = this.listeners[type].indexOf(listener);
    if (idx !== -1) {
      this.listeners[type].splice(idx, 1);
    }
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.listeners[event.type];
    if (listeners) {
      listeners.forEach((l) => {
        if (typeof l === 'function') {
          l(event);
        } else {
          l.handleEvent(event);
        }
      });
    }
    return true;
  }
}

// Mock document
vi.stubGlobal('document', {
  createElement: (tagName: string) => {
    if (tagName === 'canvas') {
      return new MockCanvas() as unknown as HTMLCanvasElement;
    }
    throw new Error(`Mock document.createElement not implemented for ${tagName}`);
  },
});

describe('createWebGLContext', () => {
  it('initializes default GL state and queries extensions', () => {
    const canvas = document.createElement('canvas');
    // We know it's our MockCanvas, but TS thinks it's HTMLCanvasElement
    const mockCanvas = canvas as unknown as MockCanvas;

    const gl = createMockWebGL2Context();
    gl.extensions.set('EXT_texture_compression', {});

    // Override getContext on the instance
    mockCanvas.getContext.mockReturnValue(gl as unknown as WebGL2RenderingContext);

    const state = createWebGLContext(canvas, {
      requiredExtensions: ['EXT_texture_compression'],
      optionalExtensions: ['OES_vertex_array_object'],
    });

    expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl2', { antialias: true });
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
    const mockCanvas = canvas as unknown as MockCanvas;
    const gl = createMockWebGL2Context();
    mockCanvas.getContext.mockReturnValue(gl as unknown as WebGL2RenderingContext);

    expect(() =>
      createWebGLContext(canvas, { requiredExtensions: ['WEBGL_lose_context'] })
    ).toThrowError(/Missing required WebGL extension/);
  });

  it('tracks context loss and restoration callbacks', () => {
    const canvas = document.createElement('canvas');
    const mockCanvas = canvas as unknown as MockCanvas;
    const gl = createMockWebGL2Context();
    mockCanvas.getContext.mockReturnValue(gl as unknown as WebGL2RenderingContext);

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
