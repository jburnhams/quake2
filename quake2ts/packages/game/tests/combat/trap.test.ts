
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '../test-helpers.js';
import { fireTrap } from '../../src/combat/weapons/xatrix.js';
import { WeaponStateEnum } from '../../src/combat/weapons/state.js';
import { AmmoType } from '../../src/inventory/ammo.js';

vi.mock('../../src/combat/damage.js', () => ({
    T_Damage: vi.fn(),
    T_RadiusDamage: vi.fn(),
    CheckRadiusDamage: vi.fn(),
}));

describe('Weapon: Trap', () => {
    let context: any;
    let player: any;
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
            entities: context.entities
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
    });

    it('should fire trap and consume ammo', () => {
        player.client.inventory.ammo.counts[AmmoType.Trap] = 5;

        const start = { x: 0, y: 0, z: 0 };
        const forward = { x: 1, y: 0, z: 0 };

        fireTrap(
            game,
            player,
            player.client.inventory,
            { state: WeaponStateEnum.WEAPON_FIRING } as any,
            start,
            forward
        );

        expect(player.client.inventory.ammo.counts[AmmoType.Trap]).toBe(4);

        // Check spawn was called for the trap
        // game.entities.spawn is a spy
        expect(game.entities.spawn).toHaveBeenCalled();

        // Verify kick applied
        expect(player.client.kick_angles.x).toBe(-2);
    });

    it('should not fire if no ammo', () => {
        player.client.inventory.ammo.counts[AmmoType.Trap] = 0;

        const start = { x: 0, y: 0, z: 0 };
        const forward = { x: 1, y: 0, z: 0 };

        fireTrap(
            game,
            player,
            player.client.inventory,
            { state: WeaponStateEnum.WEAPON_FIRING } as any,
            start,
            forward
        );

        expect(player.client.inventory.ammo.counts[AmmoType.Trap]).toBe(0);
        expect(player.client.kick_angles.x).toBe(0);
    });
});
