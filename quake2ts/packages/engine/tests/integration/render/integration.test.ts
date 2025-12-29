import { createRenderer, Renderer } from '@quake2ts/engine';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mat4, vec3 } from 'gl-matrix';
import { Camera } from '@quake2ts/engine';
import { BspMap } from '@quake2ts/engine';

// Import helpers
import { createMockWebGL2Context } from '@quake2ts/test-utils';
import { buildTestBsp, BspFixtureOptions } from '../../helpers/bspBuilder.js';
import { parseBsp } from '@quake2ts/engine';

describe('Renderer Integration', () => {
    let mockGl: ReturnType<typeof createMockWebGL2Context>;
    let renderer: Renderer;

    beforeEach(() => {
        mockGl = createMockWebGL2Context();
        renderer = createRenderer(mockGl as unknown as WebGL2RenderingContext);
    });

    it('initializes all pipelines and resources', () => {
        expect(renderer).toBeDefined();
        expect(mockGl.createProgram).toHaveBeenCalled();
    });

    it('registers textures correctly', async () => {
        const textureData = new ArrayBuffer(100);

        // Mock createImageBitmap
        global.createImageBitmap = vi.fn().mockResolvedValue({
            width: 64,
            height: 64,
            close: vi.fn()
        } as unknown as ImageBitmap);

        const pic = await renderer.registerPic('test.pcx', textureData);
        expect(pic).toBeDefined();
        expect(mockGl.createTexture).toHaveBeenCalled();
        expect(mockGl.texImage2D).toHaveBeenCalled();
    });

    it('performs a full frame render with a BSP model', () => {
        // Create a minimal valid BSP
        const bspData = buildTestBsp({
            entities: '{"classname" "worldspawn"}\n',
            planes: [{ normal: [0, 0, 1], dist: 0, type: 0 }],
            vertices: [],
            nodes: [{
                planeIndex: 0,
                children: [-1, -1], // Leaf indices (negated - 1)
                mins: [0, 0, 0],
                maxs: [0, 0, 0],
                firstFace: 0,
                numFaces: 0
            }],
            leafs: [{
                contents: 0,
                cluster: -1,
                area: 0,
                mins: [0, 0, 0],
                maxs: [0, 0, 0],
                firstLeafFace: 0,
                numLeafFaces: 0,
                firstLeafBrush: 0,
                numLeafBrushes: 0
            }],
            models: [{
                mins: [0, 0, 0],
                maxs: [0, 0, 0],
                origin: [0, 0, 0],
                headNode: 0,
                firstFace: 0,
                numFaces: 0
            }]
        });

        const map = parseBsp(bspData);
        const camera = new Camera();
        camera.setFov(90);
        camera.setAspectRatio(800/600);

        // Update matrices is automatic in Camera

        const world = {
            map,
            surfaces: [],
            textures: new Map(),
            materials: { update: vi.fn(), getMaterial: vi.fn() },
            lightStyles: []
        };

        const options = {
            camera,
            world: world as any,
            timeSeconds: 1.0,
            deltaTime: 0.016
        };

        renderer.renderFrame(options, []);

        // Verify basic GL flow
        expect(mockGl.clear).toHaveBeenCalled();
        expect(mockGl.enable).toHaveBeenCalledWith(mockGl.DEPTH_TEST);

        // Verify stats
        const stats = renderer.getPerformanceReport();
        expect(stats).toBeDefined();
    });

    it('handles camera movement updating view matrix', () => {
        const camera = new Camera();
        camera.setPosition(100, 50, 20);
        camera.setRotation(0, 45, 0); // Yaw 45

        // Create minimal valid BSP
        const bspData = buildTestBsp({
            entities: '{"classname" "worldspawn"}\n',
            planes: [{ normal: [0, 0, 1], dist: 0, type: 0 }],
            vertices: [],
            nodes: [{
                planeIndex: 0,
                children: [-1, -1],
                mins: [0, 0, 0],
                maxs: [0, 0, 0],
                firstFace: 0,
                numFaces: 0
            }],
            leafs: [{
                contents: 0,
                cluster: -1,
                area: 0,
                mins: [0, 0, 0],
                maxs: [0, 0, 0],
                firstLeafFace: 0,
                numLeafFaces: 0,
                firstLeafBrush: 0,
                numLeafBrushes: 0
            }],
            models: [{
                mins: [0, 0, 0],
                maxs: [0, 0, 0],
                origin: [0, 0, 0],
                headNode: 0,
                firstFace: 0,
                numFaces: 0
            }]
        });
        const map = parseBsp(bspData);

        const world = {
            map,
            surfaces: [],
            textures: new Map(),
            materials: { update: vi.fn(), getMaterial: vi.fn() }
        };

        const options = {
            camera,
            world: world as any,
            timeSeconds: 2.0,
            sky: {}
        };

        renderer.renderFrame(options, []);

        // Assert that uniformMatrix4fv was called (which implies view/proj matrix upload)
        // The mock calls are strings "uniformMatrix4fv:set:false:..."
        const matrixCalls = mockGl.calls.filter(c => c.startsWith('uniformMatrix4fv'));
        expect(matrixCalls.length).toBeGreaterThan(0);
    });
});
