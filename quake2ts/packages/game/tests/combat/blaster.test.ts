// =================================================================
// Quake II - Blaster Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { DamageMod } from '../../src/combat/damageMods.js';

describe('Blaster', () => {
    it('should not consume ammo and should spawn a blaster bolt', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');

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
            weapons: [WeaponId.Blaster],
            ammo: {},
        });

        fire(game, player, WeaponId.Blaster);

        expect(createBlasterBolt).toHaveBeenCalledWith(game.entities, player, player.origin, expect.anything(), 15, 1000, DamageMod.BLASTER);
    });
});
