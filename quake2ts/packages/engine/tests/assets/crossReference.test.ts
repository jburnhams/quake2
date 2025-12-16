import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetCrossReference } from '../../src/assets/crossReference.js';
import { VirtualFileSystem } from '../../src/assets/vfs.js';
import { AssetManager } from '../../src/assets/manager.js';
import { BspLump } from '../../src/assets/bsp.js';

// Mock dependencies
const mockVfs = {
    readFile: vi.fn(),
    resolvePath: vi.fn(p => p),
    exists: vi.fn(),
    readDirectory: vi.fn()
} as unknown as VirtualFileSystem;

const mockAssetManager = {} as unknown as AssetManager;

// Helper to create a minimal valid BSP buffer
// We only need headers and specific lumps (Entities, TexInfo) to be valid-ish
function createMockBspBuffer(entities: string, textures: string[]): ArrayBuffer {
    // This is complex to mock binary BSP data.
    // Instead, we will mock `parseBsp` to return a structured object
    // so we don't have to build binary blobs.
    return new ArrayBuffer(100);
}

// Mock parseBsp
vi.mock('../../src/assets/bsp.js', async () => {
    const original = await vi.importActual('../../src/assets/bsp.js');
    return {
        ...original,
        parseBsp: vi.fn()
    };
});

import { parseBsp } from '../../src/assets/bsp.js';

describe('AssetCrossReference', () => {
    let crossRef: AssetCrossReference;

    beforeEach(() => {
        crossRef = new AssetCrossReference(mockVfs, mockAssetManager);
        vi.clearAllMocks();
    });

    it('should extract dependencies from a map', async () => {
        const mapName = 'maps/test.bsp';
        const mockBuffer = new ArrayBuffer(10);

        (mockVfs.readFile as any).mockResolvedValue(mockBuffer);

        (parseBsp as any).mockReturnValue({
            texInfo: [
                { texture: 'textures/wall1' },
                { texture: 'textures/floor1' }
            ],
            entities: {
                entities: [
                    {
                        classname: 'worldspawn',
                        properties: {}
                    },
                    {
                        classname: 'func_button',
                        properties: {
                            model: '*1', // Inline model, should be ignored
                            sound: 'switches/click.wav'
                        }
                    },
                    {
                        classname: 'misc_model',
                        properties: {
                            model: 'models/statue.md2'
                        }
                    }
                ]
            }
        });

        const deps = await crossRef.getMapDependencies(mapName);

        expect(deps.textures).toContain('textures/wall1');
        expect(deps.textures).toContain('textures/floor1');

        expect(deps.models).toContain('models/statue.md2');
        expect(deps.models).not.toContain('*1'); // Inline ignored

        expect(deps.sounds).toContain('switches/click.wav');
    });

    it('should handle missing map file', async () => {
        (mockVfs.readFile as any).mockResolvedValue(null);
        await expect(crossRef.getMapDependencies('missing.bsp')).rejects.toThrow();
    });
});
