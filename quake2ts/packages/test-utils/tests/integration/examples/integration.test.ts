
import { describe, it, expect, vi } from 'vitest';
import { createMockWebGL2Context, createMockCanvas } from '@quake2ts/test-utils';

describe('Integration Test Example', () => {
  it('should use createMockCanvas for WebGL testing', () => {
    // This example doesn't need global browser setup, it uses the mock factories directly
    const canvas = createMockCanvas(800, 600);
    const gl = createMockWebGL2Context(canvas);

    expect(canvas.width).toBe(800);
    expect(gl).toBeDefined();

    const shader = gl.createShader(gl.VERTEX_SHADER);
    expect(gl.createShader).toHaveBeenCalledWith(gl.VERTEX_SHADER);
    expect(shader).toBeDefined();
  });
});
