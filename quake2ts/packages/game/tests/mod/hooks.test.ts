import { describe, it, expect, vi } from 'vitest';
import { createGame, GameExports } from '../../src/index.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import type { GameImports } from '../../src/index.js';
import { ModAPI } from '../../src/mod.js';

describe('Mod Initialization Hooks', () => {
    it('should allow setting and calling onModInit', () => {
        const { entities: mockEntities } = createTestContext();
        const engine = mockEntities.engine;
        const imports: Partial<GameImports> = {
            trace: vi.fn(() => ({
                fraction: 1,
                ent: null,
                allsolid: false,
                startsolid: false,
                endpos: { x: 0, y: 0, z: 0 },
                plane: null,
                surfaceFlags: 0,
                contents: 0
            })),
            pointcontents: vi.fn(() => 0),
        };
        const options = { gravity: { x: 0, y: 0, z: -800 } };
        const game = createGame(imports, engine, options);

        const modInitSpy = vi.fn();
        game.onModInit = modInitSpy;

        // Simulate mod loader calling the hook
        // The game itself doesn't invoke this automatically in current scope (it's a library hook for the runner).
        // But we verify the property setter/getter works and can be invoked.

        if (game.onModInit) {
            game.onModInit('my-mod', {
                registerEntity: game.registerEntitySpawn.bind(game)
            } as ModAPI);
        }

        expect(modInitSpy).toHaveBeenCalledWith('my-mod', expect.objectContaining({
            registerEntity: expect.any(Function)
        }));
    });

    it('should allow setting and calling onModShutdown', () => {
        const { entities: mockEntities } = createTestContext();
        const engine = mockEntities.engine;
        const imports: Partial<GameImports> = {}; // Minimal imports
        const options = { gravity: { x: 0, y: 0, z: -800 } };
        const game = createGame(imports, engine, options);

        const modShutdownSpy = vi.fn();
        game.onModShutdown = modShutdownSpy;

        if (game.onModShutdown) {
            game.onModShutdown('my-mod');
        }

        expect(modShutdownSpy).toHaveBeenCalledWith('my-mod');
    });
});
