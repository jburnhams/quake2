
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blasterThink } from '../../../src/combat/weapons/blaster.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId } from '../../../src/inventory/index.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import {
    FRAME_BLASTER_ACTIVATE_LAST,
    FRAME_BLASTER_FIRE_LAST,
    FRAME_BLASTER_IDLE_LAST
} from '../../../src/combat/weapons/frames.js';
import * as projectiles from '../../../src/entities/projectiles.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';

describe('Blaster Alt-Fire (Melee)', () => {
    let game: any;
    let player: any;
    let sys: any;
    let createBlasterBoltSpy: any;

    beforeEach(() => {
        const { imports, engine } = createGameImportsAndEngine();
        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        sys = game.entities;
        game.init(1.0);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        player = game.entities.find((e: any) => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Blaster],
            currentWeapon: WeaponId.Blaster
        });
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = FRAME_BLASTER_FIRE_LAST + 1;
        player.client.weapon_think_time = 0;

        // Spy on projectile creation
        createBlasterBoltSpy = vi.spyOn(projectiles, 'createBlasterBolt');
    });

    it('should start firing sequence when Alt-Fire (32) is pressed', () => {
        player.client.buttons = 32; // BUTTON_ATTACK2

        blasterThink(player, sys);

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client.gun_frame).toBe(FRAME_BLASTER_ACTIVATE_LAST + 1);
    });

    it('should perform melee attack (trace) instead of projectile on Alt-Fire', () => {
        player.client.buttons = 32; // BUTTON_ATTACK2
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = 5; // Fire frame

        // Setup trace for melee hit
        // Mock trace to return a hit on an enemy
        const enemy = game.entities.spawn();
        enemy.takedamage = true;
        enemy.health = 100;

        game.trace.mockReturnValue({
            fraction: 0.5,
            endpos: { x: 50, y: 0, z: 0 },
            ent: enemy,
            plane: { normal: { x: -1, y: 0, z: 0 } }
        });

        blasterThink(player, sys);

        // Should NOT create projectile
        expect(createBlasterBoltSpy).not.toHaveBeenCalled();

        // Should have called trace
        expect(game.trace).toHaveBeenCalled();

        // Should have damaged enemy (we can check enemy health if T_Damage works, or spy on T_Damage)
        // Since T_Damage is complex, checking trace call and lack of projectile is good first step.
    });

    it('should fire projectile on Primary Fire (1)', () => {
        player.client.buttons = 1; // BUTTON_ATTACK
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = 5; // Fire frame

        blasterThink(player, sys);

        expect(createBlasterBoltSpy).toHaveBeenCalled();
    });
});
