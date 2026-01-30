import { describe, it, expect, vi, beforeAll } from 'vitest';
import { initHeadlessWebGPU, createHeadlessTestContext, isWebGpuAvailable } from '../../src/setup/webgpu';

describe('WebGPU Headless Setup', () => {
  let webgpuAvailable = false;

  beforeAll(async () => {
    webgpuAvailable = await isWebGpuAvailable();
  });

  it('should initialize WebGPU in Node.js environment', async (ctx) => {
    if (!webgpuAvailable) {
      ctx.skip();
      return;
    }
    const setup = await initHeadlessWebGPU();
    expect(setup).toBeDefined();
    expect(setup.adapter).toBeDefined();
    expect(setup.device).toBeDefined();
    expect(setup.cleanup).toBeTypeOf('function');

    await setup.cleanup();
  });

  it('should create a test context with adapter, device and queue', async (ctx) => {
    if (!webgpuAvailable) {
      ctx.skip();
      return;
    }
    const context = await createHeadlessTestContext();
    expect(context).toBeDefined();
    expect(context.adapter).toBeDefined();
    expect(context.device).toBeDefined();
    expect(context.queue).toBeDefined();

    // Cleanup via destroying device manually since createHeadlessTestContext doesn't return cleanup
    context.device.destroy();
  });

  it('should allow requesting specific power preference', async (ctx) => {
    if (!webgpuAvailable) {
      ctx.skip();
      return;
    }
    const setup = await initHeadlessWebGPU({ powerPreference: 'low-power' });
    expect(setup).toBeDefined();
    await setup.cleanup();
  });
});
