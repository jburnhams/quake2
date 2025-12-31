import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapAnalyzer } from '../../../src/assets/mapStatistics';
import { BspLoader, BspMap } from '../../../src/assets/bsp';

describe('MapAnalyzer', () => {
  let loader: BspLoader;
  let analyzer: MapAnalyzer;
  let mockMap: BspMap;

  beforeEach(() => {
    mockMap = {
      header: { version: 38, lumps: new Map() },
      entities: {
        raw: '',
        entities: [
            { classname: 'worldspawn', properties: { classname: 'worldspawn' } }
        ],
        worldspawn: { classname: 'worldspawn', properties: { classname: 'worldspawn' } },
        getUniqueClassnames: () => ['worldspawn']
      },
      planes: [],
      vertices: [],
      nodes: [],
      texInfo: [],
      faces: [],
      lightMaps: new Uint8Array(),
      lightMapInfo: [],
      leafs: [],
      leafLists: { leafFaces: [], leafBrushes: [] },
      edges: [],
      surfEdges: new Int32Array(),
      models: [
          { mins: [-10, -10, -10], maxs: [10, 10, 10], origin: [0,0,0], headNode: 0, firstFace: 0, numFaces: 0 }
      ],
      brushes: [],
      brushSides: [],
      visibility: undefined,
      pickEntity: () => null
    };

    loader = {
      load: vi.fn().mockResolvedValue(mockMap)
    } as unknown as BspLoader;

    analyzer = new MapAnalyzer(loader);
  });

  it('calculates map statistics', async () => {
    mockMap.faces = new Array(10).fill({ lightOffset: -1 });
    mockMap.faces[0] = { lightOffset: 100 } as any;
    mockMap.faces[1] = { lightOffset: 200 } as any;

    mockMap.vertices = new Array(100);
    mockMap.entities.entities.push({ classname: 'info_player_start', properties: {} });

    const stats = await analyzer.getMapStatistics('test.bsp');

    expect(stats.entityCount).toBe(2); // worldspawn + info_player_start
    expect(stats.surfaceCount).toBe(10);
    expect(stats.lightmapCount).toBe(2);
    expect(stats.vertexCount).toBe(100);
    expect(stats.bounds).toEqual({ mins: [-10, -10, -10], maxs: [10, 10, 10] });
  });

  it('lists used textures', async () => {
    mockMap.texInfo = [
      { texture: 'wal1' },
      { texture: 'wal2' },
      { texture: 'wal1' }
    ] as any;

    const textures = await analyzer.getUsedTextures('test.bsp');
    expect(textures).toEqual(['wal1', 'wal2']);
  });

  it('lists used models', async () => {
    mockMap.entities.entities = [
      { properties: { model: '*1' } }, // Inline model
      { properties: { model: 'models/w1.md2' } },
      { properties: { model: 'models/w2.md2' } }
    ] as any;

    const models = await analyzer.getUsedModels('test.bsp');
    expect(models).toEqual(['models/w1.md2', 'models/w2.md2']);
  });

  it('lists used sounds', async () => {
    mockMap.entities.entities = [
      { properties: { noise: 's1.wav' } },
      { properties: { sound: 's2.wav' } },
      { properties: { other: 'ignore' } }
    ] as any;

    const sounds = await analyzer.getUsedSounds('test.bsp');
    expect(sounds).toEqual(['s1.wav', 's2.wav']);
  });
});
