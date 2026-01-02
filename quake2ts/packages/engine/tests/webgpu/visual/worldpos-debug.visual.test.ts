import { describe, it, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';
import { BspMap, BspNode, BspPlane, BspLeaf } from '../../../src/assets/bsp.js';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

/**
 * This test creates a modified render that outputs worldPos as color.
 * By examining the output image, we can determine what worldPos values
 * the fragment shader is actually receiving.
 *
 * Expected output (if worldPos is correct):
 * - Center of wall (200, 0, 100) → RGB roughly (200/256, 0, 100/256) = (0.78, 0, 0.39) = magenta-ish
 * - Bottom-right (200, 200, -100) → abs values for display
 *
 * If worldPos = position - mins (buggy):
 * - Center (0, 200, 200) → RGB (0, 0.78, 0.78) = cyan
 * - Bottom-right (0, 0, 0) → RGB (0, 0, 0) = black
 */

function createTestBspGeometry(options: { min: [number, number, number], max: [number, number, number], texture: string }) {
    const min = options.min;
    const max = options.max;
    const dx = max[0] - min[0];

    let vertices: Float32Array;

    if (dx < 0.001) {
        // Flat in X (YZ plane) - Wall
        vertices = new Float32Array([
            min[0], min[1], min[2], 0, 1, 0, 0, 0,
            max[0], min[1], max[2], 0, 0, 0, 0, 0,
            min[0], max[1], min[2], 1, 1, 0, 0, 0,
            max[0], min[1], max[2], 0, 0, 0, 0, 0,
            max[0], max[1], max[2], 1, 0, 0, 0, 0,
            min[0], max[1], min[2], 1, 1, 0, 0, 0,
        ]);
    } else {
        // Flat in Z (XY plane) - Floor
        vertices = new Float32Array([
            min[0], min[1], min[2], 0, 0, 0, 0, 0,
            max[0], min[1], min[2], 1, 0, 0, 0, 0,
            min[0], max[1], max[2], 0, 1, 0, 0, 0,
            max[0], min[1], min[2], 1, 0, 0, 0, 0,
            max[0], max[1], max[2], 1, 1, 0, 0, 0,
            min[0], max[1], max[2], 0, 1, 0, 0, 0,
        ]);
    }

    const indices = new Uint16Array([0, 1, 2, 3, 4, 5]);

    return {
        texture: options.texture,
        vertexData: vertices,
        indexData: indices,
        vertexCount: 6,
        indexCount: 6,
        surfaceFlags: 0,
        mins: { x: options.min[0], y: options.min[1], z: options.min[2] },
        maxs: { x: options.max[0], y: options.max[1], z: options.max[2] },
        texInfo: { texture: options.texture, flags: 0, value: 0, nextTexInfo: -1 },
        lightmap: undefined
    };
}

const snapshotDir = path.join(__dirname, '__snapshots__');

describe('WorldPos Debug Visualization', () => {
    const lifecycle = createWebGPULifecycle();
    let renderer: Awaited<ReturnType<typeof createWebGPURenderer>>;
    let camera: Camera;

    const createMinimalMap = (facesCount: number = 1): BspMap => {
        const plane: BspPlane = { normal: [1, 0, 0], dist: 0, type: 0 };
        const node: BspNode = {
            planeIndex: 0, children: [-1, -1],
            mins: [-1000, -1000, -1000], maxs: [1000, 1000, 1000],
            firstFace: 0, numFaces: 0
        };
        const leaf: BspLeaf = {
            contents: 0, cluster: 0, area: 0,
            mins: [-1000, -1000, -1000], maxs: [1000, 1000, 1000],
            firstLeafFace: 0, numLeafFaces: facesCount,
            firstLeafBrush: 0, numLeafBrushes: 0
        };
        const faces = Array.from({length: facesCount}, () => ({
            planeIndex: 0, side: 0, firstEdge: 0, numEdges: 0, texInfo: 0,
            styles: [0, 255, 255, 255] as [number, number, number, number],
            lightOffset: -1
        }));
        const leafLists = {
            leafFaces: [Array.from({length: facesCount}, (_, i) => i)],
            leafBrushes: [[]]
        };
        return {
            header: { version: 38, lumps: new Map() },
            planes: [plane], nodes: [node], leafs: [leaf], surfaces: [],
            faces, leafLists,
            visibility: { numClusters: 1, clusters: [{ pvs: new Uint8Array([255]), phs: new Uint8Array([255]) }] },
            entities: { raw: '', entities: [], worldspawn: undefined, getUniqueClassnames: () => [] },
            markSurfaces: [], edges: [], surfedges: new Int32Array(),
            models: [{ mins: [0,0,0], maxs: [0,0,0], origin: [0,0,0], headNode: 0, firstFace: 0, numFaces: 0 }],
            areas: [], areaPortals: [], lightmaps: new Uint8Array(), lightMapInfo: [],
            vertices: [], texInfo: [], brushes: [], brushSides: [],
            pickEntity: () => null, findLeaf: () => leaf,
            calculatePVS: () => new Uint8Array([255]), getUniqueClassnames: () => []
        } as unknown as BspMap;
    };

    beforeAll(async () => {
        await setupHeadlessWebGPUEnv();
        renderer = await createWebGPURenderer(undefined, { width: 256, height: 256, headless: true });
        lifecycle.trackRenderer(renderer);
        camera = new Camera(256, 256);
        camera.setPosition(0, 0, 100);
        camera.setRotation(0, 0, 0);
    });

    afterAll(lifecycle.cleanup);

    it('worldpos-debug-faceted-mode.png', async () => {
        // Use faceted mode which shows surface normals - this helps visualize the geometry
        // even without dynamic lights
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);
        const map = createMinimalMap(1);

        // Render in faceted mode to visualize the geometry
        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights: [],  // No dynamic lights
            disableLightmaps: true,
            fullbright: true,  // Fullbright to see geometry clearly
            ambient: 1.0,
            timeSeconds: 0,
            renderMode: { mode: 'solid-faceted', applyToAll: true, color: [1, 1, 1, 1] }
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

        await expectSnapshot(pixels, {
            name: 'worldpos-debug-faceted-mode',
            description: 'Wall in faceted mode - verifies geometry is rendered correctly',
            width: 256, height: 256,
            updateBaseline: true,
            snapshotDir
        });
    });

    it('worldpos-debug-with-large-light.png', async () => {
        // Use a very large intensity light to see where it illuminates
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);
        const map = createMinimalMap(1);

        // Light with VERY large intensity to illuminate the whole surface
        // This helps visualize the distance falloff pattern
        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights: [{
                origin: { x: 180, y: 0, z: 100 },  // Should be at center
                color: { x: 1, y: 0, z: 0 },
                intensity: 500,  // Very large to illuminate everything
                die: 0
            }],
            disableLightmaps: true,
            fullbright: false,
            ambient: 0.05,  // Low ambient to see light pattern clearly
            timeSeconds: 0
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

        await expectSnapshot(pixels, {
            name: 'worldpos-debug-with-large-light',
            description: 'Light at center with intensity 500 - brightest area indicates closest worldPos to light',
            width: 256, height: 256,
            updateBaseline: true,
            snapshotDir
        });
    });

    it('worldpos-debug-light-at-origin.png', async () => {
        // Put light at origin (0, 0, 0) to see which part of the wall is closest
        // If worldPos is correct: center of wall (200, 0, 100) is closest to origin
        // If worldPos is buggy: bottom-right (0, 0, 0) is AT the origin!
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);
        const map = createMinimalMap(1);

        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights: [{
                origin: { x: 0, y: 0, z: 0 },  // Light at world origin
                color: { x: 0, y: 1, z: 0 },  // Green
                intensity: 300,
                die: 0
            }],
            disableLightmaps: true,
            fullbright: false,
            ambient: 0.05,
            timeSeconds: 0
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

        // If buggy: bottom-right will be VERY bright (green)
        // If correct: no part of wall should be very bright (wall is 200+ units away from origin)
        await expectSnapshot(pixels, {
            name: 'worldpos-debug-light-at-origin',
            description: 'Green light at origin (0,0,0). If buggy, bottom-right will be VERY bright.',
            width: 256, height: 256,
            updateBaseline: true,
            snapshotDir
        });
    });
});
