import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem, Entity } from '../../src/entities/system.js';
import { SelectSpawnPoint, SelectDeathmatchSpawnPoint } from '../../src/entities/spawn.js';
import { createGame } from '../../src/index.js';
import { createRandomGenerator } from '@quake2ts/shared';

describe('Deathmatch Spawn', () => {
    let entities: EntitySystem;
    let mockRng: any;

    beforeEach(() => {
        const engine = {
            soundIndex: vi.fn(),
            modelIndex: vi.fn(),
        } as any;

        mockRng = {
            frandom: vi.fn(() => 0.5),
            random: vi.fn(() => 0.5)
        };

        entities = new EntitySystem(engine, undefined, undefined, undefined, undefined, true, 1, mockRng); // Deathmatch = true
    });

    it('SelectDeathmatchSpawnPoint should return a random spawn point', () => {
        const s1 = entities.spawn();
        s1.classname = 'info_player_deathmatch';
        s1.origin = { x: 100, y: 0, z: 0 };

        const s2 = entities.spawn();
        s2.classname = 'info_player_deathmatch';
        s2.origin = { x: 200, y: 0, z: 0 };

        // With 0.5, it should pick index 1 (s2)
        const selected = SelectDeathmatchSpawnPoint(entities);
        expect(selected).toBe(s2);
    });

    it('SelectDeathmatchSpawnPoint should fall back to info_player_start if no deathmatch spots', () => {
        const start = entities.spawn();
        start.classname = 'info_player_start';
        start.origin = { x: 10, y: 10, z: 10 };

        const selected = SelectDeathmatchSpawnPoint(entities);
        expect(selected).toBe(start);
    });
});

describe('GameExports Respawn', () => {
    it('respawn should reset player state', () => {
        const game = createGame({}, {} as any, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: true });

        // Mock SelectSpawnPoint implicitly by having a spawn point
        const spawn = game.entities.spawn();
        spawn.classname = 'info_player_deathmatch';
        spawn.origin = { x: 500, y: 500, z: 500 };
        spawn.angles = { x: 0, y: 90, z: 0 };

        // Create a player
        const player = game.entities.spawn();
        player.client = {
            inventory: {
                ammo: { counts: [], caps: [] },
                ownedWeapons: new Set(),
                powerups: new Map(),
                keys: new Set(),
                items: new Set()
            },
            weaponStates: [] as any,
            pers: {} as any,
            buttons: 0,
            pm_type: 0,
            pm_time: 0,
            pm_flags: 0,
            gun_frame: 0,
            rdflags: 0,
            fov: 90
        };
        player.health = 0;
        player.deadflag = 2; // Dead

        game.respawn(player);

        expect(player.health).toBe(100);
        expect(player.deadflag).toBe(0);
        expect(player.origin.x).toBe(500);
        expect(player.origin.y).toBe(500);
        expect(player.origin.z).toBe(500);
        expect(player.classname).toBe('player');
    });
});
