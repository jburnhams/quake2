import { describe, it, expect, afterEach } from 'vitest';
import { initHeadlessWebGPU } from '../src/setup/webgpu';

describe('Headless WebGPU Setup', () => {
  let setup: any;

  afterEach(async () => {
    if (setup && setup.cleanup) {
      await setup.cleanup();
    }
  });

  it('initializes in Node.js environment', async () => {
    try {
      setup = await initHeadlessWebGPU();

      expect(setup).toBeDefined();
      expect(setup.adapter).toBeDefined();
      expect(setup.device).toBeDefined();
      expect(setup.cleanup).toBeDefined();

      // Basic check if it looks like a GPU adapter
      // Note: properties might depend on the implementation
      expect(setup.adapter.features).toBeDefined();
      expect(setup.device.queue).toBeDefined();
    } catch (error) {
       console.error("WebGPU Init Error:", error);
       // If it fails due to missing system dependencies, we might want to skip or warn
       // but for now we expect it to work in this environment if configured correctly
       throw error;
    }
  });

  it('can be called multiple times', async () => {
    const setup1 = await initHeadlessWebGPU();
    const setup2 = await initHeadlessWebGPU();

    expect(setup1).toBeDefined();
    expect(setup2).toBeDefined();

    await setup1.cleanup();
    await setup2.cleanup();
  });
});
