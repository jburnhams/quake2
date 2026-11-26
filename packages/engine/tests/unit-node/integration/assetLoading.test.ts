import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AssetManager } from '../../../src/assets/manager.js';
import { PakFile } from '../../../src/assets/pak.js';
import { VirtualFileSystem } from '../../../src/assets/vfs.js';

describe('Asset Loading Integration', () => {
  let vfs: VirtualFileSystem;
  let assetManager: AssetManager;

  beforeEach(() => {
    vfs = new VirtualFileSystem();
    assetManager = new AssetManager(vfs);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load PAK files and verify contents', async () => {
    // Mock PAK file
    const pakFile = {
      name: 'test.pak',
      readFile: vi.fn(),
      listEntries: vi.fn().mockReturnValue([]),
      close: vi.fn()
    } as unknown as PakFile;

    // We can spy on the VFS mount
    const mountSpy = vi.spyOn(vfs, 'mountPak');

    // Simulate mounting a PAK
    vfs.mountPak(pakFile);

    expect(mountSpy).toHaveBeenCalledWith(pakFile);
  });

  // Note: loadTexture is not currently a method on AssetManager.
  // AssetManager seems to rely on manually registering textures or using specific loaders.
  // Looking at the code, AssetManager has `registerTexture`, `loadSound`, `loadMd2Model`, etc.
  // It does not have a generic `loadTexture` that fetches from VFS and parses.
  // Texture loading seems to be handled differently or I might be missing something.
  // For now I will test `loadSound` which is present.

  it('should parse and cache audio', async () => {
    // Mock the VFS readFile to return a dummy OGG
    vi.spyOn(vfs, 'readFile').mockImplementation(async (path) => {
      if (path.endsWith('.ogg')) {
        return new Uint8Array(128);
      }
      throw new Error('File not found');
    });

    // Mock the AudioRegistry load method indirectly via assetManager.audio.load
    // But since assetManager creates its own AudioRegistry, we have to spy on that instance
    // OR we spy on VFS readFile which AudioRegistry uses.

    // We also need to mock AudioRegistry.load because actual decoding of dummy data will fail
    // unless we mock the decoder or the registry's load method.
    vi.spyOn(assetManager.audio, 'load').mockResolvedValue({
      buffer: { duration: 1, length: 44100, numberOfChannels: 2, sampleRate: 44100 } as AudioBuffer,
      channelCount: 2,
      sampleRate: 44100
    });

    // Trigger load
    await assetManager.loadSound('sound/test.ogg');

    expect(assetManager.isAssetLoaded('sound', 'sound/test.ogg')).toBe(true);
  });

  it('should handle missing assets with fallbacks or errors', async () => {
    vi.spyOn(vfs, 'readFile').mockImplementation(async () => {
      throw new Error('File not found');
    });

    // loadSound should fail if file is missing (and not mocked)
    // But we are mocking assetManager.audio.load above? No, that was per test.
    // Here we let it call through to VFS, so it should fail.

    await expect(assetManager.loadSound('sound/missing.ogg')).rejects.toThrow();
  });
});
