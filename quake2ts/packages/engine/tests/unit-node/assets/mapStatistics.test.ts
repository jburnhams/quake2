import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapAnalyzer } from '../../../src/assets/mapStatistics';
import { BspLoader, BspMap } from '../../../src/assets/bsp';
import { createMockBspFace, createMockBspTexInfo } from '@quake2ts/test-utils';

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
    mockMap.faces = Array.from({ length: 10 }, () => createMockBspFace());
    mockMap.faces[0].lightOffset = 100;
    mockMap.faces[1].lightOffset = 200;

    mockMap.vertices = Array.from({ length: 100 }, () => ({ position: { x: 0, y: 0, z: 0 } }));
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
      createMockBspTexInfo({ texture: 'wal1' }),
      createMockBspTexInfo({ texture: 'wal2' }),
      createMockBspTexInfo({ texture: 'wal1' })
    ];

    const textures = await analyzer.getUsedTextures('test.bsp');
    expect(textures).toEqual(['wal1', 'wal2']);
  });

  it('lists used models', async () => {
    // Ensure MapEntity properties strictly map to what MapAnalyzer expects for properties
    mockMap.entities.entities = [
      { classname: 'test', properties: { model: '*1' } }, // Inline model
      { classname: 'test', properties: { model: 'models/w1.md2' } },
      { classname: 'test', properties: { model: 'models/w2.md2' } }
    ];

    const models = await analyzer.getUsedModels('test.bsp');
    expect(models).toEqual(['models/w1.md2', 'models/w2.md2']);
  });

  it('lists used sounds', async () => {
    // Set appropriate entity structure
    mockMap.entities.entities = [
      { classname: 'test', properties: { noise: 's1.wav' } },
      { classname: 'test', properties: { sound: 's2.wav' } },
      { classname: 'test', properties: { other: 'ignore' } }
    ];

    const sounds = await analyzer.getUsedSounds('test.bsp');
    expect(sounds).toEqual(['s1.wav', 's2.wav']);
  });
});
