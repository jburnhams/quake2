// =================================================================
// Quake II - Railgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';

describe('Railgun', () => {
    it('should consume 1 slug and deal damage', () => {
        const trace = vi.fn();
        const pointContents = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointContents }, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Railgun],
            ammo: { [AmmoType.Slugs]: 10 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
            fraction: 0.5,
        });

        fire(game, player, WeaponId.Railgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Slugs]).toBe(9);
        // It might loop more than once if the trace continues
        expect(trace).toHaveBeenCalled();
        expect(T_Damage).toHaveBeenCalled();
    });

    it('should penetrate entities', () => {
        const trace = vi.fn();
        const pointContents = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointContents }, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.angles = { x: 0, y: 0, z: 0 };
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.Railgun],
                ammo: { [AmmoType.Slugs]: 10 },
            }),
            weaponStates: { states: new Map() } as any,
        } as any;
        game.entities.finalizeSpawn(player);

        const target1 = game.entities.spawn();
        target1.health = 100;
        target1.takedamage = 1;

        const target2 = game.entities.spawn();
        target2.health = 100;
        target2.takedamage = 1;

        // First trace hits target1
        trace.mockReturnValueOnce({
            ent: target1,
            endpos: { x: 100, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
            fraction: 0.1,
        });

        // Second trace hits target2
        trace.mockReturnValueOnce({
            ent: target2,
            endpos: { x: 200, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
            fraction: 0.2,
        });

        // Third trace hits nothing (end of world or max range)
        trace.mockReturnValueOnce({
            ent: null, // or world
            endpos: { x: 8192, y: 0, z: 0 },
            plane: { normal: { x: 0, y: 0, z: 0 } },
            fraction: 1.0,
        });

        fire(game, player, WeaponId.Railgun);

        expect(T_Damage).toHaveBeenCalledWith(target1, expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), 150, expect.anything(), expect.anything(), expect.anything());
        expect(T_Damage).toHaveBeenCalledWith(target2, expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), 150, expect.anything(), expect.anything(), expect.anything());
        expect(trace).toHaveBeenCalledTimes(3);
    });
});
