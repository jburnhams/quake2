import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetManager } from '../../../src/assets/manager';
import { VirtualFileSystem } from '../../../src/assets/vfs';
import { PreparedTexture } from '../../../src/assets/texture';

describe('AssetManager TGA Integration', () => {
  let vfs: VirtualFileSystem;
  let manager: AssetManager;

  beforeEach(() => {
    // Create a mock VFS
    vfs = {
      readFile: vi.fn(),
    } as unknown as VirtualFileSystem;

    manager = new AssetManager(vfs);
  });

  it('should load and parse a TGA texture', async () => {
    // Create a minimal valid TGA buffer (uncompressed 1x1 RGB)
    const width = 1;
    const height = 1;
    const header = new Uint8Array(18);
    header[2] = 2; // Uncompressed RGB
    header[12] = width & 0xFF;
    header[14] = height & 0xFF;
    header[16] = 24; // 24 bpp
    header[17] = 0x20; // Top-left origin

    const pixels = new Uint8Array([0, 0, 255]); // Red (BGR)
    const buffer = new Uint8Array(header.length + pixels.length);
    buffer.set(header);
    buffer.set(pixels, 18);

    // Mock VFS response
    (vfs.readFile as any).mockResolvedValue(buffer.buffer);

    const texture: PreparedTexture = await manager.loadTexture('textures/test.tga');

    expect(vfs.readFile).toHaveBeenCalledWith('textures/test.tga');
    expect(texture).toBeDefined();
    expect(texture.width).toBe(1);
    expect(texture.height).toBe(1);
    expect(texture.source).toBe('tga');
    expect(texture.levels[0].rgba[0]).toBe(255); // R
    expect(texture.levels[0].rgba[1]).toBe(0);   // G
    expect(texture.levels[0].rgba[2]).toBe(0);   // B
    expect(texture.levels[0].rgba[3]).toBe(255); // A (default for 24-bit)
  });

  it('should cache TGA textures', async () => {
    const width = 1;
    const height = 1;
    const header = new Uint8Array(18);
    header[2] = 2; // Uncompressed RGB
    header[12] = width & 0xFF;
    header[14] = height & 0xFF;
    header[16] = 24;
    header[17] = 0x20;
    const pixels = new Uint8Array([0, 0, 255]);
    const buffer = new Uint8Array(header.length + pixels.length);
    buffer.set(header);
    buffer.set(pixels, 18);

    (vfs.readFile as any).mockResolvedValue(buffer.buffer);

    const t1 = await manager.loadTexture('textures/test.tga');
    const t2 = await manager.loadTexture('textures/test.tga');

    expect(t1).toBe(t2);
    expect(vfs.readFile).toHaveBeenCalledTimes(1);
  });
});
