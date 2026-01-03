import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { runCli } from '../../src/cli/demoOptimizer.js';
import * as fs from 'fs/promises';

// Mock dependencies
// Explicitly mock fs/promises to ensure they are mocks
vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn()
}));

vi.mock('../../src/demo/api.js', () => {
    return {
        DemoOptimizerApi: class {
            constructor() {
                return {
                    analyzeDemo: vi.fn().mockResolvedValue({ summary: { duration: 100 } }),
                    createDemoClip: vi.fn().mockResolvedValue(new Uint8Array(50)),
                    createOptimalDemoPackage: vi.fn().mockResolvedValue({
                        demoData: new Uint8Array(10),
                        pakData: new Uint8Array(20),
                        manifest: { resources: {} }
                    }),
                    findBestClips: vi.fn().mockResolvedValue([])
                };
            }
        }
    };
});

describe('DemoOptimizer CLI', () => {
    // Spy on console
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // cleanup
    });

    it('should handle analyze command', async () => {
        (fs.readFile as unknown as Mock).mockResolvedValue(new Uint8Array(100));
        await runCli(['analyze', 'test.dm2']);

        expect(fs.readFile).toHaveBeenCalledWith('test.dm2');
        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle extract command', async () => {
        (fs.readFile as unknown as Mock).mockResolvedValue(new Uint8Array(100));
        await runCli(['extract', 'test.dm2', '10', '20', '-o', 'out.dm2']);

        expect(fs.readFile).toHaveBeenCalledWith('test.dm2');
        expect(fs.writeFile).toHaveBeenCalledWith('out.dm2', expect.any(Uint8Array));
    });

    it('should handle optimize command', async () => {
        (fs.readFile as unknown as Mock).mockResolvedValue(new Uint8Array(100));
        (fs.mkdir as unknown as Mock).mockResolvedValue(undefined);
        await runCli(['optimize', 'test.dm2', 'pak0.pak', '-d', '60', '-o', 'pkg']);

        expect(fs.readFile).toHaveBeenCalledWith('test.dm2');
        expect(fs.readFile).toHaveBeenCalledWith('pak0.pak');
        expect(fs.mkdir).toHaveBeenCalledWith('pkg', expect.any(Object));
        expect(fs.writeFile).toHaveBeenCalledTimes(3); // demo, pak, manifest
    });
});
