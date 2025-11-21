// =================================================================
// Quake II - Weapon System Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { createPlayerInventory, createPlayerWeaponStates, WeaponId } from '../../src/inventory/index.js';
import { getWeaponState } from '../../src/combat/weapons/state.js';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { vi } from 'vitest';

describe('Weapon System', () => {
    it('should get the weapon state', () => {
        const weaponStates = createPlayerWeaponStates();
        const state = getWeaponState(weaponStates, WeaponId.Blaster);
        expect(state.lastFireTime).toBe(0);
    });

    it('should fire a weapon', () => {
        const trace = vi.fn();
        const pointContents = vi.fn();
        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
        };
        const game = createGame(trace, pointContents, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.spawnWorld();
        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({ weapons: [WeaponId.Shotgun], ammo: { shells: 10 } });

        fire(game, player, WeaponId.Shotgun);

        expect(player.client!.inventory.ammo.shells).toBe(9);
    });
});
