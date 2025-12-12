// =================================================================
// Quake II - Super Shotgun Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame, GameExports } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { Entity } from '../../src/entities/entity.js';
import {
    DEFAULT_SSHOTGUN_COUNT,
    DEFAULT_SHOTGUN_HSPREAD,
    DEFAULT_SHOTGUN_VSPREAD
} from '../../src/combat/weapons/firing.js';

describe('Super Shotgun', () => {
    let game: GameExports;
    let player: Entity;
    let target: Entity;
    let trace: any;
    let T_Damage: any;

    beforeEach(() => {
        const multicast = vi.fn();
        trace = vi.fn();
        T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };

        game = createGame({ trace, multicast, pointcontents: vi.fn(), unicast: vi.fn(), linkentity: vi.fn() }, engine, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: false });

        game.spawnWorld();

        player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.SuperShotgun],
                ammo: { [AmmoType.Shells]: 50 },
            }),
            weaponStates: { states: new Map() },
            buttons: 0,
        } as any;
        player.angles = { x: 0, y: 0, z: 0 };
        player.origin = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(player);

        target = game.entities.spawn();
        target.health = 100;
        target.takedamage = true;
        game.entities.finalizeSpawn(target);

        trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });
    });

    it('should fire standard pellets (Wide Spread, High Damage)', () => {
        fire(game, player, WeaponId.SuperShotgun);

        // 1 trace for P_ProjectSource + 20 traces for pellets (10 per barrel) = 21
        expect(trace).toHaveBeenCalledTimes(21);
        // Verify damage is 6
        expect(T_Damage).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            6, // Standard Damage
            expect.anything(),
            expect.anything(),
            DamageMod.SSHOTGUN,
            expect.anything(),
            expect.anything()
        );
    });

    it('should fire precision pellets (Tight Spread, Low Damage) when Alt-Fire is held', () => {
        // Enable Alt-Fire
        player.client!.buttons = 32; // Attack2

        fire(game, player, WeaponId.SuperShotgun);

        expect(trace).toHaveBeenCalledTimes(21);
        // Verify damage is 4
        expect(T_Damage).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            4, // Precision Damage
            expect.anything(),
            expect.anything(),
            DamageMod.SSHOTGUN,
            expect.anything(),
            expect.anything()
        );
    });
});
