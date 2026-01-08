// =================================================================
// Quake II - Railgun Animation Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { railgunThink } from '../../../src/combat/weapons/railgun.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import {
    FRAME_RAILGUN_ACTIVATE_LAST,
    FRAME_RAILGUN_FIRE_LAST,
    FRAME_RAILGUN_IDLE_LAST,
    FRAME_RAILGUN_DEACTIVATE_LAST
} from '../../../src/combat/weapons/frames.js';
import { createGameImportsAndEngine, createPlayerEntityFactory } from '@quake2ts/test-utils';
import { Entity } from '../../../src/entities/entity.js';

// Railgun frames:
// FRAME_ACTIVATE_LAST = 3
// FRAME_FIRE_LAST = 18
// FRAME_IDLE_LAST = 51
// FRAME_DEACTIVATE_LAST = 56
// fire_frames = {4}

describe('Railgun Animation', () => {
    let game: any;
    let player: any;
    let sys: any;

    beforeEach(() => {
        const { imports, engine } = createGameImportsAndEngine();
        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        sys = game.entities;

        // Mock time
        Object.defineProperty(game, 'time', { value: 1.0, writable: true });

        // Create player directly using factory
        player = game.entities.spawn();
        Object.assign(player, createPlayerEntityFactory({
            classname: 'player',
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.Railgun],
                    ammo: { [AmmoType.Slugs]: 10 },
                    currentWeapon: WeaponId.Railgun
                }),
                weaponstate: WeaponStateEnum.WEAPON_READY,
                gun_frame: FRAME_RAILGUN_FIRE_LAST + 1,
                weapon_think_time: 0,
                ps: { fov: 90, gunindex: 0, blend: [0,0,0,0] }
            } as any
        }));
    });

    it('should fire and play animation when button is pressed', () => {
        player.client.buttons = 1; // BUTTON_ATTACK

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);

        railgunThink(player, sys);

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client.gun_frame).toBe(FRAME_RAILGUN_ACTIVATE_LAST + 1); // 4

        // Advance time to trigger fire logic
        game.time += 0.1;
        player.client.weapon_think_time = 0;

        railgunThink(player, sys);

        // Frame 4 is fire frame.
        expect(player.client.inventory.ammo.counts[AmmoType.Slugs]).toBe(9);
    });

    it('should cycle through long fire animation', () => {
        player.client.buttons = 0;
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = 4;

        // Advance time
        game.time += 0.1;
        player.client.weapon_think_time = 0;

        railgunThink(player, sys);
        expect(player.client.gun_frame).toBe(5);
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
    });
});
