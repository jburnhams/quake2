import { describe, it, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';
import { BspMap, BspNode, BspPlane, BspLeaf } from '../../../src/assets/bsp.js';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

/**
 * Test with geometry that has mins at (0,0,0) to isolate the bug.
 * If worldPos = position - mins, and mins = (0,0,0), then worldPos = position (correct!)
 * This would indicate the bug is in how mins is applied, not a fundamental shader issue.
 */

function createZeroMinsGeometry(options: { min: [number, number, number], max: [number, number, number], texture: string }) {
    const min = options.min;
    const max = options.max;

    // Flat in X (YZ plane) - Wall at X=200
    // Vertices positioned so that min is at origin (0,0,0)
    const vertices = new Float32Array([
        min[0], min[1], min[2], 0, 1, 0, 0, 0,
        max[0], min[1], max[2], 0, 0, 0, 0, 0,
        min[0], max[1], min[2], 1, 1, 0, 0, 0,
        max[0], min[1], max[2], 0, 0, 0, 0, 0,
        max[0], max[1], max[2], 1, 0, 0, 0, 0,
        min[0], max[1], min[2], 1, 1, 0, 0, 0,
    ]);

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

describe('WorldPos Zero Mins Test', () => {
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
    });

    afterAll(lifecycle.cleanup);

    it('zero-mins-centered-light.png', async () => {
        // Wall at X=200, but with mins at (200, 0, 0) not (200, -200, -100)
        // Center of wall: (200, 100, 100)
        // If mins = (200, 0, 0), then buggy center worldPos = (0, 100, 100)
        // This is different from when mins = (200, -200, -100)
        const wall = createZeroMinsGeometry({
            min: [200, 0, 0],      // mins at Y=0, Z=0
            max: [200, 200, 200],  // wall from (200,0,0) to (200,200,200)
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);
        const map = createMinimalMap(1);

        // Position camera to see the wall
        camera.setPosition(0, 100, 100);  // Camera at center height
        camera.setRotation(0, 0, 0);       // Looking +X

        // Light at center: (180, 100, 100) - 20 units in front of wall center
        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights: [{
                origin: { x: 180, y: 100, z: 100 },  // Should be at center
                color: { x: 1, y: 0, z: 0 },
                intensity: 400,  // Higher intensity for clear visibility
                die: 0
            }],
            disableLightmaps: true,
            fullbright: false,
            ambient: 0.1,
            timeSeconds: 0
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

        // If worldPos = position - mins:
        // - Center (200, 100, 100): buggy = (0, 100, 100)
        // - Corner (200, 0, 0): buggy = (0, 0, 0)
        // - Light at (180, 100, 100)
        // - Distance to buggy center = sqrt(180² + 0 + 0) = 180 > 150, outside range!
        // - Distance to buggy corner = sqrt(180² + 100² + 100²) = 224 > 150, also outside
        // So we might see NO light at all with the bug!

        // If worldPos = position (correct):
        // - Center (200, 100, 100)
        // - Light at (180, 100, 100)
        // - Distance = 20 < 150, should illuminate center!

        await expectSnapshot(pixels, {
            name: 'zero-mins-centered-light',
            description: 'Wall with Y/Z starting at 0. If bug exists, light should be off-center or dim.',
            width: 256, height: 256,
            updateBaseline: true,
            snapshotDir
        });
    });

    it('zero-mins-light-at-origin.png', async () => {
        // Same wall, but put light at origin
        const wall = createZeroMinsGeometry({
            min: [200, 0, 0],
            max: [200, 200, 200],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);
        const map = createMinimalMap(1);

        camera.setPosition(0, 100, 100);
        camera.setRotation(0, 0, 0);

        // Light at origin (0, 0, 0) - wall is 200+ units away
        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights: [{
                origin: { x: 0, y: 0, z: 0 },
                color: { x: 0, y: 1, z: 0 },  // Green
                intensity: 500,  // Higher intensity to reach distant wall
                die: 0
            }],
            disableLightmaps: true,
            fullbright: false,
            ambient: 0.05,
            timeSeconds: 0
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

        // If worldPos = position - mins with mins = (200, 0, 0):
        // - Corner (200, 0, 0): buggy = (0, 0, 0) = at the light! Very bright!
        // - Should see bright green at that corner

        // If worldPos = position (correct):
        // - All points are 200+ units away (X=200 minimum)
        // - Wall should be mostly dark with slight illumination

        await expectSnapshot(pixels, {
            name: 'zero-mins-light-at-origin',
            description: 'Light at origin with wall starting at Y=0,Z=0. Bottom-left corner = mins.',
            width: 256, height: 256,
            updateBaseline: true,
            snapshotDir
        });
    });
});
