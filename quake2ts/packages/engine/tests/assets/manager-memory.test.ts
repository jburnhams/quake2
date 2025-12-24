import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetManager } from '../../src/assets/manager.js';
import { VirtualFileSystem } from '../../src/assets/vfs.js';

describe('AssetManager Memory Budget', () => {
    let vfs: VirtualFileSystem;
    let manager: AssetManager;

    beforeEach(() => {
        vfs = new VirtualFileSystem();
        manager = new AssetManager(vfs, {
            textureCacheCapacity: 10,
            textureMemoryLimit: 1000
        });
    });

    it('should update texture cache limits when budget is enforced', () => {
        manager.enforceMemoryBudget({
            textureCacheCapacity: 5,
            textureMemoryLimit: 500
        });

        // We can verify this by checking the underlying cache properties if exposed,
        // or by observing behavior (eviction).
        // Since TextureCache wraps LruCache and we added getters/setters, let's verify via behavior.

        // Assuming TextureCache exposes capacity/maxMemory getters via our changes (we added setters, let's check getters)
        expect(manager.textures.capacity).toBe(5);
        expect(manager.textures.maxMemory).toBe(500);
    });

    it('should update audio cache capacity when budget is enforced', () => {
        manager.enforceMemoryBudget({
            audioCacheSize: 20
        });

        // Since AudioRegistry now has a capacity setter
        expect(manager.audio.capacity).toBe(20);
    });
});
