
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lodRegistry, LodRegistry } from '../src/lod.js';

describe('LodRegistry', () => {
    let registry: LodRegistry;

    beforeEach(() => {
        registry = new LodRegistry();
    });

    it('should register and retrieve LOD models', () => {
        registry.register('models/monsters/soldier/tris.md2', [
            { distance: 500, model: 'models/monsters/soldier/lod1.md2' },
            { distance: 1000, model: 'models/monsters/soldier/lod2.md2' }
        ]);

        expect(registry.getLodModel('models/monsters/soldier/tris.md2', 100)).toBeUndefined();
        expect(registry.getLodModel('models/monsters/soldier/tris.md2', 600)).toBe('models/monsters/soldier/lod1.md2');
        expect(registry.getLodModel('models/monsters/soldier/tris.md2', 1200)).toBe('models/monsters/soldier/lod2.md2');
    });

    it('should handle unordered registration', () => {
        registry.register('models/test.md2', [
            { distance: 1000, model: 'models/lod2.md2' },
            { distance: 500, model: 'models/lod1.md2' }
        ]);

        expect(registry.getLodModel('models/test.md2', 600)).toBe('models/lod1.md2');
        expect(registry.getLodModel('models/test.md2', 1200)).toBe('models/lod2.md2');
    });

    it('should return undefined for unknown models', () => {
        expect(registry.getLodModel('unknown', 100)).toBeUndefined();
    });
});
