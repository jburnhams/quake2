// =================================================================
// Quake II - Hand Grenade Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import * as damage from '../../src/combat/damage.js';
import { createPlayerWeaponStates } from '../../src/combat/weapons/state.js';

describe('Hand Grenade', () => {
    it('should start cooking when fire button is held', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const sound = vi.fn();

        const engine = {
            trace,
            sound,
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        trace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        game.init(0); // Time 0

        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.HandGrenade],
                ammo: { [AmmoType.Grenades]: 5 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
            ps: { gunframe: 0 } as any
        } as any;
        game.entities.finalizeSpawn(player);

        // First frame: Start cooking
        fire(game, player, WeaponId.HandGrenade);

        const weaponState = player.client!.weaponStates.states.get(WeaponId.HandGrenade)!;
        expect(weaponState.grenadeTimer).toBe(0); // Started at time 0
        expect(sound).toHaveBeenCalledWith(player, 0, "weapons/hgrent1a.wav", 1, 1, 0);
    });

    it('should increase throw speed based on hold time', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');
        const multicast = vi.fn();
        const unicast = vi.fn();

        const engine = {
            trace,
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        trace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.HandGrenade],
                ammo: { [AmmoType.Grenades]: 5 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
        } as any;
        game.entities.finalizeSpawn(player);

        // Start cooking at T=0
        fire(game, player, WeaponId.HandGrenade);

        // Advance time to 1.0s
        game.frame({ time: 1000, delta: 1.0, deltaMs: 1000 } as any);

        // Release button
        player.client!.buttons = 0;
        fire(game, player, WeaponId.HandGrenade);

        // Expected speed: 400 + (1.0 * 200) = 600
        expect(createGrenade).toHaveBeenCalledWith(
            expect.anything(),
            player,
            expect.anything(),
            expect.anything(),
            120,
            600, // Speed
            expect.closeTo(1.5, 0.001) // Timer: 2.5 - 1.0 = 1.5
        );
    });

    it('should cap throw speed at max hold time (2.0s for max speed, but hold logic goes to 3.0s)', () => {
         const trace = vi.fn();
        const pointcontents = vi.fn();
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');
        const multicast = vi.fn();
        const unicast = vi.fn();

        const engine = {
            trace,
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        trace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.HandGrenade],
                ammo: { [AmmoType.Grenades]: 5 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
        } as any;
        game.entities.finalizeSpawn(player);

        // Start cooking at T=0
        fire(game, player, WeaponId.HandGrenade);

        // Advance time to 2.5s
        game.frame({ time: 2500, delta: 2.5, deltaMs: 2500 } as any);

        // Release button
        player.client!.buttons = 0;
        fire(game, player, WeaponId.HandGrenade);

        // Expected speed: 400 + (2.5 * 200) = 900 -> capped at 800
        // Timer: 2.5 - 2.5 = 0 -> capped at 0.5
        expect(createGrenade).toHaveBeenCalledWith(
            expect.anything(),
            player,
            expect.anything(),
            expect.anything(),
            120,
            800, // Capped Speed
            expect.closeTo(0.5, 0.001) // Min timer
        );
    });

    it('should explode in hand if held too long (3.0s)', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');
        const multicast = vi.fn();
        const unicast = vi.fn();

        const engine = {
            trace,
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        trace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.HandGrenade],
                ammo: { [AmmoType.Grenades]: 5 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
        } as any;
        game.entities.finalizeSpawn(player);

        // Start cooking at T=0
        fire(game, player, WeaponId.HandGrenade);

        // Advance time to 3.1s
        game.frame({ time: 3100, delta: 3.1, deltaMs: 3100 } as any);

        // Still holding button
        fire(game, player, WeaponId.HandGrenade);

        expect(createGrenade).not.toHaveBeenCalled();
        expect(T_RadiusDamage).toHaveBeenCalled(); // Should damage player
        expect(player.client!.inventory.ammo.counts[AmmoType.Grenades]).toBe(4);

        const weaponState = player.client!.weaponStates.states.get(WeaponId.HandGrenade)!;
        expect(weaponState.grenadeTimer).toBeUndefined(); // Timer reset
    });
});
