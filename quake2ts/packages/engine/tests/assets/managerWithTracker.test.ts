import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetManager } from '../../src/assets/manager';
import { ResourceLoadTracker, ResourceType } from '../../src/assets/resourceTracker';
import { VirtualFileSystem } from '../../src/assets/vfs';
import { PakArchive } from '../../src/assets/pak';

// Mock everything else to avoid complex setups
vi.mock('../../src/assets/md2', () => ({ Md2Loader: vi.fn().mockImplementation(() => ({ load: vi.fn(), get: vi.fn() })) }));
vi.mock('../../src/assets/md3', () => ({ Md3Loader: vi.fn().mockImplementation(() => ({ load: vi.fn(), get: vi.fn() })) }));
vi.mock('../../src/assets/sprite', () => ({ SpriteLoader: vi.fn().mockImplementation(() => ({ load: vi.fn() })) }));
vi.mock('../../src/assets/bsp', () => ({ BspLoader: vi.fn().mockImplementation(() => ({ load: vi.fn() })) }));
vi.mock('../../src/assets/texture', () => ({ TextureCache: vi.fn().mockImplementation(() => ({ get: vi.fn(), set: vi.fn(), clear: vi.fn() })) }));
vi.mock('../../src/assets/audio', () => ({ AudioRegistry: vi.fn().mockImplementation(() => ({ load: vi.fn(), clearAll: vi.fn() })) }));

describe('AssetManager with ResourceLoadTracker', () => {
  let vfs: VirtualFileSystem;
  let tracker: ResourceLoadTracker;
  let manager: AssetManager;

  beforeEach(() => {
    vfs = new VirtualFileSystem();
    tracker = new ResourceLoadTracker();
    tracker.startTracking();
    manager = new AssetManager(vfs, { resourceTracker: tracker });
  });

  it('should track texture loads', async () => {
    // Mock vfs to throw error so we fail fast after tracking call
    vi.spyOn(vfs, 'readFile').mockRejectedValue(new Error('Mock VFS Error'));

    try {
        await manager.loadTexture('textures/test.wal');
    } catch (e) {
        // Expected
    }

    const log = tracker.stopTracking();
    const entry = log.uniqueResources.get(`${ResourceType.Texture}:textures/test.wal`);
    expect(entry).toBeDefined();
    expect(entry?.type).toBe(ResourceType.Texture);
    expect(entry?.path).toBe('textures/test.wal');
  });

  it('should track sound loads', async () => {
    vi.spyOn(manager.audio, 'load').mockResolvedValue({} as any);

    await manager.loadSound('sound/test.wav');

    const log = tracker.stopTracking();
    expect(log.uniqueResources.get(`${ResourceType.Sound}:sound/test.wav`)).toBeDefined();
  });

  it('should track model loads', async () => {
    // We need to bypass missing dependency check or stub it
    vi.spyOn(manager['dependencyTracker'], 'missingDependencies').mockReturnValue([]);

    try {
        await manager.loadMd2Model('models/test.md2');
    } catch(e) {}

    const log = tracker.stopTracking();
    expect(log.uniqueResources.get(`${ResourceType.Model}:models/test.md2`)).toBeDefined();
  });

  it('should track map loads', async () => {
    try {
       await manager.loadMap('maps/test.bsp');
    } catch(e) {}

    const log = tracker.stopTracking();
    expect(log.uniqueResources.get(`${ResourceType.Map}:maps/test.bsp`)).toBeDefined();
  });
});
