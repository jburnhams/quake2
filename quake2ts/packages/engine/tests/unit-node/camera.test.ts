
import { describe, it, expect } from 'vitest';
import { vec3, mat4 } from 'gl-matrix';
import { Camera } from '../../src/render/camera';

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
        // NEW MAPPING:
        // Quake X (Forward) -> GL -Z
        // Quake Y (Left)    -> GL -X
        // Quake Z (Up)      -> GL Y
        const expected = mat4.fromValues(
             0,  0, -1, 0,  // Col 0: Quake X -> GL -Z
            -1,  0,  0, 0,  // Col 1: Quake Y -> GL -X
             0,  1,  0, 0,  // Col 2: Quake Z -> GL Y
             0,  0,  0, 1
        );

        expectMat4CloseTo(camera.viewMatrix, expected);
    });

    it('should calculate view matrix with translation', () => {
        const camera = new Camera();
        // Position in Quake coordinates
        camera.position = vec3.fromValues(10, 20, 30); // X=10 (forward), Y=20 (left), Z=30 (up)
        camera.angles = vec3.fromValues(0, 0, 0);

        // Translation logic updated:
        // Quake Pos (10, 20, 30) -> Negative (-10, -20, -30) for view matrix translation.
        // Transform negative pos to GL:
        // GL X = -Quake Y = -20
        // GL Y =  Quake Z =  30  <-- Wait, Q Z (30) -> GL Y (30)?? No.
        // Let's check rotation matrix: Q Z -> GL Y. So if we have vector (0,0,1) it becomes (0,1,0).
        // So Quake Z (-30) -> GL Y (-30).
        // GL Z = -Quake X = -(-10) = 10? No.
        // Q X (Forward) -> GL -Z.
        // So vector (1,0,0) becomes (0,0,-1).
        // So Quake X (-10) -> GL Z (10).

        // Let's re-verify the implementation code:
        // const translationGl = vec3.fromValues(
        //    rotatedPosQuake[1] ? -rotatedPosQuake[1] : 0,  // Y in Quake -> -X in WebGL
        //    rotatedPosQuake[2] || 0,  // Z in Quake -> Y in WebGL
        //    rotatedPosQuake[0] ? -rotatedPosQuake[0] : 0   // X in Quake -> -Z in WebGL
        // );

        // Input: (-10, -20, -30)
        // GL X = -(-20) = 20
        // GL Y = -30
        // GL Z = -(-10) = 10

        const expected = mat4.fromValues(
             0,  0, -1, 0,
            -1,  0,  0, 0,
             0,  1,  0, 0,
            20, -30, 10, 1
        );

        expectMat4CloseTo(camera.viewMatrix, expected);
    });

    it('should calculate view matrix with yaw', () => {
        const camera = new Camera();
        camera.angles = vec3.fromValues(0, 90, 0); // 90 degrees yaw (turn right)

        // A 90-degree yaw in Quake is a rotation around the Z-axis.
        const expectedRotation = mat4.create();
        // NEW MAPPING
        const quakeToGl = mat4.fromValues(
             0,  0, -1, 0,
            -1,  0,  0, 0,
             0,  1,  0, 0,
             0,  0,  0, 1
        );
        const rotationQuake = mat4.create();
        mat4.rotateZ(rotationQuake, rotationQuake, (-90 * Math.PI) / 180);
        mat4.multiply(expectedRotation, quakeToGl, rotationQuake);

        expectMat4CloseTo(camera.viewMatrix, expectedRotation);
    });
});
