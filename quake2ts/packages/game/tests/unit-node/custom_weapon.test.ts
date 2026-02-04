import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, GameExports } from '../../src/index.js';
import { registerWeapon, type WeaponDefinition } from '../../src/combat/weapons/registry.js';
import { fire } from '../../src/combat/weapons/firing.js';
import { WeaponId } from '../../src/inventory/playerInventory.js';
import { createTestGame, createPlayerEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Custom Weapon Registration', () => {
  let game: GameExports;
  let player: Entity;

  beforeEach(() => {
    const result = createTestGame({
        config: {
            time: 10
        }
    });
    game = result.game;

    const playerFactory = createPlayerEntityFactory();
    const client = playerFactory.client!;

    client.inventory.ownedWeapons = new Set([WeaponId.Blaster]);
    client.inventory.currentWeapon = WeaponId.Blaster;

    player = spawnEntity(game.entities, playerFactory);
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
