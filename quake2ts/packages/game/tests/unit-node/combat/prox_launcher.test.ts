// =================================================================
// Quake II - Prox Launcher Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as projectiles from '../../../src/entities/projectiles.js';
import { createPlayerWeaponStates } from '../../../src/combat/weapons/state.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('Prox Launcher', () => {
    it('should fire a prox mine and consume ammo', () => {
        const createProxMine = vi.spyOn(projectiles, 'createProxMine');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.ProxLauncher],
                ammo: { [AmmoType.Prox]: 5 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1,
        } as any;
        game.entities.finalizeSpawn(player);

        fire(game, player, WeaponId.ProxLauncher);

        expect(player.client!.inventory.ammo.counts[AmmoType.Prox]).toBe(4);
        expect(createProxMine).toHaveBeenCalled();
    });

    it('should not fire if out of ammo', () => {
        const createProxMine = vi.spyOn(projectiles, 'createProxMine');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.ProxLauncher],
                ammo: { [AmmoType.Prox]: 0 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1,
        } as any;
        game.entities.finalizeSpawn(player);

        fire(game, player, WeaponId.ProxLauncher);

        expect(createProxMine).not.toHaveBeenCalled();
    });

    it('mine should stick to walls', () => {
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        game.entities.finalizeSpawn(player);

        const mine = projectiles.createProxMine(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 600);

        expect(mine.movetype).toBe(MoveType.Toss);

        // Simulate touch with world
        const plane = { normal: { x: -1, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0, pad: [0, 0] };
        if (mine.touch) {
            mine.touch(mine, null, plane, null);
        }

        expect(mine.movetype).toBe(MoveType.None);
        expect(mine.solid).toBe(Solid.BoundingBox);
        expect(mine.takedamage).toBe(true);
        expect(mine.nextthink).toBeGreaterThan(game.time);
    });
});
