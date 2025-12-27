import { describe, it, expect, beforeAll } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';
import { DLight } from '../../../src/render/dlight.js';
import { mat4 } from 'gl-matrix';
import { BspMap, BspNode, BspPlane, BspLeaf } from '../../../src/assets/bsp.js';
import { initHeadlessWebGPU, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import { Texture2D } from '../../../src/render/webgpu/resources.js';
import path from 'path';

// Helper to create test geometry
function createTestBspGeometry(options: { min: [number, number, number], max: [number, number, number], texture: string }) {
    // Basic quad or box
    // Just minimal data to satisfy BspSurfaceGeometry
    const width = options.max[0] - options.min[0];
    const height = options.max[1] - options.min[1];

    // Create a quad facing Z+ (like a floor) or Y+ (like a wall)
    // For wall test (X=200), we want YZ plane facing -X?
    // Let's make it simpler. We just create 2 triangles.

    // Vertices: X Y Z U V LmU LmV
    // We need 8 floats per vertex for interleaved format
    const vertices = new Float32Array([
        // Triangle 1
        options.min[0], options.min[1], options.min[2], 0, 0, 0, 0, 0,
        options.max[0], options.min[1], options.min[2], 1, 0, 0, 0, 0,
        options.min[0], options.max[1], options.max[2], 0, 1, 0, 0, 0,
        // Triangle 2
        options.max[0], options.min[1], options.min[2], 1, 0, 0, 0, 0,
        options.max[0], options.max[1], options.max[2], 1, 1, 0, 0, 0,
        options.min[0], options.max[1], options.max[2], 0, 1, 0, 0, 0,
    ]);

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
const updateBaseline = process.env.UPDATE_VISUAL === '1';

describe('WebGPU Lighting', () => {
    let renderer: Awaited<ReturnType<typeof createWebGPURenderer>>;
    let camera: Camera;

    beforeAll(async () => {
        await initHeadlessWebGPU();
        renderer = await createWebGPURenderer(undefined, {
            width: 256,
            height: 256,
            headless: true
        });
        camera = new Camera(800, 600);
        camera.setPosition(0, -200, 50);
        camera.setRotation(0, 90, 0); // Look forward (+X)
    });

    // Helper to create a minimal valid BSP map structure
    const createMinimalMap = (facesCount: number = 1): BspMap => {
        const plane: BspPlane = { normal: [1, 0, 0], dist: 0, type: 0 };
        const node: BspNode = {
            planeIndex: 0,
            children: [-1, -1], // Leaf 0 on both sides
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
            numLeafFaces: facesCount, // Should cover all faces
            firstLeafBrush: 0,
            numLeafBrushes: 0
        };

        // Create dummy faces to match the surface count
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
            leafFaces.push([i]); // Each leafFace list entry
        }

        // We need leafLists structure
        const leafLists = {
            leafFaces: [Array.from({length: facesCount}, (_, i) => i)], // Leaf 0 has all faces
            leafBrushes: [[]]
        };

        return {
            header: { version: 38, lumps: new Map() },
            planes: [plane],
            nodes: [node],
            leafs: [leaf], // Leaf 0
            surfaces: [], // Not used directly by traversal, uses 'faces'
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

            // Methods
            pickEntity: () => null,
            findLeaf: () => leaf,
            calculatePVS: () => new Uint8Array([255]),
            getUniqueClassnames: () => []
        } as unknown as BspMap; // Cast because some fields might be partial or mocks
    };

    it('lighting-point.png', async () => {
        const wall = createTestBspGeometry({
            min: [200, -100, 0],
            max: [200, 100, 200],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);

        const map = createMinimalMap(1);

        const dlights: DLight[] = [{
            origin: { x: 180, y: 0, z: 100 },
            color: { x: 1, y: 0, z: 0 },
            intensity: 150,
            die: 0
        }];

        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights,
            disableLightmaps: true, // Only dynamic lights
            fullbright: false,
            ambient: 0.1, // Low ambient to contrast light
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
            updateBaseline,
            snapshotDir
        });
    });

    it('lighting-multiple.png', async () => {
        const wall = createTestBspGeometry({
            min: [200, -100, 0],
            max: [200, 100, 200],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);

        const map = createMinimalMap(1);

        const dlights: DLight[] = [
            {
                origin: { x: 180, y: -50, z: 100 },
                color: { x: 1, y: 0, z: 0 },
                intensity: 100,
                die: 0
            },
            {
                origin: { x: 180, y: 50, z: 100 },
                color: { x: 0, y: 0, z: 1 },
                intensity: 100,
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
            updateBaseline,
            snapshotDir
        });
    });

    it('lighting-colored.png', async () => {
        const floor = createTestBspGeometry({
            min: [-100, -100, 0],
            max: [100, 100, 0],
            texture: 'floor'
        });
        renderer.uploadBspGeometry([floor]);

        const map = createMinimalMap(1);

        const cam = new Camera(800, 600);
        cam.setPosition(0, 0, 200);
        cam.setRotation(90, 0, 0); // Look down

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
            updateBaseline,
            snapshotDir
        });
    });
});
