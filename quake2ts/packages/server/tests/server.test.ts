import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer, createServer } from '../src/dedicated.js';
import { createMockTransport, MockTransport } from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn().mockResolvedValue(Buffer.alloc(100))
    }
}));

// Must import makeBspModel inside the mock factory to avoid hoisting issues
vi.mock('@quake2ts/engine', async (importOriginal) => {
    // We can't use the top-level import here because of hoisting.
    // So we need to either inline the object or import dynamically if possible,
    // but vitest mocks are synchronous usually.
    // However, since we are mocking a return value, we can just return a plain object that looks like what makeBspModel returns
    // OR we can rely on `await vi.importActual('@quake2ts/test-utils')` if we were mocking that module, but we are mocking `engine`.

    // The error says "Cannot access '__vi_import_1__' before initialization".
    // This is because `makeBspModel` is imported at top level but used in hoisted `vi.mock`.

    // Solution: Just return a plain object matching the structure, or move `makeBspModel` call inside the test or `beforeEach` and use `vi.mocked`.
    // But `parseBsp` is called internally by `DedicatedServer`.

    // Let's just define a minimal object here that satisfies the requirements to avoid complexity.
    return {
        parseBsp: vi.fn().mockReturnValue({
            planes: [],
            nodes: [],
            leafs: [],
            brushes: [],
            leafBrushes: [],
            bmodels: [],
            models: [],
            texInfo: [],
            brushSides: [],
            visibility: { numClusters: 0, clusters: [] }
        })
    };
});

describe('DedicatedServer', () => {
    let server: DedicatedServer;
    let transport: MockTransport;
    let consoleWarnSpy: any;
    let consoleLogSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        transport = createMockTransport();
        server = new DedicatedServer({ port: 27910, transport });

        // Suppress expected console warnings and logs
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (server) {
            server.stopServer();
        }
    });

    it('should create a server with default options', () => {
        server = createServer({ transport });
        expect(server).toBeInstanceOf(DedicatedServer);
    });

    it('should initialize WebSocketServer on start', async () => {
        await server.startServer('test_map');
        expect(transport.listenSpy).toHaveBeenCalledWith(27910);
    });

    it('should be able to stop', async () => {
        await server.startServer('test_map');
        server.stopServer();
        expect(transport.closeSpy).toHaveBeenCalled();
    });

    it('should fail to start without map', async () => {
        server = createServer({ transport });
        await expect(server.startServer()).rejects.toThrow('No map specified');
    });

    it('should kick player', () => {
        server = createServer({ transport });
        // Just verify method exists and runs safely on empty server
        expect(() => server.kickPlayer(0)).not.toThrow();
    });

    it('should change map', async () => {
        server = createServer({ transport });
        await server.startServer('maps/q2dm1.bsp');
        await expect(server.changeMap('maps/q2dm2.bsp')).resolves.not.toThrow();
    });
});
