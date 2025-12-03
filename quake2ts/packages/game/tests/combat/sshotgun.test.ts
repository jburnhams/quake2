// =================================================================
// Quake II - Super Shotgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';

describe('Super Shotgun', () => {
    it('should consume 2 shells and fire 20 pellets', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        // 3 P_ProjectSource calls (center + 2 angles) * 2 traces each = 6
        // + 20 pellets = 26 traces
        trace.mockImplementation((start: any, mins: any, maxs: any, end: any, passent: any, mask: any) => {
            if (!start) return { fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, contents: 0 };
            return {
                ent: target,
                endpos: { x: 10, y: 0, z: 0 },
                plane: { normal: { x: -1, y: 0, z: 0 } },
                contents: 0,
                fraction: 0.5
            };
        });

        fire(game, player, WeaponId.SuperShotgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(8);
        expect(trace).toHaveBeenCalledTimes(26); // 6 source + 20 pellets
        // DamageFlags.BULLET (16), DamageMod.SSHOTGUN (3)
        expect(T_Damage).toHaveBeenCalledWith(target, player, player, expect.anything(), expect.anything(), expect.anything(), 6, 1, 16, 3, game.time, expect.any(Function));
    });

    it('should fire two volleys with horizontal spread', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 90, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        trace.mockImplementation(() => ({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
            contents: 0,
            fraction: 0.5
        }));

        fire(game, player, WeaponId.SuperShotgun);

        expect(trace).toHaveBeenCalledTimes(26); // 6 source + 20 pellets

        // Check the trace calls to verify the spread pattern
        const calls = trace.mock.calls;
        // Source traces: [0,1] center, [2,3] left?, [14,15] right?
        // Wait, order:
        // 1. Center P_ProjectSource (2 calls)
        // 2. Left P_ProjectSource (2 calls)
        // 3. Fire 10 pellets (10 calls)
        // 4. Right P_ProjectSource (2 calls)
        // 5. Fire 10 pellets (10 calls)

        // Pellets: indices 4-13 (10 calls), indices 16-25 (10 calls)
        const firstVolleyDirections = calls.slice(4, 14).map(call => call[3].x);
        const secondVolleyDirections = calls.slice(16, 26).map(call => call[3].x);

        // Check that the two volleys are distinct
        const firstVolleyAverage = firstVolleyDirections.reduce((a, b) => a + b, 0) / firstVolleyDirections.length;
        const secondVolleyAverage = secondVolleyDirections.reduce((a, b) => a + b, 0) / secondVolleyDirections.length;

        // With a yaw of 90, the first volley (yaw 85) should have a positive x component,
        // and the second volley (yaw 95) should have a negative x component.
        expect(firstVolleyAverage).toBeGreaterThan(0);
        expect(secondVolleyAverage).toBeLessThan(0);
    });
});
