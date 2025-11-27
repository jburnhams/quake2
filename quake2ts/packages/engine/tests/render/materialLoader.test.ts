import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMaterialsFromMap } from '../../src/render/materialLoader.js';
import { MaterialManager, BlendMode } from '../../src/render/materials.js';
import { Texture2D } from '../../src/render/resources.js';
import { BspMap, BspTexInfo } from '../../src/assets/bsp.js';
import { SURF_FLOWING, SURF_WARP, SURF_TRANS33, SURF_NONE } from '@quake2ts/shared';

// Mock WebGL2RenderingContext
const gl = {
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    deleteTexture: vi.fn(),
    activeTexture: vi.fn(),
} as unknown as WebGL2RenderingContext;

// Helper to create a fake Texture2D
function createFakeTexture(name: string): Texture2D {
    return new Texture2D(gl);
}

describe('createMaterialsFromMap', () => {
    let materialManager: MaterialManager;
    let textures: Map<string, Texture2D>;
    let map: BspMap;

    beforeEach(() => {
        materialManager = new MaterialManager();
        textures = new Map();

        // Setup simple BSP map mock
        map = {
            texInfo: [],
            // Other fields not strictly needed for this test but good to have minimal shape
            models: [],
            planes: [],
            nodes: [],
            leafs: [],
            leafLists: { leafFaces: [] },
            faces: [],
            visibility: { numClusters: 0, clusters: [] },
            entities: { entities: [] }
        } as unknown as BspMap;
    });

    it('should create a simple opaque material', () => {
        const texName = 'base_wall';
        textures.set(texName, createFakeTexture(texName));

        const texInfo = {
            texture: texName,
            flags: SURF_NONE
        } as BspTexInfo;
        (map.texInfo as any).push(texInfo);

        createMaterialsFromMap(map, textures, materialManager);

        const mat = materialManager.getMaterial(texName);
        expect(mat).toBeDefined();
        expect(mat?.blendMode).toBe(BlendMode.OPAQUE);
        expect(mat?.warp).toBe(false);
    });

    it('should create a material with warp flag', () => {
        const texName = 'water';
        textures.set(texName, createFakeTexture(texName));

        const texInfo = {
            texture: texName,
            flags: SURF_WARP
        } as BspTexInfo;
        (map.texInfo as any).push(texInfo);

        createMaterialsFromMap(map, textures, materialManager);

        const mat = materialManager.getMaterial(texName);
        expect(mat).toBeDefined();
        expect(mat?.warp).toBe(true);
    });

    it('should create a material with flow/scroll', () => {
        const texName = 'conveyor';
        textures.set(texName, createFakeTexture(texName));

        const texInfo = {
            texture: texName,
            flags: SURF_FLOWING
        } as BspTexInfo;
        (map.texInfo as any).push(texInfo);

        createMaterialsFromMap(map, textures, materialManager);

        const mat = materialManager.getMaterial(texName);
        expect(mat).toBeDefined();
        expect(mat?.scroll[0]).not.toBe(0);
    });

    it('should group animated textures (+0, +1)', () => {
        const base = 'button';
        const t0 = '+0' + base;
        const t1 = '+1' + base;

        textures.set(t0, createFakeTexture(t0));
        textures.set(t1, createFakeTexture(t1));

        const texInfo = {
            texture: t0,
            flags: SURF_NONE
        } as BspTexInfo;
        (map.texInfo as any).push(texInfo);

        createMaterialsFromMap(map, textures, materialManager);

        const mat = materialManager.getMaterial(t0);
        expect(mat).toBeDefined();
        // We can't easily check textures length privately without looking at implementation details
        // but we can check if update changes the texture

        const tex0 = mat?.texture;
        mat?.update(0.0);
        expect(mat?.texture).toBe(tex0); // Frame 0

        // Advance time to next frame (fps default 10 -> 0.1s per frame)
        mat?.update(0.15);
        const tex1 = mat?.texture;

        expect(tex1).not.toBe(tex0);
    });
});
