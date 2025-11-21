
import { describe, it, expect } from 'vitest';
import { vec3, mat4 } from 'gl-matrix';
import { Camera } from '../src/render/camera';

// Helper to compare matrices with a tolerance
const expectMat4CloseTo = (actual: mat4, expected: mat4, epsilon = 1e-6) => {
    for (let i = 0; i < 16; i++) {
        expect(actual[i]).toBeCloseTo(expected[i], epsilon);
    }
};

describe('Camera', () => {
    it('should initialize with default values', () => {
        const camera = new Camera();
        expect(camera.position).toEqual(vec3.fromValues(0, 0, 0));
        expect(camera.angles).toEqual(vec3.fromValues(0, 0, 0));
        expect(camera.fov).toBe(90);
        expect(camera.aspect).toBe(1.0);
    });

    it('should update position', () => {
        const camera = new Camera();
        const newPosition = vec3.fromValues(10, 20, 30);
        camera.position = newPosition;
        expect(camera.position).toEqual(newPosition);
    });

    it('should update angles', () => {
        const camera = new Camera();
        const newAngles = vec3.fromValues(10, 20, 30);
        camera.angles = newAngles;
        expect(camera.angles).toEqual(newAngles);
    });

    it('should calculate projection matrix correctly', () => {
        const camera = new Camera();
        camera.fov = 90;
        camera.aspect = 16 / 9;

        const expected = mat4.create();
        mat4.perspective(expected, (90 * Math.PI) / 180, 16 / 9, 0.1, 1000);

        expectMat4CloseTo(camera.projectionMatrix, expected);
    });

    it('should calculate view matrix for default position (just coordinate system transform)', () => {
        const camera = new Camera();
        camera.position = vec3.fromValues(0, 0, 0);
        camera.angles = vec3.fromValues(0, 0, 0);

        // This is the expected matrix that transforms from Quake's coordinate system
        // (X forward, Y left, Z up) to WebGL's (X right, Y up, Z back).
        // It's a combination of rotations to align the axes.
        const expected = mat4.fromValues(
             0, -1,  0, 0,
             0,  0,  1, 0,
            -1,  0,  0, 0,
             0,  0,  0, 1
        );

        expectMat4CloseTo(camera.viewMatrix, expected);
    });

    it('should calculate view matrix with translation', () => {
        const camera = new Camera();
        // Position in Quake coordinates
        camera.position = vec3.fromValues(10, 20, 30); // X=10 (forward), Y=20 (left), Z=30 (up)
        camera.angles = vec3.fromValues(0, 0, 0);

        // In WebGL view space, the camera is at the origin, and the world moves.
        // So we expect a translation of (-10, -20, -30) in Quake space, which then
        // needs to be transformed into WebGL space.
        // According to the comprehensive tests, the transformed translation is:
        // WebGL_X = -Quake_Y, WebGL_Y = -Quake_Z, WebGL_Z = -Quake_X
        // Expected translation: (-20, -30, -10)
        const expected = mat4.fromValues(
             0, -1,  0, 0,
             0,  0,  1, 0,
            -1,  0,  0, 0,
           -20, -30, -10, 1
        );

        expectMat4CloseTo(camera.viewMatrix, expected);
    });

    it('should calculate view matrix with yaw', () => {
        const camera = new Camera();
        camera.angles = vec3.fromValues(0, 90, 0); // 90 degrees yaw (turn right)

        // A 90-degree yaw in Quake is a rotation around the Z-axis.
        // This should result in the camera looking down the positive Y (left) axis in Quake space.
        // We need to figure out the final combined rotation matrix.
        const expectedRotation = mat4.create();
        const quakeToGl = mat4.fromValues(0, -1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1);
        const rotationQuake = mat4.create();
        mat4.rotateZ(rotationQuake, rotationQuake, (-90 * Math.PI) / 180);
        mat4.multiply(expectedRotation, quakeToGl, rotationQuake);

        expectMat4CloseTo(camera.viewMatrix, expectedRotation);
    });
});
