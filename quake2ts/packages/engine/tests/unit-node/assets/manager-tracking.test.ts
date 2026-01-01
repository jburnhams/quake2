import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetManager } from '../../../src/assets/manager.js';
import { ResourceLoadTracker, ResourceType } from '../../../src/assets/resourceTracker.js';
import { VirtualFileSystem } from '../../../src/assets/vfs.js';

describe('AssetManager Tracking', () => {
  let vfs: VirtualFileSystem;
  let tracker: ResourceLoadTracker;
  let manager: AssetManager;

  beforeEach(() => {
    vfs = {
      readFile: vi.fn(),
      stat: vi.fn().mockReturnValue({ size: 123, sourcePak: 'pak0.pak' }),
      findByExtension: vi.fn(),
    } as unknown as VirtualFileSystem;

    tracker = new ResourceLoadTracker();
    vi.spyOn(tracker, 'recordLoad');

    manager = new AssetManager(vfs, { resourceTracker: tracker });
  });

  it('should track texture loads', async () => {
    // Mock VFS to return a minimal PCX (header only is enough for some parsers, but let's mock the return of parsePcx if possible, or just mock readFile and expect failure but check tracking first)
    // Actually, manager.loadTexture does tracking *before* calling internal loaders?
    // Let's check the code:
    /*
      async loadTexture(path: string): Promise<PreparedTexture> {
        if (this.resourceTracker) {
            const stats = this.vfs.stat(path);
            this.resourceTracker.recordLoad(ResourceType.Texture, path, stats?.size, stats?.sourcePak);
        }
        ...
    */
    // So even if it fails later, it should track.

    const texturePath = 'pics/test.pcx';
    (vfs.readFile as any).mockRejectedValue(new Error('File not found')); // Fail the load, but tracking happens before

    try {
        await manager.loadTexture(texturePath);
    } catch (e) {
        // Expected error
    }

    expect(tracker.recordLoad).toHaveBeenCalledWith(
        ResourceType.Texture,
        texturePath,
        123,
        'pak0.pak'
    );
  });

  it('should track sound loads', async () => {
    const soundPath = 'sound/jump.wav';
    (vfs.readFile as any).mockRejectedValue(new Error('File not found'));

    try {
        await manager.loadSound(soundPath);
    } catch (e) {
        // Expected error
    }

    expect(tracker.recordLoad).toHaveBeenCalledWith(
        ResourceType.Sound,
        soundPath,
        123,
        'pak0.pak'
    );
  });

  it('should track model loads (MD2)', async () => {
    const modelPath = 'models/test.md2';
    (vfs.readFile as any).mockRejectedValue(new Error('File not found'));

    try {
        await manager.loadMd2Model(modelPath);
    } catch (e) {
        // Expected error
    }

    expect(tracker.recordLoad).toHaveBeenCalledWith(
        ResourceType.Model,
        modelPath,
        123,
        'pak0.pak'
    );
  });

  it('should track model access via getMd2Model', () => {
    const modelPath = 'models/cached.md2';
    // getMd2Model is synchronous and returns undefined if not found
    manager.getMd2Model(modelPath);

    expect(tracker.recordLoad).toHaveBeenCalledWith(
        ResourceType.Model,
        modelPath,
        123,
        'pak0.pak'
    );
  });
});
