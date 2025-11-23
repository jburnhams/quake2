// =================================================================
// Quake II - Weapon System Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import { createPlayerWeaponStates } from '../../src/combat/index.js';
import { getWeaponState } from '../../src/combat/weapons/state.js';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { vi } from 'vitest';

describe('Weapon System', () => {
    it('should get the weapon state', () => {
        const weaponStates = createPlayerWeaponStates();
        const state = getWeaponState(weaponStates, WeaponId.Blaster);
        expect(state.lastFireTime).toBe(0);
    });

    it('should fire a weapon', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        // Spawn a player start point so spawnWorld creates a player
        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();
        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Shotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });

        fire(game, player, WeaponId.Shotgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(9);
    });
});
