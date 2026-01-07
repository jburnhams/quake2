import { describe, it, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';
import { DLight } from '../../../src/render/dlight.js';
import { mat4 } from 'gl-matrix';
import { BspMap, BspNode, BspPlane, BspLeaf } from '../../../src/assets/bsp.js';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import { Texture2D } from '../../../src/render/webgpu/resources.js';
import path from 'path';

// Helper to create test geometry
function createTestBspGeometry(options: { min: [number, number, number], max: [number, number, number], texture: string }) {
    const min = options.min;
    const max = options.max;

    // Detect flat axis
    const dx = max[0] - min[0];
    const dy = max[1] - min[1];
    const dz = max[2] - min[2];

    let vertices: Float32Array;

    // We need 8 floats per vertex: x, y, z, u, v, lm_u, lm_v, lm_step

    if (dx < 0.001) {
        // Flat in X (YZ plane) - e.g. Wall
        // Normal is +X or -X. Let's assume facing -X (visible from X < wall)
        vertices = new Float32Array([
            // Triangle 1
            min[0], min[1], min[2], 0, 1, 0, 0, 0, // Bottom-Left
            max[0], min[1], max[2], 0, 0, 0, 0, 0, // Top-Left
            min[0], max[1], min[2], 1, 1, 0, 0, 0, // Bottom-Right
            // Triangle 2
            max[0], min[1], max[2], 0, 0, 0, 0, 0, // Top-Left
            max[0], max[1], max[2], 1, 0, 0, 0, 0, // Top-Right
            min[0], max[1], min[2], 1, 1, 0, 0, 0, // Bottom-Right
        ]);
    } else if (dy < 0.001) {
        // Flat in Y (XZ plane)
        vertices = new Float32Array([
            min[0], min[1], min[2], 0, 1, 0, 0, 0,
            min[0], max[1], max[2], 0, 0, 0, 0, 0,
            max[0], min[1], min[2], 1, 1, 0, 0, 0,

            min[0], max[1], max[2], 0, 0, 0, 0, 0,
            max[0], max[1], max[2], 1, 0, 0, 0, 0,
            max[0], min[1], min[2], 1, 1, 0, 0, 0,
        ]);
    } else {
        // Flat in Z (XY plane) - e.g. Floor
        vertices = new Float32Array([
            min[0], min[1], min[2], 0, 0, 0, 0, 0,
            max[0], min[1], min[2], 1, 0, 0, 0, 0,
            min[0], max[1], max[2], 0, 1, 0, 0, 0,

            max[0], min[1], min[2], 1, 0, 0, 0, 0,
            max[0], max[1], max[2], 1, 1, 0, 0, 0,
            min[0], max[1], max[2], 0, 1, 0, 0, 0,
        ]);
    }

    // Indices: 0 1 2, 3 4 5
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
        texInfo: {
            texture: options.texture,
            flags: 0,
            value: 0,
            nextTexInfo: -1
        },
        lightmap: undefined
    };
}

const snapshotDir = path.join(__dirname, '__snapshots__');

describe('WebGPU Lighting', () => {
    const lifecycle = createWebGPULifecycle();
    let renderer: Awaited<ReturnType<typeof createWebGPURenderer>>;
    let camera: Camera;

    beforeAll(async () => {
        await setupHeadlessWebGPUEnv();
        renderer = await createWebGPURenderer(undefined, {
            width: 256,
            height: 256,
            headless: true
        });
        lifecycle.trackRenderer(renderer);
        camera = new Camera(256, 256);
        camera.setPosition(0, 0, 100);
        camera.setRotation(0, 0, 0);
    });

    afterAll(lifecycle.cleanup);

    // Helper to create a minimal valid BSP map structure
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

    it('lighting-point.png', async () => {
        // Wall at X=200. Larger size 400x400 to ensure full screen coverage.
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);

        const map = createMinimalMap(1);

        // Red light near the wall center
        // Wall center is at approximately (200, 0, 100)
        // Light is 20 units in front of wall (x=180)
        // Use high intensity to illuminate the wall visibly
        const dlights: DLight[] = [{
            origin: { x: 180, y: 0, z: 100 },
            color: { x: 1, y: 0, z: 0 },
            intensity: 400,
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

        await expectSnapshot(pixels, {
            name: 'lighting-point',
            description: 'Red point light illuminating a wall',
            width: 256,
            height: 256,
            snapshotDir
        });
    });

    it('lighting-multiple.png', async () => {
        // Same wall
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);

        const map = createMinimalMap(1);

        // Two lights: Red on left side (-Y), Blue on right side (+Y)
        // Wall spans Y from -200 to 200, Z from -100 to 300
        // Center of wall is at (200, 0, 100)
        // Use high intensity to illuminate the wall visibly
        const dlights: DLight[] = [
            {
                origin: { x: 180, y: -80, z: 100 },
                color: { x: 1, y: 0, z: 0 },
                intensity: 300,
                die: 0
            },
            {
                origin: { x: 180, y: 80, z: 100 },
                color: { x: 0, y: 0, z: 1 },
                intensity: 300,
                die: 0
            }
        ];

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

        await expectSnapshot(pixels, {
            name: 'lighting-multiple',
            description: 'Red and Blue lights illuminating a wall',
            width: 256,
            height: 256,
            snapshotDir
        });
    });

    it('lighting-colored.png', async () => {
        // Floor at Z=0. Larger size 400x400
        const floor = createTestBspGeometry({
            min: [-200, -200, 0],
            max: [200, 200, 0],
            texture: 'floor'
        });
        renderer.uploadBspGeometry([floor]);

        const map = createMinimalMap(1);

        const cam = new Camera(256, 256);
        cam.setPosition(0, 0, 200);
        cam.setRotation(90, 0, 0);

        // Green light at floor center, 50 units above
        // Floor spans X from -200 to 200, Y from -200 to 200, Z=0
        // Center of floor is at (0, 0, 0)
        const dlights: DLight[] = [{
            origin: { x: 0, y: 0, z: 50 },
            color: { x: 0, y: 1, z: 0 },
            intensity: 150,
            die: 0
        }];

        renderer.renderFrame({
            camera: cam,
            world: { map, surfaces: [floor] },
            dlights,
            disableLightmaps: true,
            fullbright: false,
            ambient: 0.0,
            timeSeconds: 0
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(
            renderer.device,
            frameRenderer.headlessTarget,
            256,
            256
        );

        await expectSnapshot(pixels, {
            name: 'lighting-colored',
            description: 'Green light illuminating a floor',
            width: 256,
            height: 256,
            snapshotDir
        });
    });
});
