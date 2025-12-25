import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../src/entities/system.js';
import { Entity } from '../src/entities/entity.js';
import { SelectSpawnPoint, SelectDeathmatchSpawnPoint } from '../src/entities/spawn.js';
import { createGame } from '../src/index.js';
import { createGameImportsAndEngine, createPlayerEntityFactory, createEntityFactory } from '@quake2ts/test-utils';

describe('Deathmatch Spawn', () => {
    let entities: EntitySystem;
    let mockRng: any;

    beforeEach(() => {
        const { engine } = createGameImportsAndEngine();

        mockRng = {
            frandom: vi.fn(() => 0.5),
            random: vi.fn(() => 0.5)
        };

        entities = new EntitySystem(engine, undefined, undefined, undefined, undefined, true, 1, mockRng); // Deathmatch = true
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

        const spots = entities.findByClassname('info_player_deathmatch');
        // If frandom returns 0.5, index = floor(0.5 * 2) = 1.
        // But findByClassname order might depend on internal implementation.
        // Assuming push order is preserved.
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

        // SelectDeathmatchSpawnPoint returns undefined if no DM spots.
        // We should test SelectSpawnPoint which includes the fallback logic.
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

        // Mock SelectSpawnPoint implicitly by having a spawn point
        const spawn = game.entities.spawn();
        Object.assign(spawn, createEntityFactory({
            classname: 'info_player_deathmatch',
            origin: { x: 500, y: 500, z: 500 },
            angles: { x: 0, y: 90, z: 0 }
        }));

        // Create a player using factories
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
