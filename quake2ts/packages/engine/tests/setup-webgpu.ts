import { beforeAll, afterAll } from 'vitest';
import { initHeadlessWebGPU, HeadlessWebGPUSetup } from '@quake2ts/test-utils';

// Global reference to prevent multiple re-initializations if possible
// Though initHeadlessWebGPU creates new adapter/device each time usually.
// Dawn/Node usually handles multiple requests fine.

let globalSetup: HeadlessWebGPUSetup | null = null;

beforeAll(async () => {
  // Initialize @webgpu/dawn once for all tests in this suite if needed.
  // However, initHeadlessWebGPU is designed to be called per-test or per-setup
  // to give fresh devices.
  // But we can ensure the globals are patched here.
  try {
      if (typeof process !== 'undefined' && process.release?.name === 'node') {
          // Just run it once to patch globals and verify it works
          globalSetup = await initHeadlessWebGPU();
      }
  } catch (e) {
      console.warn('Skipping WebGPU global setup (might be in browser or not supported):', e);
  }
});

afterAll(async () => {
  if (globalSetup) {
    await globalSetup.cleanup();
    globalSetup = null;
  }
});
