import { describe, expect, it } from 'vitest';
import { exportLightmaps } from '../src/tools/lightmapExport.js';
import { buildTestBsp } from '@quake2ts/test-utils'; // bspBuilder.js';
import { parseBsp } from '../src/assets/bsp.js';

describe('Lightmap Export', () => {
  it('extracts and packs lightmaps from BSP', () => {
    // Vertices: (0,0,0) to (16,0,0) and (0,16,0).
    // S range: 0 to 16. T range: 0 to 16.
    // Calculation:
    // floorMinS = floor(0/16) = 0
    // floorMinT = floor(0/16) = 0
    // lmWidth = ceil(16/16) - 0 + 1 = 1 - 0 + 1 = 2
    // lmHeight = ceil(16/16) - 0 + 1 = 1 - 0 + 1 = 2
    // Expected lightmap size: 2x2 pixels.
    // Required data size: 2 * 2 * 3 (RGB) = 12 bytes.

    const lightingData = new Uint8Array([
      255, 0, 0,   0, 255, 0,   // Row 1: Red, Green
      0, 0, 255,   255, 255, 255 // Row 2: Blue, White
    ]);

    const buffer = buildTestBsp({
      faces: [
        {
          planeIndex: 0,
          side: 0,
          firstEdge: 0,
          numEdges: 3,
          texInfo: 0,
          styles: [0, 0, 0, 0],
          lightOffset: 0
        }
      ],
      lighting: lightingData,
      texInfo: [{
        s: [1, 0, 0], sOffset: 0,
        t: [0, 1, 0], tOffset: 0,
        flags: 0, value: 0, texture: 'TEST', nextTexInfo: -1
      }],
      vertices: [[0, 0, 0], [16, 0, 0], [0, 16, 0]],
      edges: [[0, 1], [1, 2], [2, 0]],
      surfEdges: new Int32Array([0, 1, 2])
    });

    const bsp = parseBsp(buffer);
    const atlases = exportLightmaps(bsp, 64, 0);

    expect(atlases).toHaveLength(1);
    const atlas = atlases[0];
    expect(atlas.width).toBe(64);
    expect(atlas.height).toBe(64);

    // Atlas has 4 channels (RGBA).
    // Lightmap is 2x2. Placed at 0,0 (padding 0).
    // Row 0, Col 0: Index 0. Should be Red (255, 0, 0, 255).
    expect(atlas.data[0]).toBe(255);
    expect(atlas.data[1]).toBe(0);
    expect(atlas.data[2]).toBe(0);
    expect(atlas.data[3]).toBe(255);

    // Row 0, Col 1: Index 4. Should be Green (0, 255, 0, 255).
    expect(atlas.data[4]).toBe(0);
    expect(atlas.data[5]).toBe(255);

    // Row 1, Col 0: Stride = 64 * 4 = 256. Index 256. Should be Blue (0, 0, 255, 255).
    expect(atlas.data[256]).toBe(0);
    expect(atlas.data[256+2]).toBe(255);

    // Row 1, Col 1: Index 260. Should be White.
    expect(atlas.data[260]).toBe(255);
    expect(atlas.data[260+1]).toBe(255);
    expect(atlas.data[260+2]).toBe(255);
  });

  it('handles multiple faces packing into atlas', () => {
    // Two faces, both 2x2.
    // Face 1: Red/Green/Blue/White.
    // Face 2: White/Blue/Green/Red (inverted).

    const face1Data = [
      255, 0, 0,   0, 255, 0,
      0, 0, 255,   255, 255, 255
    ];
    const face2Data = [
      255, 255, 255, 0, 0, 255,
      0, 255, 0,     255, 0, 0
    ];

    const lighting = new Uint8Array([...face1Data, ...face2Data]);

    const buffer = buildTestBsp({
      faces: [
        { planeIndex: 0, side: 0, firstEdge: 0, numEdges: 3, texInfo: 0, styles: [0], lightOffset: 0 },
        { planeIndex: 0, side: 0, firstEdge: 0, numEdges: 3, texInfo: 0, styles: [0], lightOffset: 12 }
      ],
      lighting: lighting,
      texInfo: [{
        s: [1, 0, 0], sOffset: 0,
        t: [0, 1, 0], tOffset: 0,
        flags: 0, value: 0, texture: 'TEST', nextTexInfo: -1
      }],
      vertices: [[0, 0, 0], [16, 0, 0], [0, 16, 0]],
      edges: [[0, 1], [1, 2], [2, 0]],
      surfEdges: new Int32Array([0, 1, 2])
    });

    const bsp = parseBsp(buffer);
    // Use 1px padding
    const atlases = exportLightmaps(bsp, 64, 1);

    expect(atlases).toHaveLength(1);
    const data = atlases[0].data;

    // Face 1: 2x2. Padding 1.
    // Padded size: 4x4.
    // Placed at 0,0.
    // Content starts at x=1, y=1 (due to padding).

    // Row 0 of atlas (y=0) is padding.
    // Row 1 of atlas (y=1). Start index = 1 * 64 * 4 = 256.
    // x=1 -> index + 4 = 260.
    // Should be Face 1 Pixel (0,0) -> Red.
    expect(data[260]).toBe(255);
    expect(data[261]).toBe(0);

    // Face 2: 2x2. Padding 1.
    // Placed after Face 1.
    // Face 1 took cursorX up to 4.
    // Face 2 placed at x=4, y=0.
    // Content starts at x=5, y=1.

    // Row 1 (y=1). Index 256.
    // x=5 -> 256 + 20 = 276.
    // Should be Face 2 Pixel (0,0) -> White.
    expect(data[276]).toBe(255);
    expect(data[277]).toBe(255);
    expect(data[278]).toBe(255);
  });
});
