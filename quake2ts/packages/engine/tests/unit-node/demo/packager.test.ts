import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPackager, PackageOptions } from '../../../src/demo/packager.js';
import { VirtualFileSystem } from '../../../src/assets/vfs.js';
import { PakWriter } from '../../../src/assets/pakWriter.js';
import { Offset } from '../../../src/demo/types.js';

// Mocks
vi.mock('../../../src/assets/vfs.js');
vi.mock('../../../src/demo/clipper.js', () => {
    return {
        DemoClipper: class {
            constructor() {
                return {
                    extractClip: vi.fn().mockReturnValue(new Uint8Array(100))
                };
            }
        }
    };
});
vi.mock('../../../src/demo/optimalClipFinder.js', () => {
    return {
        OptimalClipFinder: class {
            constructor() {
                return {
                    findMinimalWindow: vi.fn().mockResolvedValue({ start: { type: 'frame', frame: 0 }, end: { type: 'frame', frame: 100 } })
                };
            }
        }
    };
});

// Mock visibility analyzer to return different sets for visible vs loaded
vi.mock('../../../src/assets/visibilityAnalyzer.js', () => {
    return {
        ResourceVisibilityAnalyzer: class {
            constructor() {
                return {
                    analyzeDemo: vi.fn().mockResolvedValue({
                        frames: new Map([
                            [0, {
                                models: new Set(['models/test.md2', 'models/hidden.md2']),
                                sounds: new Set(['sound/test.wav']),
                                textures: new Set(),
                                loaded: new Set(),
                                visible: new Set(['models/test.md2']), // visible only has test.md2
                                audible: new Set(['sound/test.wav'])
                            }]
                        ]),
                        time: new Map()
                    })
                };
            }
        }
    };
});

describe('DemoPackager', () => {
    let packager: DemoPackager;
    let mockVfs: any;

    beforeEach(() => {
        mockVfs = {
            readFile: vi.fn().mockImplementation((path) => {
                if (path === 'models/test.md2') return Promise.resolve(new Uint8Array(1024));
                if (path === 'models/hidden.md2') return Promise.resolve(new Uint8Array(2048));
                if (path === 'sound/test.wav') return Promise.resolve(new Uint8Array(512));
                return Promise.resolve(null);
            })
        };
        packager = new DemoPackager();
    });

    it('should create a package with demo and resources', async () => {
        const options: PackageOptions = {
            demoSource: new Uint8Array(2000),
            sourcePaks: mockVfs as VirtualFileSystem,
            range: {
                start: { type: 'frame', frame: 0 } as Offset,
                end: { type: 'frame', frame: 100 } as Offset
            }
        };

        const result = await packager.extractDemoPackage(options);

        expect(result.demoData).toBeDefined();
        expect(result.pakData).toBeDefined();
        expect(result.manifest).toBeDefined();

        // Default level is MINIMAL, so only visible items
        expect(result.manifest.resources['models/test.md2']).toBeDefined();
        expect(result.manifest.resources['sound/test.wav']).toBeDefined();
        expect(result.manifest.resources['models/hidden.md2']).toBeUndefined(); // Should be excluded in minimal
    });

    it('should handle missing resources gracefully', async () => {
        mockVfs.readFile.mockResolvedValue(null);

        const options: PackageOptions = {
            demoSource: new Uint8Array(2000),
            sourcePaks: mockVfs as VirtualFileSystem,
            range: { start: { type: 'frame', frame: 0 } as Offset, end: { type: 'frame', frame: 10 } as Offset }
        };

        const result = await packager.extractDemoPackage(options);

        expect(Object.keys(result.manifest.resources).length).toBe(0);
        expect(result.pakData.length).toBeGreaterThan(0);
    });

    it('should include non-visible resources in SAFE/COMPLETE mode', async () => {
        const options: PackageOptions = {
            demoSource: new Uint8Array(2000),
            sourcePaks: mockVfs as VirtualFileSystem,
            range: { start: { type: 'frame', frame: 0 } as Offset, end: { type: 'frame', frame: 100 } as Offset },
            level: 'SAFE'
        };

        const result = await packager.extractDemoPackage(options);

        expect(result.manifest.resources['models/test.md2']).toBeDefined();
        expect(result.manifest.resources['models/hidden.md2']).toBeDefined(); // Included in SAFE
    });

    it('should support ULTRA optimization level (stub)', async () => {
        const options: PackageOptions = {
            demoSource: new Uint8Array(2000),
            sourcePaks: mockVfs as VirtualFileSystem,
            range: { start: { type: 'frame', frame: 0 } as Offset, end: { type: 'frame', frame: 100 } as Offset },
            level: 'ULTRA'
        };

        const result = await packager.extractDemoPackage(options);

        // Just verify it runs and returns resources
        expect(result.manifest.resources['models/test.md2']).toBeDefined();
        expect(result.manifest.metadata.optimizationLevel).toBe('ULTRA');
    });
});
