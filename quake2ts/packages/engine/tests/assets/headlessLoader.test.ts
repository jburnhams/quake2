import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeadlessMapLoader } from '../../src/assets/headlessLoader';
import { BspLoader, BspMap } from '../../src/assets/bsp';
import { RenderMode } from '../../src/render/types';

describe('HeadlessMapLoader', () => {
  let loader: BspLoader;
  let headless: HeadlessMapLoader;
  let mockMap: BspMap;

  beforeEach(() => {
    mockMap = {
      header: { version: 38, lumps: new Map() },
      entities: {
        raw: '',
        entities: [],
        worldspawn: undefined,
        getUniqueClassnames: () => []
      },
      planes: [],
      vertices: [
          [0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]
      ],
      nodes: [],
      texInfo: [
          { s: [1,0,0], sOffset: 0, t: [0,1,0], tOffset: 0, flags: 0, value: 0, texture: 'wall', nextTexInfo: -1 }
      ],
      faces: [
          { planeIndex: 0, side: 0, firstEdge: 0, numEdges: 4, texInfo: 0, styles: [255, 255, 255, 255], lightOffset: -1 }
      ],
      lightMaps: new Uint8Array(),
      lightMapInfo: [undefined],
      leafs: [],
      leafLists: { leafFaces: [], leafBrushes: [] },
      edges: [
          { vertices: [0, 1] },
          { vertices: [1, 2] },
          { vertices: [2, 3] },
          { vertices: [3, 0] }
      ],
      surfEdges: new Int32Array([0, 1, 2, 3]),
      models: [
          { mins: [0, 0, 0], maxs: [10, 10, 0], origin: [0,0,0], headNode: 0, firstFace: 0, numFaces: 1 }
      ],
      brushes: [],
      brushSides: [],
      visibility: undefined,
      pickEntity: () => null
    };

    loader = {
      load: vi.fn().mockResolvedValue(mockMap)
    } as unknown as BspLoader;

    headless = new HeadlessMapLoader(loader);
  });

  it('gets map geometry', async () => {
    const geo = await headless.getMapGeometry('test.bsp');
    expect(geo.vertices).toBeDefined();
    expect(geo.indices).toBeDefined();
    // 4 vertices * 8 floats = 32
    expect(geo.vertices.length).toBe(32);
    // 2 triangles = 6 indices
    expect(geo.indices.length).toBe(6);
    expect(geo.bounds).toEqual({ mins: [0, 0, 0], maxs: [10, 10, 0] });
  });

  it('gets map textures', async () => {
    const textures = await headless.getMapTextures('test.bsp');
    expect(textures).toHaveLength(1);
    expect(textures[0].name).toBe('wall');
  });

  it('gets map lightmaps (empty)', async () => {
    const lms = await headless.getMapLightmaps('test.bsp');
    expect(lms).toHaveLength(0);
  });
});
