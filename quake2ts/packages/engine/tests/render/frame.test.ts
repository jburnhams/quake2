import { describe, it, expect, vi } from 'vitest';
import { createFrameRenderer } from '../../src/render/frame.js';
import { Camera } from '../../src/render/camera.js';
import { BspSurfacePipeline } from '../../src/render/bspPipeline.js';
import { SkyboxPipeline } from '../../src/render/skybox.js';

describe('FrameRenderer', () => {
  it('should clear the color and depth buffers', () => {
    const gl = {
      clearColor: vi.fn(),
      clear: vi.fn(),
      COLOR_BUFFER_BIT: 0x00004000,
      DEPTH_BUFFER_BIT: 0x00000100,
    } as any;

    const bspPipeline = {} as BspSurfacePipeline;
    const skyboxPipeline = {} as SkyboxPipeline;
    const camera = new Camera();

    const frameRenderer = createFrameRenderer(gl, bspPipeline, skyboxPipeline);
    frameRenderer.renderFrame(camera);

    expect(gl.clearColor).toHaveBeenCalledWith(0, 0, 0, 1);
    expect(gl.clear).toHaveBeenCalledWith(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  });
});
