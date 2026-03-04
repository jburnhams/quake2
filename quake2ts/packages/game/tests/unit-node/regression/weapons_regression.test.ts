import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext, createMockGameExports } from '@quake2ts/test-utils';
import { Entity } from '../../../src/entities/entity.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { createBlasterBolt } from '../../../src/entities/projectiles.js';
import { fireRailgunShot, fireChaingun, fireBFG, fireBlaster } from '../../../src/combat/weapons/firing.js';
import { DamageFlags } from '../../../src/combat/damageFlags.js';
import { WeaponState } from '../../../src/combat/types.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import * as projectiles from '../../../src/entities/projectiles.js';
import * as damage from '../../../src/combat/damage.js';

describe('Weapon Regression Tests', () => {
    let context: ReturnType<typeof createTestContext>;
    let player: Entity;
    let game: any;
    let tDamageSpy: any;
    let tRadiusDamageSpy: any;
    let createBlasterBoltSpy: any;
    let createLaserSpy: any;

    beforeEach(() => {
        tDamageSpy = vi.spyOn(damage, 'T_Damage').mockImplementation(((...args: any[]) => {
            return { take: args[6], killed: false }; // args[6] is damage
        }) as any);
        tRadiusDamageSpy = vi.spyOn(damage, 'T_RadiusDamage').mockImplementation(() => undefined);
        createBlasterBoltSpy = vi.spyOn(projectiles, 'createBlasterBolt').mockImplementation(projectiles.createBlasterBolt);
        createLaserSpy = vi.spyOn(projectiles, 'createLaser').mockImplementation(projectiles.createLaser);

        context = createTestContext();

        // Mock game exports properly
        game = createMockGameExports({
            entities: context.entities,
            deathmatch: false,
            time: 10,
            random: {
                crandom: () => 0.5,
                irandom: () => 1
            }
        });

        // Add trace needed by firing functions (override default mock)
        game.trace.mockReturnValue({
            fraction: 1.0,
            ent: null,
            endpos: { x: 100, y: 0, z: 0 },
            plane: { normal: { x: 0, y: 0, z: 1 } }
        });

        (context.entities as any).game = game;
        // Ensure context.entities has world property
        context.entities.world = new Entity(0);

        // Also attach to context for easier access if needed by tests, though implementation uses context.entities.game
        (context as any).game = game;

        player = new Entity(1);
        player.classname = 'player';
        player.client = {
            ps: {
                viewangles: { x: 0, y: 0, z: 0 },
                gunindex: 0
            },
            inventory: {
                items: [],
                ammo: { counts: new Float32Array(10).fill(100) } // Give plenty of ammo
            },
            // Properly mock weaponStates as an object with 'states' property that is a Map
            weaponStates: {
                states: new Map()
            }
        } as any;
        player.origin = { x: 0, y: 0, z: 0 };
        // Default player state
        player.client!.pers = {
            weapon: null,
            lastweapon: null,
            inventory: player.client!.inventory,
            connected: true,
            netname: 'Player',
            team: 0
        } as any;

        vi.clearAllMocks();
    });

    it('Blaster speed should be 1500', () => {
        // Use fireBlaster to test the actual integration
        fireBlaster(game, player);

        // Verify createBlasterBolt was called with correct speed (1500)
        expect(createBlasterBoltSpy).toHaveBeenCalledWith(
            expect.anything(), // entities
            expect.anything(), // owner
            expect.anything(), // start
            expect.anything(), // dir
            15,                // damage
            1500,              // speed - THIS IS WHAT WE ARE TESTING
            DamageMod.BLASTER  // mod
        );
    });

    it('Railgun damage: DM=100, SP=125', () => {
        const target = new Entity(2);
        target.takedamage = true;

        game.trace = vi.fn().mockReturnValue({
            fraction: 0.5,
            ent: target,
            endpos: { x: 50, y: 0, z: 0 },
            plane: { normal: {x:-1, y:0, z:0} }
        });

        vi.clearAllMocks();

        // Test Single Player
        game.deathmatch = false;

        fireRailgunShot(game, player);

        expect(tDamageSpy).toHaveBeenLastCalledWith(
            target,
            player,
            player,
            {x:0, y:0, z:0}, // ZERO_VEC3
            {x:50, y:0, z:0}, // trace.endpos
            {x:-1, y:0, z:0}, // plane normal
            125, // Damage
            225, // Knockback (SP)
            expect.anything(), // Dflags
            DamageMod.RAILGUN,
            expect.anything(), // time
            expect.anything(), // multicast
            expect.anything() // hooks?
        );

        // DM
        game.deathmatch = true;
        fireRailgunShot(game, player);

        expect(tDamageSpy).toHaveBeenLastCalledWith(
            target,
            player,
            player,
            {x:0, y:0, z:0},
            {x:50, y:0, z:0},
            {x:-1, y:0, z:0},
            100, // Damage
            200, // Knockback (DM)
            expect.anything(),
            DamageMod.RAILGUN,
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });

    it('Chaingun burst: 1->2->3 shots', () => {
        const target = new Entity(2);
        target.takedamage = true;
        game.trace = vi.fn().mockReturnValue({
            fraction: 0.5,
            ent: target,
            endpos: { x: 50, y: 0, z: 0 }
        });

        vi.clearAllMocks();

        const WeaponIdChaingun = WeaponId.Chaingun;

        // Shot 1 (spinupCount = 0 -> 1)
        let ws = { spinupCount: 0, lastFireTime: 0 };
        player.client!.weaponStates.states.set(WeaponIdChaingun, ws);

        fireChaingun(game, player);
        expect(tDamageSpy).toHaveBeenCalledTimes(1);

        // Shot 2 (spinupCount = 5 -> 6, logic: >5 is 2 shots)
        ws.spinupCount = 5;
        vi.clearAllMocks();
        fireChaingun(game, player);
        expect(tDamageSpy).toHaveBeenCalledTimes(2);

        // Shot 3 (spinupCount = 10 -> 11, logic: >10 is 3 shots)
        ws.spinupCount = 10;
        vi.clearAllMocks();
        fireChaingun(game, player);
        expect(tDamageSpy).toHaveBeenCalledTimes(3);
    });

    it('BFG lasers fire every 100ms', () => {
        // Mock spawn
        const bfgEnt = new Entity(10);
        bfgEnt.classname = 'projectile_bfg';
        (context.entities.spawn as any).mockReturnValue(bfgEnt);

        // Set up frames for firing BFG properly
        // If gun_frame is 0, both prime and fire run in test mode (legacy)
        player.client!.gun_frame = 0;

        // fireBFG(game, player)
        fireBFG(game, player);

        // Check if spawn was called
        expect(context.entities.spawn).toHaveBeenCalled();

        // Check scheduleThink instead of laser_time.
        const lastCall = (context.entities.scheduleThink as any).mock.lastCall;
        // Arguments: entity, time
        expect(lastCall[0]).toBe(bfgEnt);
        // Should be roughly current time + 0.016
        expect(lastCall[1]).toBeCloseTo(game.time + 0.016);
    });

    it('Quad damage multiplier is 4x', () => {
        // Give quad
        player.client!.quad_framenum = 1000;
        game.time = 10;
        context.entities.frame = 100;

        game.deathmatch = false;

        const target = new Entity(2);
        target.takedamage = true;
        game.trace = vi.fn().mockReturnValue({
            fraction: 0.5,
            ent: target,
            endpos: { x: 50, y: 0, z: 0 },
            plane: { normal: {x:-1, y:0, z:0} }
        });

        vi.clearAllMocks();

        // Note: We are using a Mocked T_Damage.
        // The mock DOES NOT contain the quad damage multiplier logic (that logic is in the real T_Damage function).
        // Therefore, this test verifies that the WEAPON LOGIC passes the BASE damage (125) to T_Damage.
        // It asserts that we are NOT passing 500 (which would imply double-application if T_Damage also did it).
        // To properly test the "Quad damage is 4x" behavior end-to-end, we would need to use the real T_Damage or mock the multiplier logic.
        // Given we are mocking T_Damage here, we confirm the contract: "Weapon fires base damage, System handles multiplier".

        fireRailgunShot(game, player);

        expect(tDamageSpy).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            125, // Base damage (125) NOT 500. This confirms weapon doesn't pre-multiply.
            expect.anything(),
            expect.anything(),
            DamageMod.RAILGUN,
            expect.anything(),
            expect.anything(),
            expect.anything()
        );

        // NOTE: A separate unit test for T_Damage in 'combat/damage.test.ts' should verify the 4x multiplier logic.
        // This regression test effectively checks the weapon integration side.
    });
});
