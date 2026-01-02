import { describe, it, expect, beforeEach } from 'vitest';
import { Camera } from '../../../src/render/camera';
import { vec3, mat4 } from 'gl-matrix';

describe('Camera', () => {
  let camera: Camera;

  beforeEach(() => {
    camera = new Camera();
  });

  it('should initialize with default values', () => {
    expect(camera.position).toEqual(vec3.create());
    expect(camera.angles).toEqual(vec3.create());
    expect(camera.fov).toBe(90);
  });

  it('should update matrices when dirty', () => {
    camera.position = vec3.fromValues(10, 20, 30);
    // Trigger update
    const view = camera.viewMatrix;
    expect(view).toBeDefined();
    // Simple check that translation is in matrix (remembering the coordinate transform)
    // Quake (10, 20, 30) -> GL (-20, 30, -10) roughly, but rotation is identity here.
    // Quake X(10) -> GL -Z(-10) ? No, quakeToGl matrix:
    // col 0: 0, 0, -1, 0  (X -> -Z)
    // col 1: -1, 0, 0, 0 (Y -> -X)
    // col 2: 0, 1, 0, 0  (Z -> Y)
    //
    // Actually from code:
    // col 0: 0, 0, -1 (X->-Z)
    // col 1: -1, 0, 0 (Y->-X)
    // col 2: 0, 1, 0  (Z->Y)

    // Position (10, 20, 30)
    // Rotated (identity) -> (10, 20, 30)
    // Translation in GL:
    // X = -Y_quake = -20
    // Y = Z_quake = 30
    // Z = -X_quake = -10

    // View matrix translation is usually in the last column (or row depending on layout)
    // gl-matrix is column-major.
    // M[12] = tx, M[13] = ty, M[14] = tz

    // However, camera view matrix transforms World -> View.
    // So it translates by -Position.
    // T = (-10, -20, -30)
    // Transformed T:
    // X = -(-20) = 20
    // Y = (-30) = -30
    // Z = -(-10) = 10

    // Wait, let's just check it changed from identity
    expect(view).not.toEqual(mat4.create());
  });

  describe('screenToWorldRay', () => {
    it('should correctly cast a ray from screen center to forward direction', () => {
      // Setup camera looking down -Z (default GL, but Quake is +X)
      // Quake +X forward -> GL -Z
      // Quake +Y left -> GL -X
      // Quake +Z up -> GL +Y

      // Let's rely on camera implementation details.
      // If camera is at 0,0,0 looking along +X (Quake),
      // screenToWorldRay(center) should produce a ray with origin 0,0,0 and direction +X.

      camera.position = vec3.fromValues(0, 0, 0);
      camera.angles = vec3.fromValues(0, 0, 0); // Looking +X
      camera.fov = 90;
      camera.aspect = 1;

      // Center of screen (normalized device coords 0,0)
      const ray = camera.screenToWorldRay(0.5, 0.5);

      expect(ray.origin[0]).toBeCloseTo(0);
      expect(ray.origin[1]).toBeCloseTo(0);
      expect(ray.origin[2]).toBeCloseTo(0);

      // Quake forward is +X
      expect(ray.direction[0]).toBeCloseTo(1);
      expect(ray.direction[1]).toBeCloseTo(0);
      expect(ray.direction[2]).toBeCloseTo(0);
    });

    it('should take aspect ratio into account', () => {
        camera.aspect = 2.0;
        // Test a point that is not center, e.g. 0.75, 0.5
        const ray = camera.screenToWorldRay(0.75, 0.5);
        // Should deviate
        expect(ray.direction[1]).not.toBeCloseTo(0);
    });
  });
});
