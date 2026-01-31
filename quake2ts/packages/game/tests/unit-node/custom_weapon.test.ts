import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, GameExports } from '@quake2ts/game';
import { registerWeapon, WeaponDefinition } from '../../src/combat/weapons/registry.js';
import { fire } from '../../src/combat/weapons/firing.js';
import { WeaponId } from '../../src/inventory/playerInventory.js';
import { createTestGame, createPlayerEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Custom Weapon Registration', () => {
  let game: GameExports;
  let player: Entity;

  beforeEach(() => {
    // Use createTestGame to get a functional game instance with entity system
    const result = createTestGame({
        config: {
            time: 10
        }
    });
    game = result.game;

    // Use spawnEntity to properly insert the player into the entity system
    const playerFactory = createPlayerEntityFactory();
    const client = playerFactory.client!;

    // Customize inventory for the test
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
