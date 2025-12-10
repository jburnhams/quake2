import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AssetPreviewGenerator } from '../../src/assets/preview.js';
import { AssetManager } from '../../src/assets/manager.js';
import { VirtualFileSystem } from '../../src/assets/vfs.js';

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
    const bounds = await generator.getMapBounds('test.bsp', new ArrayBuffer(10));
    expect(bounds).toBeNull();
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
});
