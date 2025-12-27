import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../src/entities/system.js';
import { SelectSpawnPoint, SelectDeathmatchSpawnPoint } from '../src/entities/spawn.js';
import { createGame } from '../src/index.js';
import { createGameImportsAndEngine, createPlayerEntityFactory, createEntityFactory, createSpawnTestContext, spawnEntity, createRandomGenerator } from '@quake2ts/test-utils';
import { RandomGenerator } from '@quake2ts/shared';

describe('Deathmatch Spawn', () => {
    let entities: EntitySystem;
    let mockRng: RandomGenerator;

    beforeEach(() => {
        // We use createSpawnTestContext to get a standard context/engine/imports
        const context = createSpawnTestContext();

        // Create a mock RNG using helper if possible, or manual mock for control
        // Since we need to mock return values specifically for the test logic:
        mockRng = {
            frandom: vi.fn(() => 0.5),
            crandom: vi.fn(() => 0),
            frandomRange: vi.fn(() => 0),
            frandomMax: vi.fn(() => 0),
            crandomOpen: vi.fn(() => 0),
            irandomUint32: vi.fn(() => 0),
            irandomRange: vi.fn(() => 0),
            irandom: vi.fn(() => 0),
            randomTimeRange: vi.fn(() => 0),
            randomTime: vi.fn(() => 0),
            randomIndex: vi.fn((container: { length: number }) => 1),
            seed: vi.fn(),
            getState: vi.fn(),
            setState: vi.fn(),
        } as unknown as RandomGenerator;

        // Construct EntitySystem with the mock RNG to control selection
        entities = new EntitySystem(
            context.engine,
            undefined, // imports
            undefined, // gravity
            undefined, // maxEntities
            undefined, // allocator
            true, // deathmatch
            1, // skill
            mockRng
        );
    });

    it('SelectDeathmatchSpawnPoint should return a random spawn point', () => {
        const s1 = spawnEntity(entities, createEntityFactory({
            classname: 'info_player_deathmatch',
            origin: { x: 100, y: 0, z: 0 }
        }));

        const s2 = spawnEntity(entities, createEntityFactory({
            classname: 'info_player_deathmatch',
            origin: { x: 200, y: 0, z: 0 }
        }));

        // Entities are inserted at the head of the list.
        // So the list order is [s2, s1].
        // index 0 -> s2
        // index 1 -> s1

        const spots = entities.findByClassname('info_player_deathmatch');
        expect(spots.length).toBe(2);
        expect(spots[0]).toBe(s2);
        expect(spots[1]).toBe(s1);

        // We want to select s2 (index 0).
        // SelectDeathmatchSpawnPoint uses floor(frandom() * count).
        // Set frandom to 0.25. floor(0.25 * 2) = 0.
        (mockRng.frandom as any).mockReturnValue(0.25);

        const selected = SelectDeathmatchSpawnPoint(entities);
        expect(selected).toBe(s2);
    });

    it('SelectDeathmatchSpawnPoint should fall back to info_player_start if no deathmatch spots', () => {
        const start = spawnEntity(entities, createEntityFactory({
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

        const spawn = spawnEntity(game.entities, createEntityFactory({
            classname: 'info_player_deathmatch',
            origin: { x: 500, y: 500, z: 500 },
            angles: { x: 0, y: 90, z: 0 }
        }));

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
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
