import { describe, test, expect } from 'vitest';
import { WebGPUMatrixBuilder } from '../../../src/render/matrix/webgpu.js';
import { Camera } from '../../../src/render/camera.js';
import type { CameraState } from '../../../src/render/types/camera.js';
import { vec4, mat4, vec3 } from 'gl-matrix';
import { RAD2DEG } from '@quake2ts/shared';

/**
 * This test verifies the complete skybox coordinate transformation pipeline:
 * 1. Cube vertex positions in Quake coordinates
 * 2. View matrix transforms vertices to screen positions
 * 3. Shader transforms direction from Quake to GL cubemap coordinates
 * 4. Cubemap face is selected based on dominant component
 *
 * The expected result when looking forward (+X in Quake):
 * - Center of screen should show the front face (Red)
 * - Left side should show the left face (Green)
 * - Right side should show the right face (Magenta)
 * - Top should show the up face (Blue)
 * - Bottom should show the down face (Yellow)
 */

describe('Skybox Coordinate Transform Pipeline', () => {
    const builder = new WebGPUMatrixBuilder();

    // Helper to transform a point by matrix
    function transformPoint(matrix: mat4, point: [number, number, number]): [number, number, number, number] {
        const v = vec4.fromValues(point[0], point[1], point[2], 1);
        vec4.transformMat4(v, v, matrix);
        return [v[0], v[1], v[2], v[3]];
    }

    // Simulate the shader's Quake->GL cubemap transform
    function quakeToGLCubemap(direction: [number, number, number]): [number, number, number] {
        // From skybox.wgsl:
        // cubemapDir.x = -direction.y;  // Quake +Y (left) → GL -X (left)
        // cubemapDir.y = direction.z;   // Quake +Z (up) → GL +Y (up)
        // cubemapDir.z = -direction.x;  // Quake +X (forward) → GL -Z (forward)
        return [-direction[1], direction[2], -direction[0]];
    }

    // Determine which cubemap face would be sampled
    function getCubemapFace(dir: [number, number, number]): { face: number; name: string; quakeName: string } {
        const absX = Math.abs(dir[0]);
        const absY = Math.abs(dir[1]);
        const absZ = Math.abs(dir[2]);

        // WebGPU cubemap faces: 0:+X, 1:-X, 2:+Y, 3:-Y, 4:+Z, 5:-Z
        if (absX >= absY && absX >= absZ) {
            return dir[0] > 0
                ? { face: 0, name: '+X (right)', quakeName: 'right (-Y)' }
                : { face: 1, name: '-X (left)', quakeName: 'left (+Y)' };
        } else if (absY >= absX && absY >= absZ) {
            return dir[1] > 0
                ? { face: 2, name: '+Y (top)', quakeName: 'up (+Z)' }
                : { face: 3, name: '-Y (bottom)', quakeName: 'down (-Z)' };
        } else {
            return dir[2] > 0
                ? { face: 4, name: '+Z (back)', quakeName: 'back (-X)' }
                : { face: 5, name: '-Z (front)', quakeName: 'front (+X)' };
        }
    }

    // Face color mapping based on test setup
    const faceColors: Record<number, string> = {
        0: 'Magenta (right)',
        1: 'Green (left)',
        2: 'Blue (up)',
        3: 'Yellow (down)',
        4: 'Cyan (back)',
        5: 'Red (front)'
    };

    describe('Looking Forward (yaw=0)', () => {
        const camera: CameraState = {
            position: [0, 0, 0],
            angles: [0, 0, 0], // pitch=0, yaw=0, roll=0
            fov: 90,
            aspect: 1,
            near: 0.1,
            far: 1000
        };

        test('front face center vertex (1,0,0) should be at screen center (-Z in view)', () => {
            const view = builder.buildViewMatrix(camera);
            const projection = builder.buildProjectionMatrix(camera);

            // Remove translation for skybox (it's at infinity)
            view[12] = 0;
            view[13] = 0;
            view[14] = 0;

            const viewProjection = mat4.create();
            mat4.multiply(viewProjection, projection, view);

            // Front face center is at (1, 0, 0) in Quake
            const viewPos = transformPoint(view, [1, 0, 0]);
            console.log('Front face center (1,0,0) in view space:', viewPos);

            // Should be at -Z (forward in view)
            expect(viewPos[0]).toBeCloseTo(0, 3);
            expect(viewPos[1]).toBeCloseTo(0, 3);
            expect(viewPos[2]).toBeCloseTo(-1, 3);
        });

        test('direction for front face center samples Red (front) face', () => {
            // The direction passed to shader is the RAW vertex position: (1, 0, 0)
            const quakeDirection: [number, number, number] = [1, 0, 0];

            // Apply shader transform
            const glDirection = quakeToGLCubemap(quakeDirection);
            console.log('Quake direction (1,0,0) -> GL cubemap direction:', glDirection);

            // Should be (0, 0, -1) = forward in GL
            expect(glDirection[0]).toBeCloseTo(0, 5);
            expect(glDirection[1]).toBeCloseTo(0, 5);
            expect(glDirection[2]).toBeCloseTo(-1, 5);

            const face = getCubemapFace(glDirection);
            console.log('Samples face:', face, '=', faceColors[face.face]);

            // Should sample face 5 (-Z) = Red (front)
            expect(face.face).toBe(5);
            expect(face.quakeName).toBe('front (+X)');
        });

        test('left face center vertex (0,1,0) should be on left side of screen', () => {
            const view = builder.buildViewMatrix(camera);
            view[12] = 0; view[13] = 0; view[14] = 0;

            // Left face center is at (0, 1, 0) in Quake
            const viewPos = transformPoint(view, [0, 1, 0]);
            console.log('Left face center (0,1,0) in view space:', viewPos);

            // Should be at -X (left in view)
            expect(viewPos[0]).toBeCloseTo(-1, 3);
            expect(viewPos[1]).toBeCloseTo(0, 3);
            expect(viewPos[2]).toBeCloseTo(0, 3);
        });

        test('direction for left face center samples Green (left) face', () => {
            const quakeDirection: [number, number, number] = [0, 1, 0];
            const glDirection = quakeToGLCubemap(quakeDirection);
            console.log('Quake direction (0,1,0) -> GL cubemap direction:', glDirection);

            // Should be (-1, 0, 0) = left in GL
            expect(glDirection[0]).toBeCloseTo(-1, 5);
            expect(glDirection[1]).toBeCloseTo(0, 5);
            expect(glDirection[2]).toBeCloseTo(0, 5);

            const face = getCubemapFace(glDirection);
            console.log('Samples face:', face, '=', faceColors[face.face]);

            // Should sample face 1 (-X) = Green (left)
            expect(face.face).toBe(1);
            expect(face.quakeName).toBe('left (+Y)');
        });
    });

    describe('Looking Back (yaw=180 or equivalent)', () => {
        // When looking back, we rotate 180 degrees around Z
        const camera: CameraState = {
            position: [0, 0, 0],
            angles: [0, 180, 0], // yaw=180 = looking back (-X)
            fov: 90,
            aspect: 1,
            near: 0.1,
            far: 1000
        };

        test('back face center vertex (-1,0,0) should be at screen center', () => {
            const view = builder.buildViewMatrix(camera);
            view[12] = 0; view[13] = 0; view[14] = 0;

            // Back face center is at (-1, 0, 0) in Quake
            const viewPos = transformPoint(view, [-1, 0, 0]);
            console.log('Back face center (-1,0,0) in view space (yaw=180):', viewPos);

            // Should be at -Z (forward in view) since we rotated to face back
            expect(viewPos[2]).toBeLessThan(0); // Should be forward (negative Z)
        });

        test('direction for back face center samples Cyan (back) face', () => {
            // The direction is still the RAW vertex position: (-1, 0, 0)
            const quakeDirection: [number, number, number] = [-1, 0, 0];

            const glDirection = quakeToGLCubemap(quakeDirection);
            console.log('Quake direction (-1,0,0) -> GL cubemap direction:', glDirection);

            // Should be (0, 0, 1) = back in GL
            expect(glDirection[0]).toBeCloseTo(0, 5);
            expect(glDirection[1]).toBeCloseTo(0, 5);
            expect(glDirection[2]).toBeCloseTo(1, 5);

            const face = getCubemapFace(glDirection);
            console.log('Samples face:', face, '=', faceColors[face.face]);

            // Should sample face 4 (+Z) = Cyan (back)
            expect(face.face).toBe(4);
            expect(face.quakeName).toBe('back (-X)');
        });
    });

    describe('Verify all 6 directions', () => {
        const directions: Array<{ name: string; quake: [number, number, number]; expectedFace: number; expectedColor: string }> = [
            { name: 'Forward (+X)', quake: [1, 0, 0], expectedFace: 5, expectedColor: 'Red' },
            { name: 'Back (-X)', quake: [-1, 0, 0], expectedFace: 4, expectedColor: 'Cyan' },
            { name: 'Left (+Y)', quake: [0, 1, 0], expectedFace: 1, expectedColor: 'Green' },
            { name: 'Right (-Y)', quake: [0, -1, 0], expectedFace: 0, expectedColor: 'Magenta' },
            { name: 'Up (+Z)', quake: [0, 0, 1], expectedFace: 2, expectedColor: 'Blue' },
            { name: 'Down (-Z)', quake: [0, 0, -1], expectedFace: 3, expectedColor: 'Yellow' },
        ];

        for (const dir of directions) {
            test(`${dir.name} -> ${dir.expectedColor}`, () => {
                const glDirection = quakeToGLCubemap(dir.quake);
                const face = getCubemapFace(glDirection);

                console.log(`${dir.name}: Quake ${JSON.stringify(dir.quake)} -> GL ${JSON.stringify(glDirection)} -> Face ${face.face} (${faceColors[face.face]})`);

                expect(face.face).toBe(dir.expectedFace);
            });
        }
    });

    describe('Screen position mapping', () => {
        test('with yaw=0, front face should cover the center of the screen', () => {
            const camera: CameraState = {
                position: [0, 0, 0],
                angles: [0, 0, 0],
                fov: 90,
                aspect: 1,
                near: 0.1,
                far: 1000
            };

            const view = builder.buildViewMatrix(camera);
            const projection = builder.buildProjectionMatrix(camera);
            view[12] = 0; view[13] = 0; view[14] = 0;

            const vp = mat4.create();
            mat4.multiply(vp, projection, view);

            // Sample vertices from the front face (+X)
            const frontFaceVertices: [number, number, number][] = [
                [1, -1, -1], // bottom-right (in Quake coords)
                [1, 1, -1],  // bottom-left
                [1, 1, 1],   // top-left
                [1, -1, 1],  // top-right
            ];

            console.log('Front face (+X) vertex clip positions:');
            for (const v of frontFaceVertices) {
                const clip = transformPoint(vp, v);
                const ndc = [clip[0]/clip[3], clip[1]/clip[3], clip[2]/clip[3]];
                console.log(`  ${JSON.stringify(v)} -> clip: ${JSON.stringify(clip.map(x => x.toFixed(3)))} -> NDC: ${JSON.stringify(ndc.map(x => x.toFixed(3)))}`);
            }

            // The front face should have NDC coordinates roughly in [-1, 1] range
            // and the center (average) should be near (0, 0)
        });
    });

    describe('Full Pipeline: Camera.lookAt → toState → buildViewMatrix', () => {
        test('Camera.lookAt([10, 0, 0]) produces yaw=0, pitch=0', () => {
            const camera = new Camera(256, 256);
            camera.setPosition(0, 0, 0);
            camera.lookAt([10, 0, 0]); // Look forward (+X)

            const state = camera.toState();
            console.log('Camera.lookAt([10, 0, 0]) angles:', state.angles);

            // In Quake: looking at +X should be yaw=0, pitch=0
            expect(state.angles[0]).toBeCloseTo(0, 3); // pitch
            expect(state.angles[1]).toBeCloseTo(0, 3); // yaw
            expect(state.angles[2]).toBeCloseTo(0, 3); // roll
        });

        test('Camera.lookAt([0, 10, 0]) produces yaw=90', () => {
            const camera = new Camera(256, 256);
            camera.setPosition(0, 0, 0);
            camera.lookAt([0, 10, 0]); // Look left (+Y)

            const state = camera.toState();
            console.log('Camera.lookAt([0, 10, 0]) angles:', state.angles);

            // In Quake: looking at +Y (left) should be yaw=90
            expect(state.angles[0]).toBeCloseTo(0, 3); // pitch
            expect(state.angles[1]).toBeCloseTo(90, 3); // yaw
            expect(state.angles[2]).toBeCloseTo(0, 3); // roll
        });

        test('Camera.lookAt([0, 0, 10]) produces pitch=-90', () => {
            const camera = new Camera(256, 256);
            camera.setPosition(0, 0, 0);
            camera.lookAt([0, 0, 10]); // Look up (+Z)

            const state = camera.toState();
            console.log('Camera.lookAt([0, 0, 10]) angles:', state.angles);

            // In Quake: looking at +Z (up) should be pitch=-90
            expect(state.angles[0]).toBeCloseTo(-90, 3); // pitch (negative = up)
            expect(state.angles[2]).toBeCloseTo(0, 3); // roll
        });

        test('Full pipeline: lookAt forward → view matrix transforms (1,0,0) to (0,0,-1)', () => {
            const camera = new Camera(256, 256);
            camera.setPosition(0, 0, 0);
            camera.lookAt([10, 0, 0]);

            const state = camera.toState();
            const view = builder.buildViewMatrix(state);

            // Remove translation
            view[12] = 0; view[13] = 0; view[14] = 0;

            const viewPos = transformPoint(view, [1, 0, 0]);
            console.log('Full pipeline: (1,0,0) in view space:', viewPos);

            // Should be at (0, 0, -1) = forward in view
            expect(viewPos[0]).toBeCloseTo(0, 3);
            expect(viewPos[1]).toBeCloseTo(0, 3);
            expect(viewPos[2]).toBeCloseTo(-1, 3);
        });

        test('Full pipeline: lookAt left → view matrix transforms (0,1,0) to (0,0,-1)', () => {
            const camera = new Camera(256, 256);
            camera.setPosition(0, 0, 0);
            camera.lookAt([0, 10, 0]); // Look left (+Y)

            const state = camera.toState();
            const view = builder.buildViewMatrix(state);

            // Remove translation
            view[12] = 0; view[13] = 0; view[14] = 0;

            // When looking left, (0, 1, 0) should now be at screen center
            const viewPos = transformPoint(view, [0, 1, 0]);
            console.log('Full pipeline (lookAt left): (0,1,0) in view space:', viewPos);

            // Should be at (0, 0, -1) = forward in view
            expect(viewPos[0]).toBeCloseTo(0, 3);
            expect(viewPos[1]).toBeCloseTo(0, 3);
            expect(viewPos[2]).toBeCloseTo(-1, 3);
        });

        test('WebGPUMatrixBuilder vs Camera viewMatrix - should match', () => {
            const camera = new Camera(256, 256);
            camera.setFov(90);
            camera.setAspectRatio(1.0);
            camera.setPosition(0, 0, 0);
            camera.lookAt([10, 0, 0]);

            const state = camera.toState();

            // Get view matrix from WebGPUMatrixBuilder (used by skybox)
            const builderView = builder.buildViewMatrix(state);
            builderView[12] = 0; builderView[13] = 0; builderView[14] = 0;

            // Get view matrix from Camera class
            const cameraView = mat4.clone(camera.viewMatrix as mat4);
            cameraView[12] = 0; cameraView[13] = 0; cameraView[14] = 0;

            console.log('WebGPUMatrixBuilder view matrix (first 12 elements):',
                Array.from(builderView).slice(0, 12).map(x => x.toFixed(4)));
            console.log('Camera view matrix (first 12 elements):',
                Array.from(cameraView).slice(0, 12).map(x => x.toFixed(4)));

            // Test forward direction transform
            const builderForward = transformPoint(builderView, [1, 0, 0]);
            const cameraForward = transformPoint(cameraView, [1, 0, 0]);

            console.log('Builder transforms (1,0,0) to:', builderForward);
            console.log('Camera transforms (1,0,0) to:', cameraForward);

            // Both should transform (1,0,0) to (0, 0, -1)
            expect(builderForward[2]).toBeCloseTo(-1, 3);
            expect(cameraForward[2]).toBeCloseTo(-1, 3);
        });

        test('Cube vertices NDC positions - verify front face covers screen center', () => {
            const camera: CameraState = {
                position: [0, 0, 0],
                angles: [0, 0, 0],
                fov: 90,
                aspect: 1,
                near: 0.1,
                far: 1000
            };

            const view = builder.buildViewMatrix(camera);
            const projection = builder.buildProjectionMatrix(camera);
            view[12] = 0; view[13] = 0; view[14] = 0;

            const vp = mat4.create();
            mat4.multiply(vp, projection, view);

            // Front face vertices (x=1) - these should cover the screen center
            const frontVertices: [number, number, number][] = [
                [1, -1, -1],  // bottom-right
                [1, 1, -1],   // bottom-left
                [1, 1, 1],    // top-left
                [1, -1, 1],   // top-right
            ];

            // Left face vertices (y=1) - these should be at the left edge only
            const leftVertices: [number, number, number][] = [
                [1, 1, -1],   // front-left-bottom (shared with front face)
                [1, 1, 1],    // front-left-top (shared with front face)
                [-1, 1, 1],   // back-left-top
                [-1, 1, -1],  // back-left-bottom
            ];

            console.log('Front face (+X) vertices in NDC:');
            for (const v of frontVertices) {
                const clip = transformPoint(vp, v);
                const ndc = [clip[0]/clip[3], clip[1]/clip[3]];
                console.log(`  ${JSON.stringify(v)} -> NDC: (${ndc[0].toFixed(3)}, ${ndc[1].toFixed(3)})`);
            }

            console.log('Left face (+Y) vertices in NDC:');
            for (const v of leftVertices) {
                const clip = transformPoint(vp, v);
                const ndc = [clip[0]/clip[3], clip[1]/clip[3]];
                const behind = clip[2] > 0 ? ' [BEHIND CAMERA]' : '';
                console.log(`  ${JSON.stringify(v)} -> NDC: (${ndc[0].toFixed(3)}, ${ndc[1].toFixed(3)})${behind}`);
            }

            // The front face should form a square covering NDC (-1,-1) to (1,1)
            // because with 90° FOV, the front face edges are at exactly ±45° from center
            const frontClips = frontVertices.map(v => {
                const clip = transformPoint(vp, v);
                return [clip[0]/clip[3], clip[1]/clip[3]];
            });

            // All front face vertices should be at the screen edges (NDC ±1)
            for (const [ndcX, ndcY] of frontClips) {
                expect(Math.abs(ndcX)).toBeCloseTo(1, 1);
                expect(Math.abs(ndcY)).toBeCloseTo(1, 1);
            }

            // The front face CENTER (interpolated) should be at NDC (0, 0)
            // Front face center in world: (1, 0, 0)
            const centerClip = transformPoint(vp, [1, 0, 0]);
            const centerNDC = [centerClip[0]/centerClip[3], centerClip[1]/centerClip[3]];
            console.log('Front face CENTER (1,0,0) -> NDC:', centerNDC);

            expect(centerNDC[0]).toBeCloseTo(0, 3);
            expect(centerNDC[1]).toBeCloseTo(0, 3);
        });

        test('Debug: Verify projection matrix and FOV calculations', () => {
            const camera: CameraState = {
                position: [0, 0, 0],
                angles: [0, 0, 0],
                fov: 90,
                aspect: 1,
                near: 0.1,
                far: 1000
            };

            const projection = builder.buildProjectionMatrix(camera);
            const view = builder.buildViewMatrix(camera);

            console.log('Projection matrix diagonal elements:');
            console.log(`  proj[0] (X scale) = ${projection[0].toFixed(4)}`);
            console.log(`  proj[5] (Y scale) = ${projection[5].toFixed(4)}`);
            console.log(`  proj[10] (Z scale) = ${projection[10].toFixed(4)}`);
            console.log(`  proj[11] (W from Z) = ${projection[11].toFixed(4)}`);

            // For 90° FOV, f = 1/tan(45°) = 1.0
            const expectedF = 1.0 / Math.tan(45 * Math.PI / 180);
            console.log(`Expected f for 90° FOV: ${expectedF.toFixed(4)}`);

            expect(projection[0]).toBeCloseTo(expectedF, 3);
            expect(projection[5]).toBeCloseTo(expectedF, 3);

            // Test view transform of a specific point
            const viewPt = transformPoint(view, [1, -1, -1]);
            console.log('View transform of (1,-1,-1):', viewPt.map(x => x.toFixed(4)));

            // After view transform with yaw=0:
            // Quake (1,-1,-1) should become view (1, -1, -1)
            // Because: X=1 → Z=-1, Y=-1 → X=+1, Z=-1 → Y=-1
            expect(viewPt[0]).toBeCloseTo(1, 3);  // X
            expect(viewPt[1]).toBeCloseTo(-1, 3); // Y
            expect(viewPt[2]).toBeCloseTo(-1, 3); // Z

            // Now test full VP transform
            const vp = mat4.create();
            mat4.multiply(vp, projection, view);
            const clipPt = transformPoint(vp, [1, -1, -1]);
            console.log('VP transform of (1,-1,-1) clip:', clipPt.map(x => x.toFixed(4)));

            // Expected clip: (f*1, f*(-1), something, -(-1)) = (1, -1, ?, 1)
            // NDC: (1, -1)
            const ndcPt = [clipPt[0]/clipPt[3], clipPt[1]/clipPt[3]];
            console.log('NDC:', ndcPt.map(x => x.toFixed(4)));

            // Check that the projection is working correctly
            // View Z = -1 should give clip W = 1 (since proj[11] = -1)
            expect(clipPt[3]).toBeCloseTo(1, 3);

            // With W=1, NDC should equal clip XY directly
            // Which should be (f*viewX, f*viewY) = (1*1, 1*(-1)) = (1, -1)
            expect(ndcPt[0]).toBeCloseTo(1, 2);
            expect(ndcPt[1]).toBeCloseTo(-1, 2);
        });
    });
});
