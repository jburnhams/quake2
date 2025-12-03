
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '../test-helpers.js';
import { fireChainFist } from '../../src/combat/weapons/rogue.js';
import { WeaponId } from '../../src/inventory/playerInventory.js';
import { WeaponStateEnum } from '../../src/combat/weapons/state.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { T_Damage } from '../../src/combat/damage.js';

// Mock T_Damage
vi.mock('../../src/combat/damage.js', () => ({
    T_Damage: vi.fn(),
    T_RadiusDamage: vi.fn(),
    CheckRadiusDamage: vi.fn(),
}));

describe('Weapon: Chainfist', () => {
    let context: any;
    let player: any;
    let target: any;
    let game: any;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createTestContext();
        game = {
            ...context,
            trace: context.entities.trace,
            multicast: context.entities.multicast,
            unicast: context.entities.unicast,
            time: context.entities.timeSeconds,
            entities: context.entities,
            sound: context.entities.sound
        };

        // Setup player
        player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: {
                ammo: { counts: [] },
                powerups: new Map()
            },
            kick_angles: { x: 0, y: 0, z: 0 },
            kick_origin: { x: 0, y: 0, z: 0 }
        };
        player.origin = { x: 0, y: 0, z: 0 };
        player.angles = { x: 0, y: 0, z: 0 };
        player.takedamage = true;

        // Setup target
        target = game.entities.spawn();
        target.classname = 'monster_soldier';
        target.takedamage = true;
        target.health = 100;
        target.origin = { x: 50, y: 0, z: 0 }; // Within 64 units range
    });

    it('should damage target within range', () => {
        // Mock trace to hit target
        const traceResult = {
            fraction: 0.5,
            endpos: { x: 32, y: 0, z: 0 },
            ent: target,
            plane: { normal: { x: -1, y: 0, z: 0 } }
        };

        // Force the trace function to return our hit
        game.trace = vi.fn().mockReturnValue(traceResult);

        const start = { x: 0, y: 0, z: 0 };
        const forward = { x: 1, y: 0, z: 0 };

        fireChainFist(
            game,
            player,
            player.client.inventory,
            { state: WeaponStateEnum.WEAPON_FIRING } as any,
            start,
            forward
        );

        expect(T_Damage).toHaveBeenCalledWith(
            target,
            player,
            player,
            forward,
            expect.anything(), // point
            expect.anything(), // normal
            15, // Damage
            0, // Kick
            DamageFlags.NONE,
            DamageMod.CHAINFIST,
            expect.anything(), // time
            expect.anything() // multicast
        );
    });

    it('should apply kickback to player', () => {
         // Mock trace to miss
        game.trace = vi.fn().mockReturnValue({ fraction: 1.0, ent: null });

        const start = { x: 0, y: 0, z: 0 };
        const forward = { x: 1, y: 0, z: 0 };

        fireChainFist(
            game,
            player,
            player.client.inventory,
            { state: WeaponStateEnum.WEAPON_FIRING } as any,
            start,
            forward
        );

        expect(player.client.kick_angles.x).toBe(-0.5);
    });
});
