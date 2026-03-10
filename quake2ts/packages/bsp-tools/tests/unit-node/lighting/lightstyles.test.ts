import { describe, it, expect } from 'vitest';
import { packLightmaps, FaceLightingData } from '../../../src/lighting/lightmap.js';
import type { LightSample } from '../../../src/lighting/direct.js';

describe('Multiple Light Styles', () => {
  it('should pack multiple lightmaps when a face has multiple styles', () => {
    // Simulate a face with two styles (0 and 1)
    const w = 2;
    const h = 2;

    const samplesStyle0: LightSample[] = [
      { color: { x: 100, y: 100, z: 100 } },
      { color: { x: 100, y: 100, z: 100 } },
      { color: { x: 100, y: 100, z: 100 } },
      { color: { x: 100, y: 100, z: 100 } }
    ];

    const samplesStyle1: LightSample[] = [
      { color: { x: 200, y: 0, z: 0 } },
      { color: { x: 200, y: 0, z: 0 } },
      { color: { x: 200, y: 0, z: 0 } },
      { color: { x: 200, y: 0, z: 0 } }
    ];

    const samplesMap = new Map<number, LightSample[]>();
    samplesMap.set(0, samplesStyle0);
    samplesMap.set(1, samplesStyle1);

    const faces: FaceLightingData[] = [
      {
        lightmapInfo: { width: w, height: h, mins: [0, 0] as [number, number], maxs: [1, 1] as [number, number], luxelSize: 16 },
        samplesByStyle: samplesMap
      }
    ];

    const packed = packLightmaps(faces);

    // Should have 1 offset because there's 1 face
    expect(packed.faceOffsets.length).toBe(1);
    expect(packed.faceOffsets[0]).toBe(0);

    // The face styles should be [0, 1, 255, 255]
    expect(packed.faceStyles[0]).toEqual([0, 1, 255, 255]);

    // Total size should be 1 * (w * h * 3) * 2 styles = 1 * 4 * 3 * 2 = 24
    expect(packed.data.length).toBe(24);

    // First lightmap is gray (style 0)
    expect(packed.data[0]).toBe(100);

    // Second lightmap is red (style 1 starts at 12)
    expect(packed.data[12]).toBe(200);
  });
});
