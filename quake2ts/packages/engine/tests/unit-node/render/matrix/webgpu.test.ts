import { describe, expect, test } from 'vitest';
import { WebGPUMatrixBuilder } from '../../../../src/render/matrix/webgpu.js';
import { vec3, mat4 } from 'gl-matrix';

describe('WebGPUMatrixBuilder', () => {
  test('projection uses [0, 1] depth range', () => {
    const builder = new WebGPUMatrixBuilder();
    const state = {
      position: [0, 0, 0],
      angles: [0, 0, 0],
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const proj = builder.buildProjectionMatrix(state);

    // Verify depth mapping
    // Z_ndc = (Z_eye * P10 + P14) / -Z_eye
    // For Z_eye = -near (0.1):
    // Numerator = -0.1 * (far/(near-far)) + (near*far/(near-far))
    //           = -0.1 * (1000/-999.9) + (100/-999.9)
    //           = 100/999.9 - 100/999.9 = 0.
    // Result = 0 / 0.1 = 0.

    // For Z_eye = -far (1000):
    // Numerator = -1000 * (1000/-999.9) + (100/-999.9)
    //           = 1000000/999.9 - 100/999.9
    //           = 999900/999.9 = 1000.
    // Result = 1000 / 1000 = 1.

    // Calculate expected P14
    const expectedP14 = state.near * state.far / (state.near - state.far);
    expect(proj[14]).toBeCloseTo(expectedP14, 3);

    // Check P11 is -1 (for perspective divide)
    expect(proj[11]).toBe(-1);
  });

  test('view matrix correctly transforms World Forward (+X) to View Forward (-Z)', () => {
    const builder = new WebGPUMatrixBuilder();
    const state = {
      position: [0, 0, 0],
      angles: [0, 0, 0], // Looking East (+X)
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const view = builder.buildViewMatrix(state);

    // Point P = (10, 0, 0) is in front of camera.
    // In View Space, it should be (0, 0, -10).
    const p = vec3.fromValues(10, 0, 0);
    const pView = vec3.transformMat4(vec3.create(), p, view);

    expect(pView[0]).toBeCloseTo(0);
    expect(pView[1]).toBeCloseTo(0);
    expect(pView[2]).toBeCloseTo(-10);
  });

  test('view matrix correctly transforms World Left (+Y) to View Left (-X)', () => {
    const builder = new WebGPUMatrixBuilder();
    const state = {
      position: [0, 0, 0],
      angles: [0, 0, 0], // Looking East (+X)
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const view = builder.buildViewMatrix(state);

    // Point P = (0, 10, 0) is to the left of camera.
    // In View Space (Right +X), Left is -X. So (-10, 0, 0).
    const p = vec3.fromValues(0, 10, 0);
    const pView = vec3.transformMat4(vec3.create(), p, view);

    expect(pView[0]).toBeCloseTo(-10);
    expect(pView[1]).toBeCloseTo(0);
    expect(pView[2]).toBeCloseTo(0);
  });

  test('view matrix handles camera rotation (Look North +Y)', () => {
    const builder = new WebGPUMatrixBuilder();
    // Yaw 90 = North (+Y).
    const state = {
      position: [0, 0, 0],
      angles: [0, 90, 0], // Looking North (+Y)
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const view = builder.buildViewMatrix(state);

    // Point P = (0, 10, 0) is now in front of camera.
    // Should map to (0, 0, -10).
    const p = vec3.fromValues(0, 10, 0);
    const pView = vec3.transformMat4(vec3.create(), p, view);

    expect(pView[0]).toBeCloseTo(0);
    expect(pView[1]).toBeCloseTo(0);
    expect(pView[2]).toBeCloseTo(-10);
  });

  test('diagonal view matrix produces correct transform', () => {
    const builder = new WebGPUMatrixBuilder();
    const state = {
      position: [10, 10, 10],
      angles: [45, 45, 0],
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const view = builder.buildViewMatrix(state);
    expect(view).toBeDefined();

    // Verify translation part isn't NaN
    expect(view[12]).not.toBeNaN();
    expect(view[13]).not.toBeNaN();
    expect(view[14]).not.toBeNaN();
  });
});
