import { describe, expect, it } from 'vitest';
import { buildBspGeometry, type BspSurfaceInput } from '../src/render/bsp.js';
import { createMockGL } from './helpers/mockWebGL.js';

function makeLightmap(width: number, height: number, start = 0): Uint8Array {
  const samples = new Uint8Array(width * height * 3);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = (start + i) & 0xff;
  }
  return samples;
}

describe('buildBspGeometry', () => {
  it('packs lightmaps into atlases and remaps UVs', () => {
    const gl = createMockGL();
    const surfaces: BspSurfaceInput[] = [
      {
        vertices: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
        textureCoords: [0, 0, 1, 0, 1, 1, 0, 1],
        lightmapCoords: [0, 0, 1, 0, 1, 1, 0, 1],
        texture: 'stone',
        lightmap: { width: 4, height: 4, samples: makeLightmap(4, 4) },
      },
      {
        vertices: [0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0],
        textureCoords: [0, 0, 2, 0, 2, 2, 0, 2],
        lightmapCoords: [0, 0, 1, 0, 1, 1, 0, 1],
        texture: 'metal',
        lightmap: { width: 4, height: 4, samples: makeLightmap(4, 4, 100) },
      },
    ];

    const result = buildBspGeometry(gl as unknown as WebGL2RenderingContext, surfaces, {
      atlasSize: 8,
      lightmapPadding: 1,
    });

    expect(result.lightmaps).toHaveLength(2);
    expect(result.lightmaps[0].width).toBe(8);
    expect(result.lightmaps[1].width).toBe(8);
    expect(result.lightmaps[0].pixels.length).toBe(8 * 8 * 4);

    const firstPixel = result.lightmaps[0].pixels.subarray((1 * 8 + 1) * 4, (1 * 8 + 1) * 4 + 4);
    expect(Array.from(firstPixel)).toEqual([0, 1, 2, 255]);

    const surface0 = result.surfaces[0];
    const [u0, v0] = [surface0.vertexData[5], surface0.vertexData[6]];
    expect(u0).toBeCloseTo(1 / 8); // offset with padding
    expect(v0).toBeCloseTo(1 / 8);

    const surface1 = result.surfaces[1];
    expect(surface1.lightmap?.atlasIndex).toBe(1);
    const [u1, v1] = [surface1.vertexData[5], surface1.vertexData[6]];
    expect(u1).toBeCloseTo(1 / 8);
    expect(v1).toBeCloseTo(1 / 8);
  });

  it('builds CPU vertex/index data and uploads GPU buffers', () => {
    const gl = createMockGL();
    const surface: BspSurfaceInput = {
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      textureCoords: [0, 0, 1, 0, 0, 1],
      lightmapCoords: [0, 0, 1, 0, 0, 1],
      texture: 'lava',
      indices: [0, 1, 2],
      lightmap: { width: 2, height: 2, samples: makeLightmap(2, 2) },
    };

    const { surfaces, lightmaps } = buildBspGeometry(gl as unknown as WebGL2RenderingContext, [surface], {
      atlasSize: 4,
      lightmapPadding: 1,
    });

    expect(lightmaps).toHaveLength(1);
    expect(lightmaps[0].pixels.filter((value) => value !== 0).length).toBeGreaterThan(0);

    const built = surfaces[0];
    expect(Array.from(built.indexData)).toEqual([0, 1, 2]);
    expect(built.vertexData.length).toBe(21);
    expect(gl.bindBuffer).toHaveBeenCalled();
    expect(gl.vertexAttribPointer).toHaveBeenCalledWith(0, 3, gl.FLOAT, false, 28, 0);
    expect(gl.texImage2D).toHaveBeenCalled();
  });
});
