import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebGPURenderer, Camera } from '../../../src/index';
import { setupWebGPUMocks } from '@quake2ts/test-utils/src/engine/mocks/webgpu';

describe('WebGPURenderer Integration (Mocked)', () => {
  beforeEach(() => {
    setupWebGPUMocks();
  });

  it('creates a renderer and renders a frame', async () => {
    const renderer = await createWebGPURenderer();
    expect(renderer).toBeDefined();
    expect(renderer.type).toBe('webgpu');

    const camera = new Camera(90, 1.0);
    // renderFrame returns void per IRenderer interface
    renderer.renderFrame({
      camera,
      timeSeconds: 0,
    });

    // Verify no errors thrown during rendering
    expect(renderer).toBeDefined();

    // Check if pipelines were initialized
    expect(renderer.pipelines.sprite).toBeDefined();
    expect(renderer.pipelines.bsp).toBeDefined();
  });
});
