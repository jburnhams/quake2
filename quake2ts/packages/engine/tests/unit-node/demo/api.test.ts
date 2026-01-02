import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoOptimizerApi, ClipCriteria } from '../../../src/demo/api.js';
import { PakArchive } from '../../../src/assets/pak.js';

// Mocks
vi.mock('../../../src/assets/pak.js', async () => {
    return {
        PakArchive: {
            fromArrayBuffer: vi.fn()
        }
    };
});

vi.mock('../../../src/demo/packager.js', () => {
    return {
        DemoPackager: class {
            constructor() {
                return {
                    extractDemoPackage: vi.fn().mockResolvedValue({
                        demoData: new Uint8Array(100),
                        pakData: new Uint8Array(200),
                        manifest: { resources: {} }
                    })
                };
            }
        }
    };
});
vi.mock('../../../src/demo/clipper.js', () => {
    return {
        DemoClipper: class {
            constructor() {
                return {
                    extractClip: vi.fn().mockReturnValue(new Uint8Array(50))
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
                    findOptimalWindows: vi.fn().mockResolvedValue([{
                        start: { type: 'time', seconds: 10 },
                        end: { type: 'time', seconds: 20 },
                        score: 100
                    }])
                };
            }
        }
    };
});

vi.mock('../../../src/demo/analyzer.js', () => {
    return {
        DemoAnalyzer: class {
            constructor() {
                return {
                    analyze: vi.fn().mockReturnValue({
                        statistics: { duration: 120 },
                        events: [],
                        summary: {}
                    })
                };
            }
        }
    };
});

vi.mock('../../../src/assets/visibilityAnalyzer.js', () => {
    return {
        ResourceVisibilityAnalyzer: class {
            constructor() {
                return {
                    analyzeDemo: vi.fn().mockResolvedValue({ frames: new Map(), time: new Map() })
                };
            }
        }
    };
});


describe('DemoOptimizerApi', () => {
    let api: DemoOptimizerApi;

    beforeEach(() => {
        api = new DemoOptimizerApi();
        vi.clearAllMocks();
    });

    it('should create a demo clip', async () => {
        const demoData = new Uint8Array(1000);
        const clip = await api.createDemoClip(demoData, 10, 30);
        expect(clip).toBeDefined();
        expect(clip.length).toBe(50); // Mock return
    });

    it('should create an optimal demo package', async () => {
        const demoData = new Uint8Array(1000);
        const pakFiles = [{ name: 'pak0.pak', data: new Uint8Array(500) }];
        const criteria: ClipCriteria = { duration: 60 };

        // Mock PakArchive.fromArrayBuffer static method
        const mockArchiveInstance = {
            name: 'pak0.pak',
            size: 500,
            listEntries: vi.fn().mockReturnValue([]),
            readFile: vi.fn().mockReturnValue(new Uint8Array(0))
        };

        // @ts-ignore
        PakArchive.fromArrayBuffer = vi.fn().mockReturnValue(mockArchiveInstance);

        const pkg = await api.createOptimalDemoPackage(demoData, pakFiles, criteria);

        expect(pkg).toBeDefined();
        expect(pkg.demoData).toBeDefined();
        expect(pkg.pakData).toBeDefined();
        expect(PakArchive.fromArrayBuffer).toHaveBeenCalled();
    });

    it('should analyze a demo', async () => {
        const demoData = new Uint8Array(1000);
        const report = await api.analyzeDemo(demoData);

        expect(report).toBeDefined();
        expect(report.summary.duration).toBe(120); // From mock
        expect(report.optimalWindows.length).toBeGreaterThan(0);
    });

    it('should find best clips based on criteria', async () => {
        const demoData = new Uint8Array(1000);
        const criteria: ClipCriteria = { duration: 30, minAction: 50 };
        const clips = await api.findBestClips(demoData, criteria);

        expect(clips).toBeDefined();
        expect(clips.length).toBe(1);
    });
});
