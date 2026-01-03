import { describe, it, expect } from 'vitest';
import { createBspSurfaces } from '../../../../src/render/bsp/surface.js';
import { BspMap, BspHeader, BspEntities, BspPlane, BspLeaf, BspNode, BspTexInfo, BspFace, BspModel, BspBrush, BspBrushSide, BspLeafLists } from '../../../../src/assets/bsp.js';

describe('createBspSurfaces', () => {
  it('should process faces correctly', () => {
    // Create a minimal mock BspMap
    const mockTexInfo: BspTexInfo = {
      s: [1, 0, 0],
      sOffset: 0,
      t: [0, 1, 0],
      tOffset: 0,
      flags: 0,
      value: 0,
      texture: 'test_tex',
      nextTexInfo: -1
    };

    const mockFace: BspFace = {
      planeIndex: 0,
      side: 0,
      firstEdge: 0,
      numEdges: 3,
      texInfo: 0,
      styles: [0, 255, 255, 255],
      lightOffset: -1 // No lightmap for this test
    };

    const mockBsp: BspMap = {
      header: { version: 38, lumps: new Map() } as BspHeader,
      entities: { raw: '', entities: [], worldspawn: undefined } as BspEntities,
      planes: [] as unknown as readonly BspPlane[],
      vertices: [[0, 0, 0], [10, 0, 0], [0, 10, 0]],
      nodes: [] as unknown as readonly BspNode[],
      texInfo: [mockTexInfo],
      faces: [mockFace],
      lightMaps: new Uint8Array(0),
      lightMapInfo: [undefined],
      leafs: [] as unknown as readonly BspLeaf[],
      leafLists: {} as BspLeafLists,
      edges: [{ vertices: [0, 1] }, { vertices: [1, 2] }, { vertices: [2, 0] }],
      surfEdges: new Int32Array([0, 1, 2]),
      models: [] as unknown as readonly BspModel[],
      brushes: [] as unknown as readonly BspBrush[],
      brushSides: [] as unknown as readonly BspBrushSide[],
      visibility: undefined
    };

    const result = createBspSurfaces(mockBsp);

    expect(result).toHaveLength(1);
    const surface = result[0];
    expect(surface.faceIndex).toBe(0);
    expect(surface.textureName).toBe('test_tex');
    expect(surface.vertexCount).toBe(3);

    // Check vertices (Interleaved x, y, z, u, v, lu, lv)
    // Vertex 0: [0, 0, 0] -> u=0, v=0
    expect(surface.vertices[0]).toBe(0);
    expect(surface.vertices[1]).toBe(0);
    expect(surface.vertices[2]).toBe(0);
    expect(surface.vertices[3]).toBe(0);
    expect(surface.vertices[4]).toBe(0);

    // Vertex 1: [10, 0, 0] -> u=10, v=0 (dot product with s=[1,0,0])
    expect(surface.vertices[7]).toBe(10);
    expect(surface.vertices[8]).toBe(0);
    expect(surface.vertices[9]).toBe(0);
    expect(surface.vertices[10]).toBe(10);
    expect(surface.vertices[11]).toBe(0);

    // Vertex 2: [0, 10, 0] -> u=0, v=10
    expect(surface.vertices[14]).toBe(0);
    expect(surface.vertices[15]).toBe(10);
    expect(surface.vertices[16]).toBe(0);
    expect(surface.vertices[17]).toBe(0);
    expect(surface.vertices[18]).toBe(10);
  });
});
