import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AssetPreviewGenerator } from '../../src/assets/preview.js';
import { AssetManager } from '../../src/assets/manager.js';
import { VirtualFileSystem } from '../../src/assets/vfs.js';
import { Md2Model } from '../../src/assets/md2.js';
import { Md3Model } from '../../src/assets/md3.js';
import { Vec3 } from '@quake2ts/shared';
import { createMockMd2Model, createMockMd3Model } from '@quake2ts/test-utils';

describe('AssetPreviewGenerator', () => {
  let assetManager: AssetManager;
  let generator: AssetPreviewGenerator;
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem();
    assetManager = new AssetManager(vfs);
    generator = new AssetPreviewGenerator(assetManager);
  });

  it('getMapBounds returns null for invalid data', async () => {
    // Suppress console.error for this test as we expect it to fail gracefully
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const bounds = await generator.getMapBounds('test.bsp', new ArrayBuffer(10));
      expect(bounds).toBeNull();

      // Check that it logged the error
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('generateTextureThumbnail resizes texture correctly', async () => {
    // Create a mock 4x4 texture (red)
    const width = 4;
    const height = 4;
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 255; // R
      rgba[i+1] = 0; // G
      rgba[i+2] = 0; // B
      rgba[i+3] = 255; // A
    }

    const mockTexture = {
      width,
      height,
      levels: [{ level: 0, width, height, rgba }],
      source: 'wal' as const
    };

    // Mock assetManager.loadTexture
    vi.spyOn(assetManager, 'loadTexture').mockResolvedValue(mockTexture);

    const size = 2;
    const result = await generator.generateTextureThumbnail('test.wal', size);

    expect(result).not.toBeNull();
    expect(result!.width).toBe(2);
    expect(result!.height).toBe(2);

    // Check pixel data (should still be red)
    const data = result!.data;
    expect(data.length).toBe(2 * 2 * 4);
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(0);
    expect(data[3]).toBe(255);
  });

  it('generateTextureThumbnail handles aspect ratio', async () => {
    // 4x2 texture
    const width = 4;
    const height = 2;
    const rgba = new Uint8Array(width * height * 4);

    const mockTexture = {
      width,
      height,
      levels: [{ level: 0, width, height, rgba }],
      source: 'wal' as const
    };

    vi.spyOn(assetManager, 'loadTexture').mockResolvedValue(mockTexture);

    const size = 2;
    const result = await generator.generateTextureThumbnail('test.wal', size);

    expect(result).not.toBeNull();
    // Should scale to 2x1 to maintain aspect ratio within 2x2 box
    expect(result!.width).toBe(2);
    expect(result!.height).toBe(1);
  });

  it('generateModelThumbnail creates wireframe for MD2', async () => {
    const mockVertices: Vec3[] = [
      { x: -10, y: -10, z: -10 },
      { x: 10, y: -10, z: -10 },
      { x: 0, y: 10, z: 0 }
    ];

    // Triangle: 0-1-2
    const mockTriangles = [
      { vertexIndices: [0, 1, 2] as [number, number, number], texCoordIndices: [0, 0, 0] as [number, number, number] }
    ];

    // Use centralized mock factory from test-utils
    const mockMd2 = createMockMd2Model({
      triangles: mockTriangles,
      frames: [{
        name: 'frame1',
        vertices: mockVertices.map(p => ({ position: p, normalIndex: 0, normal: {x:0,y:0,z:1} })),
        minBounds: {x:-10,y:-10,z:-10},
        maxBounds: {x:10,y:10,z:0}
      }]
    });

    vi.spyOn(assetManager, 'loadMd2Model').mockResolvedValue(mockMd2);

    const size = 64;
    const result = await generator.generateModelThumbnail('test.md2', size);

    expect(result).not.toBeNull();
    expect(result!.width).toBe(size);
    expect(result!.height).toBe(size);

    // Check if we drew something (green pixels)
    let foundGreen = false;
    for (let i = 0; i < result!.data.length; i += 4) {
      if (result!.data[i+1] === 255 && result!.data[i+3] === 255) {
        foundGreen = true;
        break;
      }
    }
    expect(foundGreen).toBe(true);
  });

  it('generateModelThumbnail creates wireframe for MD3', async () => {
    const mockVertices = [
      { position: { x: -10, y: -10, z: -10 } },
      { position: { x: 10, y: -10, z: -10 } },
      { position: { x: 0, y: 10, z: 0 } }
    ];

    // Use centralized mock factory from test-utils
    const mockMd3 = createMockMd3Model({
      surfaces: [{
        shaders: [],
        triangles: [{ indices: [0, 1, 2] }],
        texCoords: [],
        vertices: [mockVertices as any]
      } as any]
    });

    vi.spyOn(assetManager, 'loadMd3Model').mockResolvedValue(mockMd3);

    const size = 64;
    const result = await generator.generateModelThumbnail('test.md3', size);

    expect(result).not.toBeNull();
    // Check green pixels
    let foundGreen = false;
    for (let i = 0; i < result!.data.length; i += 4) {
      if (result!.data[i+1] === 255 && result!.data[i+3] === 255) {
        foundGreen = true;
        break;
      }
    }
    expect(foundGreen).toBe(true);
  });
});
