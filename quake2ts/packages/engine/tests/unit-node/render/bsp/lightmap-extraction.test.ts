import { describe, it, expect } from 'vitest';
import { createBspSurfaces } from '../../../../src/render/bsp/surface.js';
import { BspMap, BspTexInfo, BspFace } from '../../../../src/assets/bsp.js';

describe('createBspSurfaces', () => {
  it('should extract lightmap data strictly for active styles', () => {
    // 1. Mock Data Setup
    const texInfo: BspTexInfo = {
      s: [1, 0, 0], sOffset: 0,
      t: [0, 1, 0], tOffset: 0,
      flags: 0, value: 0, texture: 'test', nextTexInfo: -1
    };

    const vertices: [number, number, number][] = [
      [0, 0, 0],
      [32, 0, 0],
      [32, 32, 0],
      [0, 32, 0]
    ];

    // Face with 2 styles: 0 and 1.
    const face: BspFace = {
      planeIndex: 0, side: 0, firstEdge: 0, numEdges: 4, texInfo: 0,
      styles: [0, 1, 255, 255], // 2 styles!
      lightOffset: 0 // Start of lump
    };

    // Expected size: 2 styles * (3*3*3 bytes) = 54 bytes.
    // Input buffer has garbage at end.
    const lightMaps = new Uint8Array(100);
    lightMaps.fill(1, 0, 27);
    lightMaps.fill(2, 27, 54);
    lightMaps.fill(0xFF, 54, 100); // Garbage

    const bsp = {
      faces: [face],
      texInfo: [texInfo],
      vertices: vertices,
      edges: [{ vertices: [0, 1] }, { vertices: [1, 2] }, { vertices: [2, 3] }, { vertices: [3, 0] }],
      surfEdges: new Int32Array([0, 1, 2, 3]),
      lightMaps: lightMaps,
      lightMapInfo: [{ offset: 0, length: 100 }], // Info claims 100 bytes available (simulating 'rest of lump')
    } as unknown as BspMap;

    // 2. Execute
    const surfaces = createBspSurfaces(bsp);

    // 3. Verify
    const lm = surfaces[0].lightmap!;
    expect(lm.width).toBe(3);
    expect(lm.height).toBe(3);

    // Expect exact extraction
    expect(lm.data.length).toBe(54);
  });
});
