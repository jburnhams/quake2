import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeWeapon, setInstantSwitch, switchToBestWeapon, NoAmmoWeaponChange } from '../../../src/combat/weapons/switching.js';
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

  it('should switch when out of ammo (NoAmmoWeaponChange)', () => {
      // Setup: Current weapon Railgun, but 0 ammo. Have Shotgun with ammo.
      entity.client!.inventory.ownedWeapons.add(WeaponId.Railgun);
      entity.client!.inventory.currentWeapon = WeaponId.Railgun;
      entity.client!.inventory.ammo.counts[AmmoType.Slugs] = 0;

      entity.client!.inventory.ownedWeapons.add(WeaponId.Shotgun);
      entity.client!.inventory.ammo.counts[AmmoType.Shells] = 10;

      NoAmmoWeaponChange(entity);

      expect(entity.client!.inventory.currentWeapon).toBe(WeaponId.Shotgun);
      expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_ACTIVATING);
  });

  it('should fallback to Blaster if no other weapon has ammo', () => {
       entity.client!.inventory.ownedWeapons.add(WeaponId.RocketLauncher);
       entity.client!.inventory.currentWeapon = WeaponId.RocketLauncher;
       entity.client!.inventory.ammo.counts[AmmoType.Rockets] = 0;

       // Blaster always has ammo (infinite)
       entity.client!.inventory.ownedWeapons.add(WeaponId.Blaster);

       NoAmmoWeaponChange(entity);

       expect(entity.client!.inventory.currentWeapon).toBe(WeaponId.Blaster);
  });
});
