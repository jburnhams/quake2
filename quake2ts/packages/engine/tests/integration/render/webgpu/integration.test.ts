import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { createWebGPUContext } from '../../../../src/render/webgpu/context';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../../../src/render/webgpu/headless';
import { create, globals } from 'webgpu';

// Create a single shared instance for the suite to avoid creation/destruction issues
const gpu = create([]);
Object.assign(global, globals);

describe('WebGPU Integration (Real/Headless)', () => {

  beforeEach(() => {
    // @ts-ignore
    global.navigator = global.navigator || {};
    // @ts-ignore
    global.navigator.gpu = gpu;
  });

  afterEach(() => {
    // @ts-ignore
    delete global.navigator.gpu;
  });

  afterAll(async () => {
      // Small delay to allow pending events to process before process exit
      await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should create a real WebGPU device with Dawn', async () => {
    const context = await createWebGPUContext();
    expect(context.device).toBeDefined();
    expect(context.isHeadless).toBe(true);

    // Check if it's real (should have limits)
    expect(context.limits.maxTextureDimension2D).toBeGreaterThan(0);
  });

  it('should clear a texture and read it back', async () => {
    const context = await createWebGPUContext();
    const device = context.device;
    const width = 64;
    const height = 64;

    // Create render target
    const target = createHeadlessRenderTarget(device, width, height, 'rgba8unorm');

    // Create a command encoder to clear the texture to red
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: target.view,
        clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    // Read back
    const data = await captureRenderTarget(device, target.texture);

    expect(data.length).toBe(width * height * 4);

    // Check first pixel (Red)
    expect(data[0]).toBe(255); // R
    expect(data[1]).toBe(0);   // G
    expect(data[2]).toBe(0);   // B
    expect(data[3]).toBe(255); // A

    // Check middle pixel
    const midIdx = (width * height / 2 + width / 2) * 4;
    expect(data[midIdx]).toBe(255);
    expect(data[midIdx + 1]).toBe(0);
    expect(data[midIdx + 2]).toBe(0);
    expect(data[midIdx + 3]).toBe(255);
  });
});
