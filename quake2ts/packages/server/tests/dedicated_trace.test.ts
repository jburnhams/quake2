import { describe, it, expect, vi, afterEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated.js';
import * as gameModule from '@quake2ts/game';
import { CollisionEntityIndex, traceBox } from '@quake2ts/shared';
import { createMockCollisionEntityIndex } from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('@quake2ts/shared', async () => {
    const actual = await vi.importActual<typeof import('@quake2ts/shared')>('@quake2ts/shared');
    return {
        ...actual,
        traceBox: vi.fn(),
        // Mock CollisionEntityIndex as a class constructor that returns a proxied mock object
        CollisionEntityIndex: class {
            constructor() {
                return createMockCollisionEntityIndex();
            }
        }
    };
});

describe('DedicatedServer Trace Integration', () => {
    let server: DedicatedServer;

    afterEach(() => {
        if (server) {
            // Restore mocked game object to have shutdown so stop() doesn't crash
            if ((server as any).game && !(server as any).game.shutdown) {
                (server as any).game.shutdown = vi.fn();
            }
            server.stop();
        }
        vi.restoreAllMocks();
    });

    it('should invoke CollisionEntityIndex.trace and resolve entity', async () => {
        const createGameSpy = vi.spyOn(gameModule, 'createGame');
        server = new DedicatedServer(27998); // Use different port

        // Setup mock for entity tracing
        const mockEntityIndex = (server as any).entityIndex;
        mockEntityIndex.trace.mockReturnValue({
            fraction: 0.5,
            allsolid: false,
            startsolid: false,
            endpos: { x: 50, y: 0, z: 0 },
            entityId: 10,
            contents: 1,
            surfaceFlags: 0,
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 50 }
        });

        // Start server
        await server.start('test.bsp');

        expect(createGameSpy).toHaveBeenCalled();
        const imports = createGameSpy.mock.calls[0][0] as any;

        // Mock game instance for entity lookup, INCLUDING shutdown for cleanup
        const mockEntity = { index: 10, classname: 'test_entity' };
        (server as any).game = {
            entities: {
                getByIndex: vi.fn().mockReturnValue(mockEntity)
            },
            shutdown: vi.fn()
        };

        // Call trace
        const traceResult = imports.trace(
            { x: 0, y: 0, z: 0 },
            { x: -16, y: -16, z: -24 },
            { x: 16, y: 16, z: 32 },
            { x: 100, y: 0, z: 0 },
            null,
            0xFFFFFFFF
        );

        // Verify entity index was called
        expect(mockEntityIndex.trace).toHaveBeenCalled();

        // Verify result contains the entity
        expect(traceResult.fraction).toBe(0.5);
        expect(traceResult.ent).toBe(mockEntity);
    });

    it('should fallback to world trace (via entityIndex) if entity trace is further', async () => {
        const createGameSpy = vi.spyOn(gameModule, 'createGame');
        server = new DedicatedServer(27999);

        // Setup mock for entity tracing to return a miss (entityId: null)
        const mockEntityIndex = (server as any).entityIndex;
        mockEntityIndex.trace.mockReturnValue({
            fraction: 0.3,
            allsolid: false,
            startsolid: false,
            endpos: { x: 30, y: 0, z: 0 },
            entityId: null
        });

        await server.start('test.bsp');
        const imports = createGameSpy.mock.calls[0][0] as any;

        // Mock game instance
        (server as any).game = {
            entities: {
                getByIndex: vi.fn().mockReturnValue({})
            },
            shutdown: vi.fn()
        };

        const traceResult = imports.trace(
            { x: 0, y: 0, z: 0 },
            null, null,
            { x: 100, y: 0, z: 0 },
            null,
            0xFFFFFFFF
        );

        // If entityIndex.trace returned entityId: null, then ent should be null.
        expect(traceResult.ent).toBeNull();
        expect(traceResult.fraction).toBe(0.3);
    });
});
