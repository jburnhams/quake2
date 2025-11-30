// =================================================================
// Quake II - Phalanx Weapon Tests
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

describe('Phalanx', () => {
    it('should fire 2 projectiles, consume ammo, and set up radius damage', () => {
        const trace = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const sound = vi.fn();
        const modelIndex = vi.fn().mockReturnValue(1);
        const createPhalanxBall = vi.spyOn(projectiles, 'createPhalanxBall');

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
        player.angles = { x: 0, y: 0, z: 0 };
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.Phalanx],
                ammo: { [AmmoType.MagSlugs]: 10 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
        } as any;
        game.entities.finalizeSpawn(player);

        // Fire
        fire(game, player, WeaponId.Phalanx);

        // Ammo consumption: 1 mag slug
        expect(player.client!.inventory.ammo.counts[AmmoType.MagSlugs]).toBe(9);

        // Projectile creation: 2 balls
        expect(createPhalanxBall).toHaveBeenCalledTimes(2);

        expect(createPhalanxBall).toHaveBeenCalledWith(
            expect.anything(),
            player,
            expect.anything(),
            expect.anything(), // dir
            70, // damage
            120, // radius
            700 // speed
        );

        // Find the projectiles
        const balls = game.entities.findByClassname('phalanx_ball');
        expect(balls.length).toBe(2);
        expect(balls[0].movetype).toBe(MoveType.FlyMissile);

        // Check touch logic (radius damage)
        const ball = balls[0];
        const touch = ball.touch;

        // Mock findByRadius
        const radiusSpy = vi.spyOn(game.entities, 'findByRadius').mockReturnValue([]);

        touch!(ball, null, { normal: { x: 0, y: 0, z: 1 } } as any);

        expect(radiusSpy).toHaveBeenCalledWith(ball.origin, 120);

        // Effect
        expect(multicast).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            ServerCommand.temp_entity,
            TempEntity.PLASMA_EXPLOSION,
            expect.anything()
        );
    });
});
