// =================================================================
// Quake II - Blaster Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { angleVectors } from '@quake2ts/shared';

describe('Blaster', () => {
    it('should not consume ammo and should deal damage', () => {
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
        playerStart.angles = { x: 0, y: 90, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Blaster],
            ammo: {},
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        trace.mockReturnValue({
            ent: target,
            endpos: { x: 0, y: 10, z: 0 },
            plane: { normal: { x: 0, y: -1, z: 0 } },
        });

        fire(game, player, WeaponId.Blaster);

        const { forward } = angleVectors(player.angles);
        const end = { x: player.origin.x + forward.x * 8192, y: player.origin.y + forward.y * 8192, z: player.origin.z + forward.z * 8192 };

        expect(trace).toHaveBeenCalledWith(player.origin, null, null, end, player, 0);
        expect(T_Damage).toHaveBeenCalledWith(target, player, player, expect.anything(), expect.anything(), expect.anything(), 15, 1, 0, 0);
    });
});
