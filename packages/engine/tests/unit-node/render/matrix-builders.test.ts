import { describe, expect, test } from 'vitest';
import { Camera } from '../../../src/render/camera.js';
import { WebGLMatrixBuilder } from '../../../src/render/matrix/webgl.js';
import { buildMatrices } from '../../../src/render/matrix/builders.js';
import { mat4 } from 'gl-matrix';

function expectMatricesToBeClose(received: mat4, expected: mat4, epsilon = 1e-6) {
  for (let i = 0; i < 16; i++) {
    expect(received[i]).toBeCloseTo(expected[i], -Math.log10(epsilon));
  }
}

describe('Matrix Builder Integration', () => {
  test('WebGL builder matches current Camera implementation for random views', () => {
    // Test with a few random camera states
    for (let i = 0; i < 5; i++) {
      const camera = new Camera(800, 600);

      const px = Math.random() * 1000 - 500;
      const py = Math.random() * 1000 - 500;
      const pz = Math.random() * 1000 - 500;

      const pitch = Math.random() * 180 - 90;
      const yaw = Math.random() * 360;
      const roll = Math.random() * 40 - 20;

      camera.setPosition(px, py, pz);
      camera.setRotation(pitch, yaw, roll);

      const builder = new WebGLMatrixBuilder();
      const matrices = buildMatrices(builder, camera.toState());

      // Compare view matrix
      expectMatricesToBeClose(matrices.view, camera.viewMatrix);

      // Compare projection matrix
      expectMatricesToBeClose(matrices.projection, camera.projectionMatrix);

      // Compare viewProjection matrix
      expectMatricesToBeClose(matrices.viewProjection, camera.viewProjectionMatrix);
    }
  });
});
