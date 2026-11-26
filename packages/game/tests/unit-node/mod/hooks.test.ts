import { describe, it, expect, vi } from 'vitest';
import { ModAPI } from '../../../src/mod.js';
import { createTestGame } from '@quake2ts/test-utils';

describe('Mod Initialization Hooks', () => {
    it('should allow setting and calling onModInit', () => {
        const { game } = createTestGame();

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
        const { game } = createTestGame();

        const modShutdownSpy = vi.fn();
        game.onModShutdown = modShutdownSpy;

        if (game.onModShutdown) {
            game.onModShutdown('my-mod');
        }

        expect(modShutdownSpy).toHaveBeenCalledWith('my-mod');
    });
});
