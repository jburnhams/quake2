import { describe, expect, test } from 'vitest';
import { mat4 } from 'gl-matrix';
import { WebGLMatrixBuilder } from '../../../src/render/matrix/webgl.js';
import { Camera } from '../../../src/render/camera.js';
import { CameraState } from '../../../src/render/types/camera.js';

// Custom matcher helper
function expectMatricesToBeClose(received: mat4, expected: mat4, epsilon = 1e-6) {
  for (let i = 0; i < 16; i++) {
    expect(received[i]).toBeCloseTo(expected[i], -Math.log10(epsilon));
  }
}

describe('WebGLMatrixBuilder', () => {
  test('produces same view matrix as Camera.viewMatrix', () => {
    const camera = new Camera(800, 600);
    camera.setPosition(10, 20, 30);
    camera.setRotation(15, 45, 0);

    const builder = new WebGLMatrixBuilder();
    const state = camera.toState();
    const builderView = builder.buildViewMatrix(state);

    // Force update of internal camera matrices
    const cameraView = camera.viewMatrix;

    expectMatricesToBeClose(builderView, cameraView);
  });

  test('projection matrix correct for fov=90, aspect=1', () => {
    const builder = new WebGLMatrixBuilder();
    const state: CameraState = {
      position: [0, 0, 0],
      angles: [0, 0, 0],
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const proj = builder.buildProjectionMatrix(state);

    // Check perspective projection properties
    // f = 1.0 / tan(45) = 1.0
    // aspect = 1.0
    // proj[0] = f/aspect = 1.0
    // proj[5] = f = 1.0

    expect(proj[0]).toBeCloseTo(1.0, 3);
    expect(proj[5]).toBeCloseTo(1.0, 3);

    // GL depth mapping [-1, 1]
    // For large far plane, proj[10] should be close to -1
    // -(far + near) / (far - near) ~= -1
    expect(proj[10]).toBeCloseTo(-1.0, 1);
  });

  test('view matrix identity for [0,0,0] position, [0,0,0] angles (after coord transform)', () => {
    const builder = new WebGLMatrixBuilder();
    const state: CameraState = {
        position: [0, 0, 0],
        angles: [0, 0, 0],
        fov: 90,
        aspect: 1,
        near: 0.1,
        far: 1000
    };

    const view = builder.buildViewMatrix(state);

    // Quake: X Forward, Y Left, Z Up
    // GL: -Z Forward, -X Left (X Right), Y Up

    // Transform matrix expected:
    // Q(1, 0, 0) -> GL(0, 0, -1)
    // Q(0, 1, 0) -> GL(-1, 0, 0)
    // Q(0, 0, 1) -> GL(0, 1, 0)

    // View matrix should match the quakeToGl matrix in implementation
    const expected = mat4.fromValues(
       0,  0, -1, 0,
      -1,  0,  0, 0,
       0,  1,  0, 0,
       0,  0,  0, 1
    );

    expectMatricesToBeClose(view, expected);
  });
});
