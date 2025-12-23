import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createWebGPUContext } from '../../../src/render/webgpu/context';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../../src/render/webgpu/headless';

// Import webgpu/dawn bindings for Node.js
import { create, globals } from 'webgpu';

// Register globals for Node.js environment
Object.assign(global, globals);

// Polyfill navigator.gpu
if (!global.navigator) {
  (global as any).navigator = {};
}
(global.navigator as any).gpu = create([]);

/**
 * Integration tests for real WebGPU rendering using the webgpu npm package with Dawn.
 *
 * Requirements:
 * - Vulkan drivers (Linux): Install mesa-vulkan-drivers (includes lavapipe software renderer)
 * - Metal (macOS): Built-in on macOS 10.11+
 * - D3D12 (Windows): Built-in on Windows 10+
 *
 * These tests will skip gracefully if GPU/drivers are unavailable (common in CI environments).
 * See docs/section-20-1.md for setup instructions.
 *
 * Ref: packages/engine/src/render/webgpu/context.ts
 */
describe('WebGPU Integration (Real)', () => {
  let gpuAvailable = true;
  const devices: GPUDevice[] = [];

  beforeAll(async () => {
    // Check if GPU is available by attempting adapter request
    try {
      const adapter = await navigator.gpu.requestAdapter();
      gpuAvailable = adapter !== null;
      if (!gpuAvailable) {
        console.warn('⚠️  WebGPU adapter not available - integration tests will be skipped');
        console.warn('   To run these tests locally, install GPU drivers (see docs/section-20-1.md)');
      }
    } catch (error) {
      gpuAvailable = false;
      console.warn('⚠️  WebGPU not available:', error);
    }
  });

  // Clean up devices after all tests
  afterAll(async () => {
    // Wait for all devices to be destroyed. This is more reliable than a fixed timeout.
    const lostPromises = devices.map(d => d.lost);
    for (const device of devices) {
      device.destroy();
    }
    await Promise.all(lostPromises);
  });

  it('should create a real WebGPU context headlessly', async () => {
    if (!gpuAvailable) {
      console.log('⏭️  Skipping: GPU drivers not available');
      return;
    }

    const context = await createWebGPUContext();
    devices.push(context.device); // Track for cleanup
    expect(context.device).toBeDefined();
    expect(context.isHeadless).toBe(true);
    expect(context.adapter).toBeDefined();
  });

  it('should support basic rendering commands', async () => {
    if (!gpuAvailable) {
      console.log('⏭️  Skipping: GPU drivers not available');
      return;
    }

    const context = await createWebGPUContext();
    const device = context.device;
    devices.push(device); // Track for cleanup

    const width = 64;
    const height = 64;
    const { texture, view } = createHeadlessRenderTarget(device, width, height, 'rgba8unorm');

    // Create a simple render pass that clears to red
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

    // Read back framebuffer and verify it was cleared to red
    const data = await captureRenderTarget(device, texture);

    // Check first pixel is red (RGBA: 255, 0, 0, 255)
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(0);
    expect(data[3]).toBe(255);
  });
});
