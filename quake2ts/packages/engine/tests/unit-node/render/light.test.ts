import { describe, it, expect } from 'vitest';
import { getMinLight, calculateEntityLight, findLeaf } from '../../../src/render/light.js';
import { BspMap, BspLeaf, BspNode } from '../../../src/assets/bsp.js';

describe('light', () => {
  const mockLeaf: BspLeaf = {
    contents: 0,
    cluster: 0,
    area: 0,
    mins: [0, 0, 0],
    maxs: [100, 100, 100],
    firstLeafFace: 0,
    numLeafFaces: 0,
    firstLeafBrush: 0,
    numLeafBrushes: 0,
  };

  const mockMap: BspMap = {
    header: { version: 38, lumps: new Map() },
    entities: { raw: '', entities: [], worldspawn: { classname: 'worldspawn', properties: {} } },
    planes: [{ normal: [0, 0, 1], dist: 0, type: 0 }],
    vertices: [],
    nodes: [{
        planeIndex: 0,
        children: [-1, -1], // Leaf 0
        mins: [0,0,0],
        maxs: [100,100,100],
        firstFace: 0,
        numFaces: 0
    } as unknown as BspNode],
    texInfo: [],
    faces: [],
    lightMaps: new Uint8Array(),
    lightMapInfo: [],
    leafs: [mockLeaf],
    leafLists: { leafFaces: [], leafBrushes: [] },
    edges: [],
    surfEdges: new Int32Array(),
    models: [{
        mins: [0,0,0],
        maxs: [0,0,0],
        origin: [0,0,0],
        headNode: 0,
        firstFace: 0,
        numFaces: 0
    }],
    brushes: [],
    brushSides: [],
    visibility: undefined,
  };

  it('should return default min light if no worldspawn properties', () => {
    expect(getMinLight(mockMap)).toBe(0.2);
  });

  it('should parse "light" property from worldspawn', () => {
    const mapWithLight = { ...mockMap, entities: { ...mockMap.entities, worldspawn: { classname: 'worldspawn', properties: { light: '255' } } } };
    expect(getMinLight(mapWithLight)).toBe(1.0);
  });

  it('should parse "_minlight" property from worldspawn', () => {
    const mapWithMinLight = { ...mockMap, entities: { ...mockMap.entities, worldspawn: { classname: 'worldspawn', properties: { _minlight: '128' } } } };
    // 128 / 255 is approx 0.5
    expect(getMinLight(mapWithMinLight)).toBeCloseTo(0.5, 1);
  });

  it('should calculate entity light based on min light', () => {
    const light = calculateEntityLight(mockMap, { x: 0, y: 0, z: 0 });
    expect(light).toBeGreaterThanOrEqual(0.2);
  });

  it('should traverse BSP tree to find leaf', () => {
    const { leaf, index } = findLeaf(mockMap, { x: 10, y: 10, z: 10 });
    expect(leaf).toBeDefined();
    expect(Math.abs(index)).toBe(0);
  });
});
