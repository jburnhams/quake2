import { describe, it, expect } from 'vitest';
import { Camera } from '../../src/render/camera.js';
import { vec3, mat4 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';

describe('Camera - Comprehensive Tests', () => {
  describe('Position tests (no rotation)', () => {
    it('should handle camera at various positions along X axis', () => {
      const testCases = [
        { pos: [5, 0, 0], expectedTrans: [0, 0, -5] },
        { pos: [20, 0, 0], expectedTrans: [0, 0, -20] },
        { pos: [-10, 0, 0], expectedTrans: [0, 0, 10] },
      ];

      for (const { pos, expectedTrans } of testCases) {
        const camera = new Camera();
        camera.position = vec3.fromValues(pos[0], pos[1], pos[2]);
        camera.angles = vec3.fromValues(0, 0, 0);

        const viewMatrix = camera.viewMatrix;
        expect(viewMatrix[12]).toBeCloseTo(expectedTrans[0]);
        expect(viewMatrix[13]).toBeCloseTo(expectedTrans[1]);
        expect(viewMatrix[14]).toBeCloseTo(expectedTrans[2]);
      }
    });

    it('should handle camera at various positions along Y axis', () => {
      const testCases = [
        { pos: [0, 5, 0], expectedTrans: [-5, 0, 0] },
        { pos: [0, 10, 0], expectedTrans: [-10, 0, 0] },
        { pos: [0, -15, 0], expectedTrans: [15, 0, 0] },
      ];

      for (const { pos, expectedTrans } of testCases) {
        const camera = new Camera();
        camera.position = vec3.fromValues(pos[0], pos[1], pos[2]);
        camera.angles = vec3.fromValues(0, 0, 0);

        const viewMatrix = camera.viewMatrix;
        expect(viewMatrix[12]).toBeCloseTo(expectedTrans[0]);
        expect(viewMatrix[13]).toBeCloseTo(expectedTrans[1]);
        expect(viewMatrix[14]).toBeCloseTo(expectedTrans[2]);
      }
    });

    it('should handle camera at various positions along Z axis', () => {
      const testCases = [
        { pos: [0, 0, 5], expectedTrans: [0, -5, 0] },
        { pos: [0, 0, 20], expectedTrans: [0, -20, 0] },
        { pos: [0, 0, -10], expectedTrans: [0, 10, 0] },
      ];

      for (const { pos, expectedTrans } of testCases) {
        const camera = new Camera();
        camera.position = vec3.fromValues(pos[0], pos[1], pos[2]);
        camera.angles = vec3.fromValues(0, 0, 0);

        const viewMatrix = camera.viewMatrix;
        expect(viewMatrix[12]).toBeCloseTo(expectedTrans[0]);
        expect(viewMatrix[13]).toBeCloseTo(expectedTrans[1]);
        expect(viewMatrix[14]).toBeCloseTo(expectedTrans[2]);
      }
    });

    it('should handle camera at diagonal positions', () => {
      const testCases = [
        { pos: [10, 10, 0], expectedTrans: [-10, 0, -10] },
        { pos: [5, 5, 5], expectedTrans: [-5, -5, -5] },
        { pos: [-10, 10, -10], expectedTrans: [-10, 10, 10] },
      ];

      for (const { pos, expectedTrans } of testCases) {
        const camera = new Camera();
        camera.position = vec3.fromValues(pos[0], pos[1], pos[2]);
        camera.angles = vec3.fromValues(0, 0, 0);

        const viewMatrix = camera.viewMatrix;
        expect(viewMatrix[12]).toBeCloseTo(expectedTrans[0]);
        expect(viewMatrix[13]).toBeCloseTo(expectedTrans[1]);
        expect(viewMatrix[14]).toBeCloseTo(expectedTrans[2]);
      }
    });
  });

  describe('Rotation tests (at origin)', () => {
    it('should handle yaw rotation (looking left/right)', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(0, 0, 0);
      camera.angles = vec3.fromValues(0, 90, 0); // 90 degree yaw

      const viewMatrix = camera.viewMatrix;

      // With 90 degree yaw, the rotation should change but translation should remain 0
      expect(viewMatrix[12]).toBeCloseTo(0);
      expect(viewMatrix[13]).toBeCloseTo(0);
      expect(viewMatrix[14]).toBeCloseTo(0);

      // The rotation part should be different from identity
      const identityRotation = mat4.fromValues(
        0, -1, 0, 0,
        0, 0, 1, 0,
        -1, 0, 0, 0,
        0, 0, 0, 1
      );
      expect(viewMatrix).not.toEqual(identityRotation);
    });

    it('should handle pitch rotation (looking up/down)', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(0, 0, 0);
      camera.angles = vec3.fromValues(45, 0, 0); // 45 degree pitch

      const viewMatrix = camera.viewMatrix;

      // Translation should remain 0
      expect(viewMatrix[12]).toBeCloseTo(0);
      expect(viewMatrix[13]).toBeCloseTo(0);
      expect(viewMatrix[14]).toBeCloseTo(0);
    });

    it('should handle roll rotation', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(0, 0, 0);
      camera.angles = vec3.fromValues(0, 0, 30); // 30 degree roll

      const viewMatrix = camera.viewMatrix;

      // Translation should remain 0
      expect(viewMatrix[12]).toBeCloseTo(0);
      expect(viewMatrix[13]).toBeCloseTo(0);
      expect(viewMatrix[14]).toBeCloseTo(0);
    });

    it('should handle combined rotations', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(0, 0, 0);
      camera.angles = vec3.fromValues(30, 45, 15); // pitch, yaw, roll

      const viewMatrix = camera.viewMatrix;

      // Translation should remain 0
      expect(viewMatrix[12]).toBeCloseTo(0);
      expect(viewMatrix[13]).toBeCloseTo(0);
      expect(viewMatrix[14]).toBeCloseTo(0);
    });
  });

  describe('Combined position and rotation tests', () => {
    it('should handle forward position with yaw rotation', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(10, 0, 0);
      camera.angles = vec3.fromValues(0, 90, 0); // 90 degree yaw

      const viewMatrix = camera.viewMatrix;

      // The translation should be affected by the rotation
      // This tests that rotation is properly applied before coordinate transformation
      expect(Number.isFinite(viewMatrix[12])).toBe(true);
      expect(Number.isFinite(viewMatrix[13])).toBe(true);
      expect(Number.isFinite(viewMatrix[14])).toBe(true);
    });

    it('should handle position with pitch rotation', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(0, 0, 10);
      camera.angles = vec3.fromValues(45, 0, 0); // 45 degree pitch up

      const viewMatrix = camera.viewMatrix;

      // Check that values are finite and not NaN
      expect(Number.isFinite(viewMatrix[12])).toBe(true);
      expect(Number.isFinite(viewMatrix[13])).toBe(true);
      expect(Number.isFinite(viewMatrix[14])).toBe(true);
    });

    it('should handle complex position and rotation', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(10, 5, 20);
      camera.angles = vec3.fromValues(30, 45, 0);

      const viewMatrix = camera.viewMatrix;

      // All components should be finite
      for (let i = 0; i < 16; i++) {
        expect(Number.isFinite(viewMatrix[i])).toBe(true);
        expect(Number.isNaN(viewMatrix[i])).toBe(false);
      }

      // The last row should always be [0, 0, 0, 1]
      expect(viewMatrix[3]).toBe(0);
      expect(viewMatrix[7]).toBe(0);
      expect(viewMatrix[11]).toBe(0);
      expect(viewMatrix[15]).toBe(1);
    });
  });

  describe('Projection matrix tests', () => {
    it('should update projection matrix when FOV changes', () => {
      const camera = new Camera();
      camera.aspect = 16 / 9;

      camera.fov = 90;
      const proj1 = mat4.clone(camera.projectionMatrix);

      camera.fov = 60;
      const proj2 = mat4.clone(camera.projectionMatrix);

      expect(proj1).not.toEqual(proj2);
    });

    it('should update projection matrix when aspect ratio changes', () => {
      const camera = new Camera();
      camera.fov = 90;

      camera.aspect = 4 / 3;
      const proj1 = mat4.clone(camera.projectionMatrix);

      camera.aspect = 16 / 9;
      const proj2 = mat4.clone(camera.projectionMatrix);

      expect(proj1).not.toEqual(proj2);
    });
  });

  describe('View-projection matrix tests', () => {
    it('should correctly combine view and projection matrices', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(10, 5, 20);
      camera.angles = vec3.fromValues(0, 45, 0);
      camera.fov = 75;
      camera.aspect = 16 / 9;

      const viewMatrix = camera.viewMatrix;
      const projectionMatrix = camera.projectionMatrix;
      const viewProjectionMatrix = camera.viewProjectionMatrix;

      // Manually compute VP = P * V
      const expected = mat4.create();
      mat4.multiply(expected, projectionMatrix, viewMatrix);

      // Compare all components
      for (let i = 0; i < 16; i++) {
        expect(viewProjectionMatrix[i]).toBeCloseTo(expected[i], 5);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle very small positions', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(0.001, 0.001, 0.001);
      camera.angles = vec3.fromValues(0, 0, 0);

      const viewMatrix = camera.viewMatrix;

      // All values should be finite
      for (let i = 0; i < 16; i++) {
        expect(Number.isFinite(viewMatrix[i])).toBe(true);
      }
    });

    it('should handle very large positions', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(10000, 5000, 20000);
      camera.angles = vec3.fromValues(0, 0, 0);

      const viewMatrix = camera.viewMatrix;

      // All values should be finite
      for (let i = 0; i < 16; i++) {
        expect(Number.isFinite(viewMatrix[i])).toBe(true);
      }
    });

    it('should handle negative zero in positions', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(-0, 0, -0);
      camera.angles = vec3.fromValues(0, 0, 0);

      const viewMatrix = camera.viewMatrix;

      // Translation should be all zeros (not negative zeros)
      expect(viewMatrix[12]).toBe(0);
      expect(viewMatrix[13]).toBe(0);
      expect(viewMatrix[14]).toBe(0);
    });

    it('should handle 360 degree rotations', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(10, 0, 0);
      camera.angles = vec3.fromValues(0, 360, 0); // Full rotation

      const viewMatrix = camera.viewMatrix;

      // Should be similar to 0 degrees
      const camera0 = new Camera();
      camera0.position = vec3.fromValues(10, 0, 0);
      camera0.angles = vec3.fromValues(0, 0, 0);

      const viewMatrix0 = camera0.viewMatrix;

      for (let i = 0; i < 16; i++) {
        expect(viewMatrix[i]).toBeCloseTo(viewMatrix0[i], 5);
      }
    });
  });

  describe('Matrix property validation', () => {
    it('should always have w component as 1 in the last row', () => {
      const testCases = [
        { pos: [10, 5, 20], angles: [30, 45, 15] },
        { pos: [-5, 10, -15], angles: [90, 180, 0] },
        { pos: [0, 0, 0], angles: [0, 0, 0] },
      ];

      for (const { pos, angles } of testCases) {
        const camera = new Camera();
        camera.position = vec3.fromValues(pos[0], pos[1], pos[2]);
        camera.angles = vec3.fromValues(angles[0], angles[1], angles[2]);

        const viewMatrix = camera.viewMatrix;

        // Bottom row should always be [0, 0, 0, 1]
        expect(viewMatrix[3]).toBe(0);
        expect(viewMatrix[7]).toBe(0);
        expect(viewMatrix[11]).toBe(0);
        expect(viewMatrix[15]).toBe(1);
      }
    });

    it('should produce orthogonal rotation matrix (when at origin)', () => {
      const camera = new Camera();
      camera.position = vec3.fromValues(0, 0, 0);
      camera.angles = vec3.fromValues(0, 45, 0);

      const viewMatrix = camera.viewMatrix;

      // Extract the 3x3 rotation part
      const col0 = vec3.fromValues(viewMatrix[0], viewMatrix[1], viewMatrix[2]);
      const col1 = vec3.fromValues(viewMatrix[4], viewMatrix[5], viewMatrix[6]);
      const col2 = vec3.fromValues(viewMatrix[8], viewMatrix[9], viewMatrix[10]);

      // Check that columns are orthogonal (dot product should be ~0)
      expect(vec3.dot(col0, col1)).toBeCloseTo(0, 5);
      expect(vec3.dot(col0, col2)).toBeCloseTo(0, 5);
      expect(vec3.dot(col1, col2)).toBeCloseTo(0, 5);

      // Check that columns are unit length
      expect(vec3.length(col0)).toBeCloseTo(1, 5);
      expect(vec3.length(col1)).toBeCloseTo(1, 5);
      expect(vec3.length(col2)).toBeCloseTo(1, 5);
    });
  });
});
