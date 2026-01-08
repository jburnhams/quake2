import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, GameExports } from '@quake2ts/game';
import { registerWeapon, WeaponDefinition } from '../src/combat/weapons/registry.js';
import { fire } from '../src/combat/weapons/firing.js';
import { WeaponId } from '../src/inventory/playerInventory.js';
import { createMockGameExports, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('Custom Weapon Registration', () => {
  let game: GameExports;
  let player: Entity;

  beforeEach(() => {
    // Use createMockGameExports for a more complete game mock
    game = createMockGameExports({
        time: 10
    });

    // Use createPlayerEntityFactory for consistent player setup
    player = new Entity(1);
    Object.assign(player, createPlayerEntityFactory({
         client: {
            inventory: {
                ammo: { counts: [] },
                ownedWeapons: new Set([WeaponId.Blaster]),
                currentWeapon: WeaponId.Blaster,
                powerups: new Map(),
                keys: new Set(),
                items: new Set(),
            },
            weaponStates: {
                states: new Map()
            },
            pers: {},
            buttons: 0
        } as any
    }));
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
