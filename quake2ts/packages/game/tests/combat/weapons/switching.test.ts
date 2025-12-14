
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeWeapon, setInstantSwitch, switchToBestWeapon } from '../../../src/combat/weapons/switching.js';
import { Entity } from '../../../src/entities/entity.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { createPlayerInventory, WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';

describe('Weapon Switching', () => {
  let entity: Entity;

  beforeEach(() => {
    entity = {
      client: {
        inventory: createPlayerInventory(),
        weaponstate: WeaponStateEnum.WEAPON_READY,
        gun_frame: 0,
        weapon_think_time: 0,
      },
    } as unknown as Entity;

    // Reset instant switch
    setInstantSwitch(false);
  });

  it('should switch weapon with animation by default', () => {
    ChangeWeapon(entity, WeaponId.Shotgun);

    expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_ACTIVATING);
    expect(entity.client!.gun_frame).toBe(0);
    // weapon_think_time should be 0 to start
  });

  it('should switch weapon instantly when enabled', () => {
    setInstantSwitch(true);

    ChangeWeapon(entity, WeaponId.Shotgun);

    expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
    // Should skip activation
  });

  it('should auto-switch to best weapon', () => {
      // Give Railgun and ammo
      entity.client!.inventory.ownedWeapons.add(WeaponId.Railgun);
      entity.client!.inventory.ammo.counts[AmmoType.Slugs] = 10;

      switchToBestWeapon(entity);

      expect(entity.client!.inventory.currentWeapon).toBe(WeaponId.Railgun);
      expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_ACTIVATING);
  });
});
