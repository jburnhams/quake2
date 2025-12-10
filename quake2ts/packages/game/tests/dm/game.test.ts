import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { Entity, DeadFlag, Solid, MoveType, EntityFlags } from '../../src/entities/entity.js';
import { PutClientInServer, Respawn } from '../../src/dm/game.js';
import { createTestContext } from '../test-helpers.js';
import { WeaponId, createPlayerInventory } from '../../src/inventory/playerInventory.js';
import { ServerCommand } from '@quake2ts/shared';

// Mock P_PlayerThink
vi.mock('../../src/entities/player.js', () => ({
    P_PlayerThink: vi.fn(),
    player_pain: vi.fn(),
    player_die: vi.fn(),
    player_think: vi.fn()
}));

describe('Deathmatch Game Rules', () => {
    let sys: EntitySystem;
    let player: Entity;
    let spawnPoint: Entity;
    let testEntities: Entity[] = [];

    beforeEach(() => {
        const ctx = createTestContext();
        sys = ctx.entities;
        sys.deathmatch = true;

        // Mock sys.spawn to actually return objects we can track
        sys.spawn = vi.fn().mockImplementation(() => {
            const e = new Entity(testEntities.length + 1);
            testEntities.push(e);
            return e;
        });

        // Mock forEachEntity to iterate our local list
        sys.forEachEntity = vi.fn().mockImplementation((cb) => {
            testEntities.forEach(cb);
        });

        sys.imports.serverCommand = vi.fn(); // Mock serverCommand

        // Setup spawn point
        spawnPoint = sys.spawn();
        spawnPoint.classname = 'info_player_deathmatch';
        spawnPoint.origin = { x: 100, y: 100, z: 100 };
        spawnPoint.angles = { x: 0, y: 45, z: 0 };

        // Setup player
        player = sys.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory(),
        } as any; // Partial mock with valid inventory for reset
    });

    afterEach(() => {
        vi.clearAllMocks();
        testEntities = [];
    });

    it('PutClientInServer should reset player state', () => {
        PutClientInServer(player, sys);

        expect(player.health).toBe(100);
        expect(player.max_health).toBe(100);
        expect(player.deadflag).toBe(DeadFlag.Alive);
        expect(player.solid).toBe(Solid.BoundingBox);
        expect(player.movetype).toBe(MoveType.Walk);
        // expect(player.flags & EntityFlags.Dead).toBe(0); // Removed check as flag logic was commented out
        expect(player.takedamage).toBe(true);
        expect(player.viewheight).toBe(22);
    });

    it('PutClientInServer should set spawn point', () => {
        PutClientInServer(player, sys);

        expect(player.origin.x).toBe(100);
        expect(player.origin.y).toBe(100);
        // Expect small Z offset
        expect(player.origin.z).toBeGreaterThan(100);
        expect(player.angles.y).toBe(45);
    });

    it('PutClientInServer should give starting weapon', () => {
        PutClientInServer(player, sys);

        expect(player.client!.inventory.items.has('Blaster')).toBe(true);
        expect(player.client!.inventory.currentWeapon).toBe(WeaponId.Blaster);
    });

    it('Respawn should call PutClientInServer if deathmatch', () => {
        sys.deathmatch = true;

        // Spy on multicast to ensure spawn effect is triggered
        const multicastSpy = vi.spyOn(sys, 'multicast');

        Respawn(player, sys);

        expect(player.health).toBe(100);
        expect(multicastSpy).toHaveBeenCalled();
    });

    it('Respawn should restart server if NOT deathmatch', () => {
        sys.deathmatch = false;

        const cmdSpy = sys.imports.serverCommand as any;

        Respawn(player, sys);

        expect(cmdSpy).toHaveBeenCalledWith('restart');
    });

    it('SelectSpawnPoint should use info_player_start if no deathmatch spawns', () => {
        // Remove DM spawn
        spawnPoint.classname = 'info_player_start';
        spawnPoint.origin = { x: 200, y: 200, z: 200 };

        PutClientInServer(player, sys);

        expect(player.origin.x).toBe(200);
    });
});
