import { describe, expect, test, vi } from 'vitest';
import { mat4 } from 'gl-matrix';
import { buildMatrices, MatrixBuilder } from '../../../src/render/matrix/builders.js';
import { CameraState } from '../../../src/render/types/camera.js';
import { CoordinateSystem } from '../../../src/render/types/coordinates.js';

describe('buildMatrices', () => {
  const mockCameraState: CameraState = {
    position: [0, 0, 0],
    angles: [0, 0, 0],
    fov: 90,
    aspect: 1,
    near: 1,
    far: 1000
  };

  test('multiplies projection * view correctly', () => {
    // Create mock matrices
    const viewMatrix = mat4.create();
    mat4.identity(viewMatrix);
    viewMatrix[12] = 10; // Translation X

    const projMatrix = mat4.create();
    mat4.identity(projMatrix);
    projMatrix[5] = 2; // Scale Y

    // Mock builder
    const builder: MatrixBuilder = {
      coordinateSystem: CoordinateSystem.OPENGL,
      buildViewMatrix: vi.fn().mockReturnValue(viewMatrix),
      buildProjectionMatrix: vi.fn().mockReturnValue(projMatrix)
    };

    const result = buildMatrices(builder, mockCameraState);

    // Expected: projection * view
    // [ 1, 0, 0, 0 ]   [ 1, 0, 0, 0 ]
    // [ 0, 2, 0, 0 ] * [ 0, 1, 0, 0 ]
    // [ 0, 0, 1, 0 ]   [ 0, 0, 1, 0 ]
    // [ 0, 0, 0, 1 ]   [ 10,0, 0, 1 ]
    // Result should have translation X transformed by Scale Y?
    // No, P * V transforms V first.
    // V transforms point P_in: V * P_in.
    // P transforms (V * P_in): P * V * P_in.
    // So the combined matrix is P * V.

    // Let's verify with gl-matrix multiplication
    const expected = mat4.create();
    mat4.multiply(expected, projMatrix, viewMatrix);

    expect(result.viewProjection).toEqual(expected);

    // Also verify calls
    expect(builder.buildViewMatrix).toHaveBeenCalledWith(mockCameraState);
    expect(builder.buildProjectionMatrix).toHaveBeenCalledWith(mockCameraState);
  });

  test('matrices are distinct objects', () => {
     const viewMatrix = mat4.create();
     const projMatrix = mat4.create();

     const builder: MatrixBuilder = {
       coordinateSystem: CoordinateSystem.OPENGL,
       buildViewMatrix: vi.fn().mockReturnValue(viewMatrix),
       buildProjectionMatrix: vi.fn().mockReturnValue(projMatrix)
     };

     const result = buildMatrices(builder, mockCameraState);

     expect(result.view).toBe(viewMatrix);
     expect(result.projection).toBe(projMatrix);

     // The viewProjection should be a new object
     expect(result.viewProjection).not.toBe(viewMatrix);
     expect(result.viewProjection).not.toBe(projMatrix);
  });
});
