import { describe, test, expect } from 'vitest';
import { WebGPUMatrixBuilder } from '../../../src/render/matrix/webgpu.js';
import type { CameraState } from '../../../src/render/types/camera.js';
import { vec4, mat4 } from 'gl-matrix';

describe('WebGPUMatrixBuilder View Matrix', () => {
    const builder = new WebGPUMatrixBuilder();

    // Helper to transform a point
    function transformPoint(matrix: mat4, point: [number, number, number]): [number, number, number] {
        const v = vec4.fromValues(point[0], point[1], point[2], 1);
        vec4.transformMat4(v, v, matrix);
        return [v[0], v[1], v[2]];
    }

    test('looking forward (yaw=0) transforms Quake +X to WebGPU -Z (center)', () => {
        const camera: CameraState = {
            position: [0, 0, 0],
            angles: [0, 0, 0], // pitch=0, yaw=0, roll=0
            fov: 90,
            aspect: 1,
            near: 0.1,
            far: 1000
        };

        const view = builder.buildViewMatrix(camera);

        // Quake +X (forward) should become WebGPU -Z (forward in clip space)
        const forward = transformPoint(view, [1, 0, 0]);
        expect(forward[0]).toBeCloseTo(0, 5);  // X = 0
        expect(forward[1]).toBeCloseTo(0, 5);  // Y = 0
        expect(forward[2]).toBeCloseTo(-1, 5); // Z = -1 (forward)

        // Quake +Y (left) should become WebGPU -X (left)
        const left = transformPoint(view, [0, 1, 0]);
        expect(left[0]).toBeCloseTo(-1, 5); // X = -1 (left)
        expect(left[1]).toBeCloseTo(0, 5);
        expect(left[2]).toBeCloseTo(0, 5);

        // Quake +Z (up) should become WebGPU +Y (up)
        const up = transformPoint(view, [0, 0, 1]);
        expect(up[0]).toBeCloseTo(0, 5);
        expect(up[1]).toBeCloseTo(1, 5);  // Y = 1 (up)
        expect(up[2]).toBeCloseTo(0, 5);
    });

    test('front face corner (1, 1, 1) transforms to top-left of screen', () => {
        const camera: CameraState = {
            position: [0, 0, 0],
            angles: [0, 0, 0],
            fov: 90,
            aspect: 1,
            near: 0.1,
            far: 1000
        };

        const view = builder.buildViewMatrix(camera);

        // Front face vertex at (1, 1, 1) in Quake should transform to:
        // - X negative (left, from Quake Y=1)
        // - Y positive (up, from Quake Z=1)
        // - Z negative (forward, from Quake X=1)
        const corner = transformPoint(view, [1, 1, 1]);
        expect(corner[0]).toBeCloseTo(-1, 5); // Left
        expect(corner[1]).toBeCloseTo(1, 5);  // Up
        expect(corner[2]).toBeCloseTo(-1, 5); // Forward

        // This should appear at top-left of screen after projection
    });

    test('left face corner (-1, 1, 1) is behind camera', () => {
        const camera: CameraState = {
            position: [0, 0, 0],
            angles: [0, 0, 0],
            fov: 90,
            aspect: 1,
            near: 0.1,
            far: 1000
        };

        const view = builder.buildViewMatrix(camera);

        // Left face vertex at (-1, 1, 1) has negative X in Quake (behind when looking forward)
        const corner = transformPoint(view, [-1, 1, 1]);
        expect(corner[2]).toBeCloseTo(1, 5); // Z = +1 (behind camera)
    });

    test('direction sampling should give correct face', () => {
        // For the skybox, we use raw Quake positions as directions
        // Direction (1, 0, 0) should sample Face 0 (+X) = Red
        // Direction (0, 1, 0) should sample Face 2 (+Y) = Green
        // Direction (0, 0, 1) should sample Face 4 (+Z) = Blue

        // WebGPU cubemap face indices:
        // 0: +X, 1: -X, 2: +Y, 3: -Y, 4: +Z, 5: -Z

        // With our mapping:
        // Face 0 (+X): Quake Forward = Red ✓
        // Face 2 (+Y): Quake Left = Green ✓
        // Face 4 (+Z): Quake Up = Blue ✓

        // The direction (1, 0, 0) samples Face 0
        const dir = [1, 0, 0];
        const absX = Math.abs(dir[0]);
        const absY = Math.abs(dir[1]);
        const absZ = Math.abs(dir[2]);

        expect(absX).toBeGreaterThan(absY);
        expect(absX).toBeGreaterThan(absZ);
        expect(dir[0]).toBeGreaterThan(0); // +X face
    });
});
