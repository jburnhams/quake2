import { describe, it, expect, vi } from 'vitest';
import { createWebGPUContext } from '../../../src/render/webgpu/context';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../../src/render/webgpu/headless';

// We need to conditionally run these tests only if we can load webgpu
let webgpuAvailable = false;
try {
  // Try to load webgpu
  const { gpu } = require('webgpu');
  if (gpu) {
    webgpuAvailable = true;

    // Polyfill navigator.gpu for the test environment
    if (!global.navigator) {
      // @ts-ignore
      global.navigator = {};
    }
    // @ts-ignore
    if (!global.navigator.gpu) {
      // @ts-ignore
      global.navigator.gpu = gpu;
    }
  }
} catch (e) {
  console.warn('webgpu package not available, skipping real integration tests');
}

describe.skipIf(!webgpuAvailable)('WebGPU Integration (Real)', () => {
  it('should create a real WebGPU context headlessly', async () => {
    const context = await createWebGPUContext();
    expect(context.device).toBeDefined();
    expect(context.isHeadless).toBe(true);
    expect(context.adapter).toBeDefined();
  });

  it('should support basic rendering commands', async () => {
    const context = await createWebGPUContext();
    const device = context.device;

    const width = 64;
    const height = 64;
    const { texture, view } = createHeadlessRenderTarget(device, width, height, 'rgba8unorm');

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 }, // Red
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });
    pass.end();

    device.queue.submit([encoder.finish()]);

    // Read back
    const data = await captureRenderTarget(device, texture);

    // Check first pixel is red
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(0);
    expect(data[3]).toBe(255);
  });
});
