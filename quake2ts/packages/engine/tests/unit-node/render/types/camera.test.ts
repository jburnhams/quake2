import { describe, test, expect } from 'vitest';
import { Camera } from '../../../../src/render/camera.js';

describe('CameraState', () => {
  test('toState() creates immutable snapshot', () => {
    const camera = new Camera(800, 600);
    camera.setPosition(10, 20, 30);
    camera.setRotation(15, 45, 0);

    const state = camera.toState();

    expect(state.position).toEqual(new Float32Array([10, 20, 30]));
    expect(state.angles).toEqual(new Float32Array([15, 45, 0]));

    // Verify immutability
    camera.setPosition(0, 0, 0);
    expect(state.position).toEqual(new Float32Array([10, 20, 30])); // Unchanged
  });

  test('multiple toState() calls return equal objects', () => {
    const camera = new Camera();
    const state1 = camera.toState();
    const state2 = camera.toState();

    expect(state1).toEqual(state2);
    expect(state1).not.toBe(state2); // Different instances
  });
});
