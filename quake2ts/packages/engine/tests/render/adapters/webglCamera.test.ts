import { describe, test, expect } from 'vitest';
import { Camera } from '../../../src/render/camera';
import { WebGLCameraAdapter } from '../../../src/render/adapters/webglCamera';
import { mat4 } from 'gl-matrix';

// Helper to check if matrices are close
function expectToBeCloseToMat4(actual: mat4, expected: mat4, precision = 1e-6) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], -Math.log10(precision));
  }
}

describe('WebGLCameraAdapter', () => {
  test('produces identical matrices to Camera.viewMatrix', () => {
    const camera = new Camera(800, 600);
    camera.setPosition(100, 200, 50);
    camera.setRotation(-30, 135, 5);
    camera.setFov(90);

    const adapter = new WebGLCameraAdapter();
    const cameraState = camera.toState();
    const adapterMatrices = adapter.buildMatrices(cameraState);

    const cameraView = camera.viewMatrix;
    const cameraProj = camera.projectionMatrix;
    const cameraViewProj = camera.viewProjectionMatrix;

    // Must be EXACTLY equal (within float epsilon)
    expectToBeCloseToMat4(adapterMatrices.view, cameraView, 1e-5);
    expectToBeCloseToMat4(adapterMatrices.projection, cameraProj, 1e-5);
    expectToBeCloseToMat4(adapterMatrices.viewProjection, cameraViewProj, 1e-5);
  });

  test.each([
    [0, 0, 0, 0, 0, 0],
    [100, 200, 50, 0, 0, 0],
    [0, 0, 0, 45, 45, 0],
    [100, 200, 50, -30, 135, 5],
    [-50, -100, 25, 60, -90, 10]
  ])('matches at position [%d,%d,%d] angles [%d,%d,%d]',
    (x, y, z, pitch, yaw, roll) => {
      const camera = new Camera(800, 600);
      camera.setPosition(x, y, z);
      camera.setRotation(pitch, yaw, roll);

      const adapter = new WebGLCameraAdapter();
      const matrices = adapter.buildMatrices(camera.toState());

      expectToBeCloseToMat4(matrices.view, camera.viewMatrix, 1e-5);
      expectToBeCloseToMat4(matrices.projection, camera.projectionMatrix, 1e-5);
      expectToBeCloseToMat4(matrices.viewProjection, camera.viewProjectionMatrix, 1e-5);
    }
  );
});
