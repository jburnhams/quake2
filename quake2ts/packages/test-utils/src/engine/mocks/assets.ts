import { vi } from 'vitest';
import {
  AssetManager,
  Md2Model,
  Md3Model,
  BspMap,
  PreparedTexture
} from '@quake2ts/engine';

export function createMockAssetManager(overrides?: Partial<AssetManager>): AssetManager {
  return {
    textures: {
        get: vi.fn(),
        set: vi.fn(),
        has: vi.fn(),
        clear: vi.fn(),
        memoryUsage: 0
    } as any,
    audio: {
        load: vi.fn(),
        get: vi.fn(),
        clearAll: vi.fn()
    } as any,
    loadTexture: vi.fn().mockResolvedValue(createMockTexture()),
    registerTexture: vi.fn(),
    loadSound: vi.fn().mockResolvedValue({} as any),
    loadMd2Model: vi.fn().mockResolvedValue(createMockMd2Model()),
    getMd2Model: vi.fn(),
    loadMd3Model: vi.fn().mockResolvedValue(createMockMd3Model()),
    getMd3Model: vi.fn(),
    loadSprite: vi.fn().mockResolvedValue({} as any),
    loadMap: vi.fn().mockResolvedValue({} as BspMap),
    getMap: vi.fn(),
    loadPalette: vi.fn().mockResolvedValue(undefined),
    isAssetLoaded: vi.fn().mockReturnValue(true),
    listFiles: vi.fn().mockReturnValue([]),
    resetForLevelChange: vi.fn(),
    getMemoryUsage: vi.fn().mockReturnValue({ textures: 0, audio: 0 }),
    clearCache: vi.fn(),
    preloadAssets: vi.fn().mockResolvedValue(undefined),
    queueLoad: vi.fn().mockImplementation((path) => Promise.resolve({} as any)),
    ...overrides
  } as unknown as AssetManager;
}

export function createMockTexture(width: number = 1, height: number = 1, data?: Uint8Array): PreparedTexture {
    return {
        width,
        height,
        data: data || new Uint8Array(width * height * 4).fill(255),
        format: 0, // RGBA
        name: 'mock_texture',
        uploaded: false
    } as unknown as PreparedTexture;
}

export function createMockMd2Model(overrides?: Partial<Md2Model>): Md2Model {
    return {
        header: {
            skinWidth: 0,
            skinHeight: 0,
            frameSize: 0,
            numSkins: 0,
            numVertices: 0,
            numSt: 0,
            numTriangles: 0,
            numGlCmds: 0,
            numFrames: 0,
            offsetSkins: 0,
            offsetSt: 0,
            offsetTriangles: 0,
            offsetFrames: 0,
            offsetGlCmds: 0,
            offsetEnd: 0
        },
        skins: [],
        texCoords: [],
        triangles: [],
        frames: [],
        glCommands: new Int32Array(0),
        ...overrides
    } as Md2Model;
}

export function createMockMd3Model(overrides?: Partial<Md3Model>): Md3Model {
    return {
        header: {
            ident: 0,
            version: 0,
            name: '',
            flags: 0,
            numFrames: 0,
            numTags: 0,
            numSurfaces: 0,
            numSkins: 0,
            offsetFrames: 0,
            offsetTags: 0,
            offsetSurfaces: 0,
            offsetEnd: 0
        },
        frames: [],
        tags: [],
        surfaces: [],
        ...overrides
    } as Md3Model;
}

export function createMockBspMap(overrides?: Partial<BspMap>): BspMap {
    const defaultMap = {
        header: {
            version: 38,
            lumps: new Map()
        },
        entities: {
            raw: '',
            entities: [],
            worldspawn: undefined,
            getUniqueClassnames: vi.fn().mockReturnValue([])
        },
        planes: [],
        vertices: [],
        visibility: new Uint8Array(0),
        nodes: [],
        texInfo: [],
        faces: [],
        lightmaps: [],
        leafs: [],
        leafFaces: [],
        leafBrushes: [],
        edges: [],
        faceEdges: [],
        models: [],
        brushes: [],
        brushSides: [],
    };

    return {
        ...defaultMap,
        ...overrides
    } as unknown as BspMap;
}
