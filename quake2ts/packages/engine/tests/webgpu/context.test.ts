import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle } from '@quake2ts/test-utils';
import { createWebGPUContext } from '../../src/render/webgpu/context';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../src/render/webgpu/headless';

/**
 * Integration tests for real WebGPU rendering using the webgpu npm package with Dawn.
 *
 * Requirements:
 * - Vulkan drivers (Linux): Install mesa-vulkan-drivers (includes lavapipe software renderer)
 * - Metal (macOS): Built-in on macOS 10.11+
 * - D3D12 (Windows): Built-in on Windows 10+
 *
 * Ref: packages/engine/src/render/webgpu/context.ts
 */
describe('WebGPU Integration (Real)', () => {
  const lifecycle = createWebGPULifecycle();

  beforeAll(async () => {
    await setupHeadlessWebGPUEnv();
  });

  afterAll(lifecycle.cleanup);

  it('should create a real WebGPU context headlessly', async () => {
    const context = await createWebGPUContext();
    lifecycle.track(context.device);
    expect(context.device).toBeDefined();
    expect(context.isHeadless).toBe(true);
    expect(context.adapter).toBeDefined();
  });

  it('should support basic rendering commands', async () => {
    const context = await createWebGPUContext();
    const device = context.device;
    lifecycle.track(device);

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
