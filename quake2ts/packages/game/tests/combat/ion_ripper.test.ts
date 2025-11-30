// =================================================================
// Quake II - Ion Ripper Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import { createPlayerWeaponStates } from '../../src/combat/weapons/state.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { MulticastType } from '../../src/imports.js';
import { ServerCommand, TempEntity } from '@quake2ts/shared';

describe('Ion Ripper', () => {
    it('should fire a projectile, consume ammo, and set up bounce logic', () => {
        const trace = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const sound = vi.fn();
        const modelIndex = vi.fn().mockReturnValue(1);
        const createIonRipper = vi.spyOn(projectiles, 'createIonRipper');

        const engine = {
            trace,
            sound,
            centerprintf: vi.fn(),
            modelIndex,
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 }, rogue: true });
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.viewheight = 22;
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.IonRipper],
                ammo: { [AmmoType.Cells]: 50 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
        } as any;
        game.entities.finalizeSpawn(player);

        // Fire
        fire(game, player, WeaponId.IonRipper);

        // Ammo consumption: 2 cells
        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(48);

        // Projectile creation
        expect(createIonRipper).toHaveBeenCalledWith(
            expect.anything(),
            player,
            expect.anything(),
            expect.anything(),
            30, // damage
            500 // speed
        );

        // Find the projectile
        const projectile = game.entities.find(e => e.classname === 'ionripper');
        expect(projectile).toBeDefined();
        expect(projectile!.movetype).toBe(MoveType.WallBounce);

        // Verify touch function logic for bouncing
        const touch = projectile!.touch;
        expect(touch).toBeDefined();

        // Simulate a wall hit (other is null or world)
        // Pass system.world if possible, or null.
        // We need to check if count increments.
        projectile!.count = 0;
        touch!(projectile!, null, { normal: { x: 0, y: 0, z: 1 } } as any);

        expect(projectile!.count).toBe(1);
        expect(sound).toHaveBeenCalledWith(projectile!, 0, 'weapons/ripphit.wav', 1, 1, 0);

        // Max bounces check
        projectile!.count = 5;
        // Mock free
        const freeSpy = vi.spyOn(game.entities, 'free');
        touch!(projectile!, null, { normal: { x: 0, y: 0, z: 1 } } as any); // 6th bounce

        expect(projectile!.count).toBe(6); // technically it increments before check?
        // Logic: count = (count||0) + 1. if (count > 5) free.
        // So on 6th hit, it frees.
        expect(freeSpy).toHaveBeenCalledWith(projectile!);

    });
});
