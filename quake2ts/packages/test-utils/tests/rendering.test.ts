import { describe, it, expect, vi } from 'vitest';
import { createMockRenderingContext } from '../src/engine/rendering.js';

describe('Rendering Mocks', () => {
  it('should create a mock rendering context with GL, Camera, and Pipelines', () => {
    const context = createMockRenderingContext();

    expect(context.gl).toBeDefined();
    expect(context.gl.createTexture).toBeDefined();
    // vi.isMock is not available in all versions, checking if it has mock property or is a function
    expect(vi.isMockFunction(context.gl.createTexture)).toBe(true);

    expect(context.camera).toBeDefined();
    expect(context.camera.viewMatrix).toBeInstanceOf(Float32Array);

    expect(context.pipelines).toBeDefined();
    expect(context.pipelines.md2).toBeDefined();
    expect(context.pipelines.bsp).toBeDefined();
  });
});
