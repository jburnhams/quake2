import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createTestContext } from '@quake2ts/test-utils';
import { player_pain, P_PlayerThink } from '../../src/entities/player.js';
import { Entity, MoveType } from '../../src/entities/entity.js';
import { createPlayerInventory } from '../../src/inventory/playerInventory.js';
import { createPlayerWeaponStates } from '../../src/combat/weapons/state.js';
import { Vec3 } from '@quake2ts/shared';
import { createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('Player Damage Kick', () => {
    let context: ReturnType<typeof createTestContext>;
    let player: Entity;
    let attacker: Entity;

    beforeEach(() => {
        context = createTestContext();

        player = createPlayerEntityFactory({
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 }
        });

        // Populate client which createPlayerEntityFactory does not fully populate with complex objects yet
        // TODO: Update createPlayerEntityFactory to include these defaults
        player.client = {
            inventory: createPlayerInventory(),
            weaponStates: createPlayerWeaponStates(),
            buttons: 0,
            pm_type: 0,
            pm_time: 0,
            pm_flags: 0,
            gun_frame: 0,
            rdflags: 0,
            fov: 90,
            kick_angles: { x: 0, y: 0, z: 0 },
            kick_origin: { x: 0, y: 0, z: 0 },
            pers: {
                connected: true,
                inventory: [],
                health: 100,
                max_health: 100,
                savedFlags: 0,
                selected_item: 0
            }
        } as any;

        // Attacker is just an entity
        attacker = createEntityFactory({
             origin: { x: 100, y: 0, z: 0 }
        });
    });

    it('applies pitch kick on damage', () => {
        // Damage of 10
        player_pain(player, attacker, 10, 10, context.entities);

        // Should have pitch kick (x). Q2 usually kicks up (negative x)
        expect(player.client!.kick_angles.x).toBeLessThan(0);
        // Magnitude roughly proportional to damage (min 10 in Q2)
        expect(Math.abs(player.client!.kick_angles.x)).toBeGreaterThanOrEqual(10);
    });

    it('applies roll kick based on side direction (attacker on right)', () => {
        // Player facing East (0). Attacker at (0, -100, 0) -> South (Right side of East?)
        // Q2 coords: X forward, Y left, Z up.
        // Facing 0 (X+): Right is Y- (South).

        attacker.origin = { x: 0, y: -100, z: 0 }; // Right side

        player_pain(player, attacker, 10, 10, context.entities);

        // Should roll. Roll is z component of kick_angles.
        // If hit from right, roll left (positive z? or negative?).
        // Q2: kick_roll = damage * side.
        // side = Dot(dir, right).
        // dir = attacker - player = (0, -100, 0). Normalized (0, -1, 0).
        // right vector for angle 0: (0, -1, 0).
        // side = 0*0 + (-1)*(-1) + 0 = 1.
        // kick_roll = 10 * 1 = 10.

        expect(player.client!.kick_angles.z).toBeGreaterThan(0);
        expect(player.client!.kick_angles.z).toBeCloseTo(10, 0);
    });

    it('applies roll kick based on side direction (attacker on left)', () => {
        attacker.origin = { x: 0, y: 100, z: 0 }; // Left side (Y+)

        player_pain(player, attacker, 10, 10, context.entities);

        // side = Dot((0,1,0), (0,-1,0)) = -1.
        // kick_roll = -10.

        expect(player.client!.kick_angles.z).toBeLessThan(0);
        expect(player.client!.kick_angles.z).toBeCloseTo(-10, 0);
    });

    it('decays kick angles over time', () => {
        // Set initial kick
        player.client!.kick_angles = { x: -20, y: 0, z: 20 };

        // Run think
        P_PlayerThink(player, context.entities);

        // Should decay towards 0
        expect(player.client!.kick_angles.x).toBeGreaterThan(-20); // Closer to 0
        expect(player.client!.kick_angles.x).toBeLessThan(0);

        expect(player.client!.kick_angles.z).toBeLessThan(20);
        expect(player.client!.kick_angles.z).toBeGreaterThan(0);
    });
});
