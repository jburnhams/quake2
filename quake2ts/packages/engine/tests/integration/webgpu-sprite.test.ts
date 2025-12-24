import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createWebGPUContext } from '../../src/render/webgpu/context';
import { SpriteRenderer } from '../../src/render/webgpu/pipelines/sprite';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../src/render/webgpu/headless';
import { initHeadlessWebGPU, HeadlessWebGPUSetup } from '@quake2ts/test-utils/src/setup/webgpu';

describe('SpriteRenderer Integration (Headless)', () => {
  let gpuSetup: HeadlessWebGPUSetup | null = null;
  let gpuAvailable = false;

  beforeAll(async () => {
    try {
      gpuSetup = await initHeadlessWebGPU();
      gpuAvailable = true;
    } catch (error) {
      console.warn('⚠️  WebGPU not available - integration tests will be skipped:', error);
      gpuAvailable = false;
    }
  });

  afterAll(async () => {
    if (gpuSetup) {
      await gpuSetup.cleanup();
    }
  });

  it('renders a solid red rectangle', async () => {
    if (!gpuAvailable) return;

    const context = await createWebGPUContext();
    const width = 256;
    const height = 256;

    // Create Render Target
    const { texture, view } = createHeadlessRenderTarget(context.device, width, height, 'rgba8unorm');

    // Create Renderer
    const renderer = new SpriteRenderer(context.device, 'rgba8unorm');
    renderer.setProjection(width, height);

    // Render
    const commandEncoder = context.device.createCommandEncoder();

    // Manually clear
    const clearPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: view,
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: 'store'
        }]
    });
    clearPass.end();

    renderer.begin(commandEncoder, view);
    // Draw 100x100 red rect at 10,10
    renderer.drawSolidRect(10, 10, 100, 100, [1, 0, 0, 1]);
    renderer.end();

    context.device.queue.submit([commandEncoder.finish()]);

    // Readback
    const pixels = await captureRenderTarget(context.device, texture);

    // Check pixel at 0,0 (Background - Black)
    let idx = 0;
    expect(pixels[idx]).toBe(0);
    expect(pixels[idx+1]).toBe(0);
    expect(pixels[idx+2]).toBe(0);

    // Check pixel at 20,20 (Foreground - Red)
    idx = (20 * width + 20) * 4;
    expect(pixels[idx]).toBe(255);
    expect(pixels[idx+1]).toBe(0);
    expect(pixels[idx+2]).toBe(0);
    expect(pixels[idx+3]).toBe(255);

    renderer.destroy();
    texture.destroy();
  });
});
