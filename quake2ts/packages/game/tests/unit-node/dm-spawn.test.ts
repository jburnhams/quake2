import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectSpawnPoint, SelectDeathmatchSpawnPoint } from '../../src/entities/spawn.js';
import { createGameImportsAndEngine, createPlayerEntityFactory, createEntityFactory, spawnEntity, createTestContext, createTestGame } from '@quake2ts/test-utils';

describe('Deathmatch Spawn', () => {
    let context: ReturnType<typeof createTestContext>;

    beforeEach(() => {
        // Use createTestContext which sets up EntitySystem with a mockable RNG
        context = createTestContext();
        context.entities.deathmatch = true;
    });

    it('SelectDeathmatchSpawnPoint should return a random spawn point', () => {
        const s1 = spawnEntity(context.entities, createEntityFactory({
            classname: 'info_player_deathmatch',
            origin: { x: 100, y: 0, z: 0 }
        }));

        const s2 = spawnEntity(context.entities, createEntityFactory({
            classname: 'info_player_deathmatch',
            origin: { x: 200, y: 0, z: 0 }
        }));

        const spots = context.entities.findByClassname('info_player_deathmatch');
        expect(spots.length).toBe(2);

        // Spy on the rng in the context
        vi.spyOn(context.entities.rng, 'frandom').mockReturnValue(0.25);

        const selected = SelectDeathmatchSpawnPoint(context.entities);
        // logic: floor(0.25 * 2) = 0. spots[0] is s1 (first spawned) or s2 (second spawned)?
        // EntitySystem.spawn pushes to array.
        // findByClassname filters that array.
        // s1 spawned first -> index 0. s2 spawned second -> index 1.
        expect(selected).toBe(s1);
    });

    it('SelectDeathmatchSpawnPoint should fall back to info_player_start if no deathmatch spots', () => {
        const start = spawnEntity(context.entities, createEntityFactory({
            classname: 'info_player_start',
            origin: { x: 10, y: 10, z: 10 }
        }));

        const selected = SelectSpawnPoint(context.entities);
        expect(selected).toBe(start);
    });
});

describe('GameExports Respawn', () => {
    it('respawn should reset player state', () => {
        const { game } = createTestGame({
            config: { deathmatch: true }
        });

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
