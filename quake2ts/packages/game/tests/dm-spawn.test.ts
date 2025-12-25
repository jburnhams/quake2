import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../src/entities/system.js';
import { SelectSpawnPoint, SelectDeathmatchSpawnPoint } from '../src/entities/spawn.js';
import { createGame } from '../src/index.js';
import { createGameImportsAndEngine, createPlayerEntityFactory, createEntityFactory, createSpawnTestContext, TestContext } from '@quake2ts/test-utils';

describe('Deathmatch Spawn', () => {
    let entities: EntitySystem;

    beforeEach(() => {
        // Task 2.5: Cleanup context creation.
        // We use createSpawnTestContext to get a standard context.
        // Then we can use its mocked entities.
        // Note: The original test manually constructed EntitySystem to test internal storage logic (findByClassname).
        // createTestContext provides a mock EntitySystem that simulates findByClassname using an array,
        // which is sufficient for this test.

        const context = createSpawnTestContext();

        // We need to ensure the RNG behaves deterministically for the test logic below.
        // createTestContext already mocks the RNG, but we want specific return values.
        // The mock RNG in createTestContext is a real seeded generator.
        // We want to override it with specific mocks for these tests.

        // However, entities.rng is readonly in the interface, but we can cast or modify the mock.
        // The context.entities.rng is created via createRandomGenerator({ seed }).
        // We want to spy on it or replace it.

        // Ideally, we should inject our mock RNG.
        // Since createTestContext doesn't accept a custom RNG, we'll manually construct EntitySystem
        // using the engine from context, but with our mock RNG, to keep the test clean and focused on
        // the RNG logic it's verifying.

        const mockRng = {
            frandom: vi.fn(() => 0.5),
            random: vi.fn(() => 0.5),
            crandom: vi.fn(() => 0),
            vrandom: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
            randomInt: vi.fn(() => 0)
        };

        // We reuse the engine mock from the context to avoid duplicating that setup.
        entities = new EntitySystem(
            context.engine,
            undefined,
            undefined,
            undefined,
            undefined,
            true, // deathmatch
            1,
            mockRng
        );
    });

    it('SelectDeathmatchSpawnPoint should return a random spawn point', () => {
        const s1 = entities.spawn();
        Object.assign(s1, createEntityFactory({
            classname: 'info_player_deathmatch',
            origin: { x: 100, y: 0, z: 0 }
        }));

        const s2 = entities.spawn();
        Object.assign(s2, createEntityFactory({
            classname: 'info_player_deathmatch',
            origin: { x: 200, y: 0, z: 0 }
        }));

        // The mocked RNG returns 0.5, so it should select the second spot (index 1)
        const spots = entities.findByClassname('info_player_deathmatch');
        const expected = spots[1];

        const selected = SelectDeathmatchSpawnPoint(entities);
        expect(selected).toBe(expected);
    });

    it('SelectDeathmatchSpawnPoint should fall back to info_player_start if no deathmatch spots', () => {
        const start = entities.spawn();
        Object.assign(start, createEntityFactory({
            classname: 'info_player_start',
            origin: { x: 10, y: 10, z: 10 }
        }));

        const selected = SelectSpawnPoint(entities);
        expect(selected).toBe(start);
    });
});

describe('GameExports Respawn', () => {
    it('respawn should reset player state', () => {
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: true });

        // Force RNG to return 0 to pick the first spot deterministically
        vi.spyOn(game.random, 'frandom').mockReturnValue(0);

        const spawn = game.entities.spawn();
        Object.assign(spawn, createEntityFactory({
            classname: 'info_player_deathmatch',
            origin: { x: 500, y: 500, z: 500 },
            angles: { x: 0, y: 90, z: 0 }
        }));

        const player = game.entities.spawn();
        Object.assign(player, createPlayerEntityFactory({
            health: 0,
            deadflag: 2 // Dead
        }));

        game.respawn(player);

        expect(player.health).toBe(100);
        expect(player.deadflag).toBe(0);
        expect(player.origin.x).toBe(500);
        expect(player.origin.y).toBe(500);
        expect(player.origin.z).toBe(500);
        expect(player.classname).toBe('player');
    });
});
