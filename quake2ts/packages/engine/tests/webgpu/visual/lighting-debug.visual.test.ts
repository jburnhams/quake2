import { describe, it, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';
import { DLight } from '../../../src/render/dlight.js';
import { BspMap, BspNode, BspPlane, BspLeaf } from '../../../src/assets/bsp.js';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

// Helper to create test geometry
function createTestBspGeometry(options: { min: [number, number, number], max: [number, number, number], texture: string }) {
    const min = options.min;
    const max = options.max;
    const dx = max[0] - min[0];
    const dy = max[1] - min[1];
    const dz = max[2] - min[2];

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
    } else if (dy < 0.001) {
        vertices = new Float32Array([
            min[0], min[1], min[2], 0, 1, 0, 0, 0,
            min[0], max[1], max[2], 0, 0, 0, 0, 0,
            max[0], min[1], min[2], 1, 1, 0, 0, 0,
            min[0], max[1], max[2], 0, 0, 0, 0, 0,
            max[0], max[1], max[2], 1, 0, 0, 0, 0,
            max[0], min[1], min[2], 1, 1, 0, 0, 0,
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
const updateBaseline = process.env.UPDATE_VISUAL === '1';

describe('WebGPU Lighting Debug - Original Coordinates', () => {
    const lifecycle = createWebGPULifecycle();
    let renderer: Awaited<ReturnType<typeof createWebGPURenderer>>;
    let camera: Camera;

    const createMinimalMap = (facesCount: number = 1): BspMap => {
        const plane: BspPlane = { normal: [1, 0, 0], dist: 0, type: 0 };
        const node: BspNode = {
            planeIndex: 0,
            children: [-1, -1],
            mins: [-1000, -1000, -1000],
            maxs: [1000, 1000, 1000],
            firstFace: 0,
            numFaces: 0
        };
        const leaf: BspLeaf = {
            contents: 0,
            cluster: 0,
            area: 0,
            mins: [-1000, -1000, -1000],
            maxs: [1000, 1000, 1000],
            firstLeafFace: 0,
            numLeafFaces: facesCount,
            firstLeafBrush: 0,
            numLeafBrushes: 0
        };

        const faces = [];
        const leafFaces = [];
        for(let i=0; i<facesCount; i++) {
            faces.push({
                planeIndex: 0,
                side: 0,
                firstEdge: 0,
                numEdges: 0,
                texInfo: 0,
                styles: [0, 255, 255, 255] as [number, number, number, number],
                lightOffset: -1
            });
            leafFaces.push([i]);
        }

        const leafLists = {
            leafFaces: [Array.from({length: facesCount}, (_, i) => i)],
            leafBrushes: [[]]
        };

        return {
            header: { version: 38, lumps: new Map() },
            planes: [plane],
            nodes: [node],
            leafs: [leaf],
            surfaces: [],
            faces: faces,
            leafLists: leafLists,
            visibility: { numClusters: 1, clusters: [{ pvs: new Uint8Array([255]), phs: new Uint8Array([255]) }] },
            entities: { raw: '', entities: [], worldspawn: undefined, getUniqueClassnames: () => [] },
            markSurfaces: [],
            edges: [],
            surfedges: new Int32Array(),
            models: [{ mins: [0,0,0], maxs: [0,0,0], origin: [0,0,0], headNode: 0, firstFace: 0, numFaces: 0 }],
            areas: [],
            areaPortals: [],
            lightmaps: new Uint8Array(),
            lightMapInfo: [],
            vertices: [],
            texInfo: [],
            brushes: [],
            brushSides: [],
            pickEntity: () => null,
            findLeaf: () => leaf,
            calculatePVS: () => new Uint8Array([255]),
            getUniqueClassnames: () => []
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

    it('lighting-debug-original-coords.png', async () => {
        // Wall at X=200, Y∈[-200,200], Z∈[-100,300]
        // Center of wall is at (200, 0, 100)
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);

        const map = createMinimalMap(1);

        // Use ORIGINAL light position (no workaround!)
        // Light at (180, 0, 100) - 20 units in front of wall center
        // This SHOULD illuminate the center of the wall
        const dlights: DLight[] = [{
            origin: { x: 180, y: 0, z: 100 },  // Original position, no offset!
            color: { x: 1, y: 0, z: 0 },
            intensity: 150,
            die: 0
        }];

        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights,
            disableLightmaps: true,
            fullbright: false,
            ambient: 0.1,
            timeSeconds: 0
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(
            renderer.device,
            frameRenderer.headlessTarget,
            256,
            256
        );

        // Save this to see where the light ACTUALLY appears
        await expectSnapshot(pixels, {
            name: 'lighting-debug-original-coords',
            description: 'Light at ORIGINAL position (180, 0, 100) - should be centered but may not be',
            width: 256,
            height: 256,
            updateBaseline: true,  // Always update so we can see what happens
            snapshotDir
        });
    });

    it('lighting-debug-at-min-corner.png', async () => {
        // Test: put light at the min corner's Y,Z to see where it illuminates
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);
        const map = createMinimalMap(1);

        // Light at min.y, min.z position (should illuminate bottom-right if coords are correct)
        const dlights: DLight[] = [{
            origin: { x: 180, y: -200, z: -100 },  // At min corner Y,Z
            color: { x: 0, y: 1, z: 0 },  // Green to distinguish
            intensity: 150,
            die: 0
        }];

        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights,
            disableLightmaps: true,
            fullbright: false,
            ambient: 0.1,
            timeSeconds: 0
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

        await expectSnapshot(pixels, {
            name: 'lighting-debug-at-min-corner',
            description: 'Light at min corner (180, -200, -100) - where does it illuminate?',
            width: 256,
            height: 256,
            updateBaseline: true,
            snapshotDir
        });
    });

    it('lighting-debug-correct-workaround.png', async () => {
        // Test the CORRECT workaround formula: position - mins
        // Original: (180, 0, 100)
        // mins: (200, -200, -100)
        // Adjusted: (180-200, 0-(-200), 100-(-100)) = (-20, 200, 200)
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);
        const map = createMinimalMap(1);

        // Using the CORRECT formula: position - mins
        const dlights: DLight[] = [{
            origin: { x: -20, y: 200, z: 200 },  // Correct formula result
            color: { x: 0, y: 0, z: 1 },  // Blue to distinguish
            intensity: 150,
            die: 0
        }];

        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights,
            disableLightmaps: true,
            fullbright: false,
            ambient: 0.1,
            timeSeconds: 0
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

        await expectSnapshot(pixels, {
            name: 'lighting-debug-correct-workaround',
            description: 'Light with correct workaround (-20, 200, 200) - should be centered',
            width: 256,
            height: 256,
            updateBaseline: true,
            snapshotDir
        });
    });
});
