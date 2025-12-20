import { describe, it, expect, beforeAll } from 'vitest';
import { setupBrowserEnvironment } from './setup.js';
import { createMockWebGL2Context } from './mocks/webgl2.js';

describe('Integration Test Environment', () => {
  beforeAll(() => {
    setupBrowserEnvironment();
  });

  it('should provide a window and document global', () => {
    expect(global.window).toBeDefined();
    expect(global.document).toBeDefined();
    expect(document.createElement).toBeDefined();
  });

  it('should provide requestAnimationFrame', () => {
    expect(global.requestAnimationFrame).toBeDefined();

    return new Promise<void>((resolve) => {
      requestAnimationFrame((timestamp) => {
        expect(timestamp).toBeGreaterThan(0);
        resolve();
      });
    });
  });

  it('should create a canvas element with WebGL2 context', () => {
    const canvas = document.createElement('canvas');
    expect(canvas).toBeDefined();

    // Since we mocked it, it should return our mock object
    const gl = canvas.getContext('webgl2');
    expect(gl).toBeDefined();

    // Verify it has some WebGL constants
    expect(gl?.VERTEX_SHADER).toBe(0x8B31);

    // Verify it accepts calls
    const shader = gl?.createShader(gl.VERTEX_SHADER);
    expect(shader).toBeDefined();
  });
});
