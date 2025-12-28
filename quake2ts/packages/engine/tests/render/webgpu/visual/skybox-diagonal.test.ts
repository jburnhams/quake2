import { describe, test, expect, vi } from 'vitest';
import { Camera } from '../../../../src/render/camera.js';
import { initHeadlessWebGPU } from '@quake2ts/test-utils/src/setup/webgpu';

// Note: This test requires a Node environment with @webgpu/dawn available.
// It is intended for visual verification in integration CI/CD.
// In jsdom environment, it will likely be skipped or mocked.

describe('Skybox Diagonal Views (Visual)', () => {
  // Logic check first (always runs)
  test('Camera.toState produces correct angles for diagonal view', () => {
    const camera = new Camera(800, 600);
    camera.setPosition(0, 0, 50);
    camera.setRotation(45, 45, 0);

    const state = camera.toState();
    expect(state.angles[0]).toBe(45); // Pitch
    expect(state.angles[1]).toBe(45); // Yaw
    expect(state.angles[2]).toBe(0);  // Roll
  });

  // Visual check
  test.skip('renders correctly at 45/45 angle', async () => {
    /*
    const { device, context } = await initHeadlessWebGPU();
    // ... setup pipeline ...
    // This is currently skipped until we have the full pipeline test factory
    // fully integrated and exported from test-utils for this specific package.
    */
  });
});
