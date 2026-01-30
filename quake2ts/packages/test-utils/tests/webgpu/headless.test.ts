import { describe, it, expect } from 'vitest';
import { initHeadlessWebGPU, createHeadlessTestContext } from '../../src/setup/webgpu';

// These tests are intended to run against a real WebGPU implementation (e.g., using mesa-vulkan-drivers in CI)
// and should fail if the environment is not correctly configured.
// Do NOT mock 'webgpu' here.

describe('WebGPU Headless Setup', () => {
  it('should initialize WebGPU in Node.js environment', async () => {
    const setup = await initHeadlessWebGPU();
    expect(setup).toBeDefined();
    expect(setup.adapter).toBeDefined();
    expect(setup.device).toBeDefined();
    expect(setup.cleanup).toBeTypeOf('function');

    await setup.cleanup();
  });

  it('should create a test context with adapter, device and queue', async () => {
    const context = await createHeadlessTestContext();
    expect(context).toBeDefined();
    expect(context.adapter).toBeDefined();
    expect(context.device).toBeDefined();
    expect(context.queue).toBeDefined();

    // Cleanup via destroying device manually since createHeadlessTestContext doesn't return cleanup
    context.device.destroy();
  });

  it('should allow requesting specific power preference', async () => {
    const setup = await initHeadlessWebGPU({ powerPreference: 'low-power' });
    expect(setup).toBeDefined();
    await setup.cleanup();
  });
});
