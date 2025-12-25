import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, GameExports } from '@quake2ts/game';
import { registerWeapon, WeaponDefinition } from '../src/combat/weapons/registry.js';
import { fire } from '../src/combat/weapons/firing.js';
import { WeaponId } from '../src/inventory/playerInventory.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('Custom Weapon Registration', () => {
  let game: GameExports;
  let player: Entity;

  beforeEach(() => {
    const ctx = createTestContext();
    game = ctx.game as GameExports;

    // Mock trace and other required functions on game object
    game.trace = vi.fn(() => ({
        fraction: 1.0,
        ent: null,
        allsolid: false,
        startsolid: false,
        endpos: { x: 0, y: 0, z: 0 },
        plane: null,
        surfaceFlags: 0,
        contents: 0
    }));
    game.multicast = vi.fn();
    game.sound = vi.fn();
    game.time = 10;

    player = new Entity(1);
    player.client = {
        inventory: {
            ammo: { counts: [] },
            ownedWeapons: new Set([WeaponId.Blaster]),
            currentWeapon: WeaponId.Blaster,
            powerups: new Map(),
            keys: new Set(),
            items: new Set(),
        },
        weaponStates: {
            states: new Map() // Correct initialization
        },
        pers: {},
        buttons: 0
    } as any;
  });

  it('should register and fire a custom weapon', () => {
      const fireSpy = vi.fn();

      const customWeapon: WeaponDefinition = {
          weaponId: WeaponId.Blaster, // Override Blaster
          name: 'Super Blaster',
          ammo: null,
          ammoUsage: 0,
          fireRate: 0.1,
          fire: fireSpy
      };

      registerWeapon(customWeapon);

      fire(game, player, WeaponId.Blaster);

      expect(fireSpy).toHaveBeenCalled();
  });
});
