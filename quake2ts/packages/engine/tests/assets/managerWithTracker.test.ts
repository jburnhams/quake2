import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetManager } from '../../src/assets/manager';
import { ResourceLoadTracker, ResourceType } from '../../src/assets/resourceTracker';
import { VirtualFileSystem } from '../../src/assets/vfs';

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

    // Mock vfs.stat to return dummy metadata
    vi.spyOn(vfs, 'stat').mockImplementation((path) => {
        if (path === 'textures/test.wal') return { path, size: 1024, sourcePak: 'pak0.pak' };
        if (path === 'sound/test.wav') return { path, size: 2048, sourcePak: 'pak1.pak' };
        if (path === 'models/test.md2') return { path, size: 4096, sourcePak: 'pak0.pak' };
        if (path === 'maps/test.bsp') return { path, size: 8192, sourcePak: 'pak2.pak' };
        return undefined;
    });
  });

  it('should track texture loads with metadata', async () => {
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
    expect(entry?.size).toBe(1024);
    expect(entry?.pakSource).toBe('pak0.pak');
  });

  it('should track sound loads with metadata', async () => {
    vi.spyOn(manager.audio, 'load').mockResolvedValue({} as any);

    await manager.loadSound('sound/test.wav');

    const log = tracker.stopTracking();
    const entry = log.uniqueResources.get(`${ResourceType.Sound}:sound/test.wav`);
    expect(entry).toBeDefined();
    expect(entry?.size).toBe(2048);
    expect(entry?.pakSource).toBe('pak1.pak');
  });

  it('should track model loads with metadata', async () => {
    // We need to bypass missing dependency check or stub it
    vi.spyOn(manager['dependencyTracker'], 'missingDependencies').mockReturnValue([]);

    try {
        await manager.loadMd2Model('models/test.md2');
    } catch(e) {}

    const log = tracker.stopTracking();
    const entry = log.uniqueResources.get(`${ResourceType.Model}:models/test.md2`);
    expect(entry).toBeDefined();
    expect(entry?.size).toBe(4096);
    expect(entry?.pakSource).toBe('pak0.pak');
  });

  it('should track map loads with metadata', async () => {
    try {
       await manager.loadMap('maps/test.bsp');
    } catch(e) {}

    const log = tracker.stopTracking();
    const entry = log.uniqueResources.get(`${ResourceType.Map}:maps/test.bsp`);
    expect(entry).toBeDefined();
    expect(entry?.size).toBe(8192);
    expect(entry?.pakSource).toBe('pak2.pak');
  });
});
