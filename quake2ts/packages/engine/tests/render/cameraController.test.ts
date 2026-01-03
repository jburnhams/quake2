import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FreeCameraController, CameraInput } from '../../src/render/cameraController';
import { Camera } from '../../src/render/camera';
import { vec3 } from 'gl-matrix';

describe('FreeCameraController', () => {
  let camera: Camera;
  let controller: FreeCameraController;

  beforeEach(() => {
    camera = new Camera();
    controller = new FreeCameraController(camera, { speed: 100, sensitivity: 1 });
  });

  it('rotates camera based on input', () => {
    const input: CameraInput = {
      moveForward: false, moveBackward: false,
      moveLeft: false, moveRight: false,
      moveUp: false, moveDown: false,
      pitch: 10, yaw: 20
    };

    controller.update(0.1, input);

    // Initial angles 0,0,0
    // Pitch += 10 * 1 = 10
    // Yaw -= 20 * 1 = -20 -> 340
    expect(camera.angles[0]).toBe(10);
    expect(camera.angles[1]).toBe(340);
  });

  it('moves camera forward', () => {
    // Face East (Yaw 0)
    camera.angles = vec3.fromValues(0, 0, 0);

    const input: CameraInput = {
      moveForward: true, moveBackward: false,
      moveLeft: false, moveRight: false,
      moveUp: false, moveDown: false,
      pitch: 0, yaw: 0
    };

    // Forward in Quake is X+
    controller.update(1.0, input);

    // Position should be (100, 0, 0)
    const pos = camera.position;
    expect(pos[0]).toBeCloseTo(100);
    expect(pos[1]).toBeCloseTo(0);
    expect(pos[2]).toBeCloseTo(0);
  });

  it('clamps pitch', () => {
    const input: CameraInput = {
        moveForward: false, moveBackward: false,
        moveLeft: false, moveRight: false,
        moveUp: false, moveDown: false,
        pitch: 100, yaw: 0
    };
    controller.update(1.0, input);
    expect(camera.angles[0]).toBe(89);

    input.pitch = -200;
    controller.update(1.0, input);
    expect(camera.angles[0]).toBe(-89);
  });

  it('respects collision toggle and checkPosition callback', () => {
    const checkPosition = vi.fn((pos: vec3) => {
      // Simulate hitting a wall at x=50
      if (pos[0] > 50) {
        return vec3.fromValues(50, pos[1], pos[2]);
      }
      return pos;
    });

    controller = new FreeCameraController(camera, {
      speed: 100,
      sensitivity: 1,
      checkPosition
    });

    const input: CameraInput = {
      moveForward: true, moveBackward: false,
      moveLeft: false, moveRight: false,
      moveUp: false, moveDown: false,
      pitch: 0, yaw: 0
    };

    // 1. Collision disabled (default)
    controller.setCollision(false);
    controller.update(1.0, input); // moves 100 units
    expect(camera.position[0]).toBeCloseTo(100);
    expect(checkPosition).not.toHaveBeenCalled();

    // Reset position
    camera.position = vec3.create();

    // 2. Collision enabled
    controller.setCollision(true);
    controller.update(1.0, input); // moves 100 units but clamped to 50
    expect(checkPosition).toHaveBeenCalled();
    expect(camera.position[0]).toBeCloseTo(50);
  });
});
