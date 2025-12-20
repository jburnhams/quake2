import { describe, it, expect, vi } from 'vitest';
import { createMockRenderingContext } from '../../src/engine/rendering';

describe('createMockRenderingContext', () => {
  it('should return a valid mock rendering context', () => {
    const mockContext = createMockRenderingContext();

    expect(mockContext).toBeDefined();
    expect(mockContext.gl).toBeDefined();
    expect(mockContext.camera).toBeDefined();
    expect(mockContext.pipelines).toBeDefined();
  });

  it('should have working spies for GL methods', () => {
    const mockContext = createMockRenderingContext();
    const { gl } = mockContext;

    gl.enable(gl.DEPTH_TEST);
    expect(gl.enable).toHaveBeenCalledWith(gl.DEPTH_TEST);
    expect(gl.calls).toContain(`enable:${gl.DEPTH_TEST}`);
  });

  it('should have working spies for Camera methods', () => {
    const mockContext = createMockRenderingContext();
    const { camera } = mockContext;

    camera.update();
    expect(camera.update).toHaveBeenCalled();
    expect(camera.getViewMatrix()).toBeInstanceOf(Float32Array);
  });

  it('should have working spies for Pipelines', () => {
    const mockContext = createMockRenderingContext();
    const { pipelines } = mockContext;

    pipelines.md2.render(vi.fn() as any, {} as any, 0, {} as any, 0); // Arguments don't matter for the mock
    expect(pipelines.md2.render).toHaveBeenCalled();

    pipelines.bsp.render(vi.fn() as any, {} as any, {} as any, 0);
    expect(pipelines.bsp.render).toHaveBeenCalled();
  });
});
