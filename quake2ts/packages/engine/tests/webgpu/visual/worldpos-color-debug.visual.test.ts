import { describe, it, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';
import { BspMap, BspNode, BspPlane, BspLeaf } from '../../../src/assets/bsp.js';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

/**
 * This test uses renderMode 'worldpos-debug' to output worldPos as fragment color.
 *
 * The shader outputs: RGB = fract(abs(worldPos) / 256)
 *
 * For a wall with vertices at:
 * - V0 (mins): (200, -200, -100)
 * - V4 (maxs): (200, 200, 300)
 *
 * Expected colors if worldPos is CORRECT (absolute positions):
 * - At mins corner (200, -200, -100):
 *   R = fract(200/256) = 0.78
 *   G = fract(200/256) = 0.78 (abs of -200)
 *   B = fract(100/256) = 0.39 (abs of -100)
 *   => Pinkish/magenta color
 *
 * - At maxs corner (200, 200, 300):
 *   R = fract(200/256) = 0.78
 *   G = fract(200/256) = 0.78
 *   B = fract(300/256) = fract(1.17) = 0.17
 *   => More reddish
 *
 * Expected colors if worldPos is BUGGY (position - mins):
 * - At mins corner: worldPos = (0, 0, 0)
 *   R = G = B = 0 => BLACK
 *
 * - At maxs corner: worldPos = (0, 400, 400)
 *   R = 0
 *   G = fract(400/256) = fract(1.56) = 0.56
 *   B = fract(400/256) = 0.56
 *   => Cyan-ish
 */

function createTestBspGeometry(options: { min: [number, number, number], max: [number, number, number], texture: string }) {
    const min = options.min;
    const max = options.max;

    // Flat in X (YZ plane) - Wall
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

describe('WorldPos Color Debug - Direct Visualization', () => {
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

    it('worldpos-color-output.png', async () => {
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);
        const map = createMinimalMap(1);

        // Render with worldpos-debug mode
        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights: [],
            disableLightmaps: true,
            fullbright: false,
            ambient: 0,
            timeSeconds: 0,
            renderMode: { mode: 'worldpos-debug', applyToAll: true }
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

        // Log some pixel values for debugging
        const getPixel = (x: number, y: number) => {
            const idx = (y * 256 + x) * 4;
            return [pixels[idx], pixels[idx+1], pixels[idx+2], pixels[idx+3]];
        };

        // Bottom-right corner of the rendered wall (mins corner on screen)
        // Due to Quake coordinate system: Y is left, so -Y appears on right
        console.log('Center pixel:', getPixel(128, 128));
        console.log('Bottom-right pixel:', getPixel(240, 240));
        console.log('Top-left pixel:', getPixel(16, 16));

        // If CORRECT: mins corner should be pinkish (R=200, G=200, B=100 roughly)
        // If BUGGY: mins corner should be BLACK (R=G=B=0)

        await expectSnapshot(pixels, {
            name: 'worldpos-color-output',
            description: 'WorldPos as color. CORRECT=pinkish at corners. BUGGY=black at bottom-right.',
            width: 256, height: 256,
            updateBaseline: true,
            snapshotDir
        });
    });

    it('worldpos-color-simple-geometry.png', async () => {
        // Simpler geometry with mins at origin to make colors easier to interpret
        const wall = createTestBspGeometry({
            min: [200, 0, 0],
            max: [200, 256, 256],
            texture: 'wall'
        });
        renderer.uploadBspGeometry([wall]);
        const map = createMinimalMap(1);

        camera.setPosition(0, 128, 128);
        camera.setRotation(0, 0, 0);

        renderer.renderFrame({
            camera,
            world: { map, surfaces: [wall] },
            dlights: [],
            disableLightmaps: true,
            fullbright: false,
            ambient: 0,
            timeSeconds: 0,
            renderMode: { mode: 'worldpos-debug', applyToAll: true }
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

        // For this geometry:
        // - mins = (200, 0, 0)
        // - maxs = (200, 256, 256)
        //
        // If CORRECT:
        // - At mins (200, 0, 0): R=0.78, G=0, B=0 => Dark red
        // - At maxs (200, 256, 256): R=0.78, G=0, B=0 => Same red (Y,Z wrap)
        // - Should see gradient in G and B channels across surface
        //
        // If BUGGY (worldPos = position - mins):
        // - At mins (200, 0, 0): worldPos = (0, 0, 0) => BLACK
        // - At maxs: worldPos = (0, 256, 256) => G=0, B=0 (wrap) => BLACK
        // - Should see GREEN and BLUE gradients but no RED

        await expectSnapshot(pixels, {
            name: 'worldpos-color-simple-geometry',
            description: 'Simple geometry with Y/Z starting at 0. Should show red component if correct.',
            width: 256, height: 256,
            updateBaseline: true,
            snapshotDir
        });
    });
});
