import { describe, it, expect, vi } from 'vitest';
import { BspMap, BspSurfaceInput, PreparedTexture, buildBspGeometry, createCamera } from '@quake2ts/engine';
import { BspRenderer, extractBspSurfaces } from './BspRenderer';
import { mockGl } from './gl-matrix-mock';

vi.mock('gl-matrix', () => ({
    vec3: {
        create: vi.fn(() => [0, 0, 0]),
        fromValues: vi.fn((x, y, z) => [x, y, z]),
    },
    mat4: {
        create: vi.fn(() => []),
        lookAt: vi.fn(),
        perspective: vi.fn(),
    },
}));

const mockTexture: PreparedTexture = {
    width: 32,
    height: 32,
    levels: [{ level: 0, width: 32, height: 32, rgba: new Uint8Array(32 * 32 * 4) }],
    source: 'wal',
};

const mockMap: BspMap = {
    header: { version: 38, lumps: new Map() },
    entities: { raw: '', entities: [], worldspawn: undefined },
    planes: [
        { normal: [0, 0, 1], dist: 0, type: 0 },
    ],
    vertices: [
        [0, 0, 0],
        [32, 0, 0],
        [32, 32, 0],
        [0, 32, 0],
    ],
    nodes: [
        {
            planeIndex: 0,
            children: [-1, -1],
            mins: [-16, -16, -16],
            maxs: [16, 16, 16],
            firstFace: 0,
            numFaces: 1,
        }
    ],
    texInfo: [
        {
            s: [1, 0, 0], sOffset: 0,
            t: [0, 1, 0], tOffset: 0,
            flags: 0, value: 0,
            texture: 'test',
            nextTexInfo: -1,
        }
    ],
    faces: [
        {
            planeIndex: 0,
            side: 0,
            firstEdge: 0,
            numEdges: 4,
            texInfo: 0,
            styles: [0, 0, 0, 0],
            lightOffset: 0,
        }
    ],
    lightMaps: new Uint8Array(32 * 32 * 3),
    lightMapInfo: [],
    leafs: [
        {
            contents: 0,
            cluster: 0,
            area: 0,
            mins: [-16, -16, -16],
            maxs: [16, 16, 16],
            firstLeafFace: 0,
            numLeafFaces: 1,
            firstLeafBrush: 0,
            numLeafBrushes: 0,
        }
    ],
    leafLists: { leafFaces: [[0]], leafBrushes: [] },
    edges: [
        { vertices: [0, 1] },
        { vertices: [1, 2] },
        { vertices: [2, 3] },
        { vertices: [3, 0] },
    ],
    surfEdges: new Int32Array([0, 1, 2, 3]),
    models: [],
    brushes: [],
    brushSides: [],
    visibility: undefined,
};

describe('extractBspSurfaces', () => {
    it.skip('should extract surfaces from a BSP map', () => {
        const textureCache = new Map<string, PreparedTexture>();
        textureCache.set('test', mockTexture);

        const surfaces = extractBspSurfaces(mockMap, textureCache);

        expect(surfaces).toHaveLength(1);
        const [surface] = surfaces;
        expect(surface.texture).toBe('test');
        expect(surface.vertices).toEqual([ 0, 32, 0, 32, 32, 0, 32, 0, 0, 0, 0, 0 ]);
        expect(surface.indices).toEqual([0, 1, 2, 0, 2, 3]);
    });
});

describe('buildBspGeometry', () => {
    it('should build geometry from surface data', () => {
        const surfaceInput: BspSurfaceInput = {
            vertices: [0, 0, 0, 32, 0, 0, 32, 32, 0, 0, 32, 0],
            textureCoords: [0, 0, 1, 0, 1, 1, 0, 1],
            lightmapCoords: [0, 0, 1, 0, 1, 1, 0, 1],
            indices: [0, 1, 2, 0, 2, 3],
            texture: 'test',
            surfaceFlags: 0,
            lightmap: {
                width: 2,
                height: 2,
                samples: new Uint8Array(2 * 2 * 3),
            }
        };

        const { surfaces, lightmaps } = buildBspGeometry(mockGl as any, [surfaceInput]);

        expect(surfaces).toHaveLength(1);
        expect(lightmaps).toHaveLength(1);
        const [surface] = surfaces;
        expect(surface.texture).toBe('test');
        expect(surface.indexCount).toBe(6);
    });
});

describe('BspRenderer', () => {
    it('should render visible faces', async () => {
        const assetManager = {
            loadTexture: vi.fn(async () => mockTexture),
        };
        const renderer = await BspRenderer.create(mockGl as any, assetManager as any, mockMap as any);

        const camera = createCamera([0, 0, 0], [0, 0, -1], [0, 1, 0], 75, 1, 0.1, 100);
        (camera as any).frustum = [];

        renderer.render(camera, mockMap as any);

        expect(mockGl.drawElements).toHaveBeenCalled();
    });
});
