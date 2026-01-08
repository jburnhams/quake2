import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeWeapon, setInstantSwitch, switchToBestWeapon, NoAmmoWeaponChange } from '../../../src/combat/weapons/switching.js';
import { Entity } from '../../../src/entities/entity.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { createPlayerInventory, WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';
import { FRAME_SHOTGUN_IDLE_LAST, FRAME_SHOTGUN_DEACTIVATE_LAST, FRAME_SHOTGUN_ACTIVATE_LAST, FRAME_SHOTGUN_FIRE_LAST } from '../../../src/combat/weapons/frames.js';
import { Weapon_Generic } from '../../../src/combat/weapons/animation.js';
import { EntitySystem } from '../../../src/entities/system.js';

describe('Weapon Switching', () => {
  let entity: Entity;
  let sys: EntitySystem;

  beforeEach(() => {
    entity = {
      client: {
        inventory: createPlayerInventory(),
        weaponstate: WeaponStateEnum.WEAPON_READY,
        gun_frame: 0,
        weapon_think_time: 0,
        newWeapon: undefined,
      },
    } as unknown as Entity;

    sys = {
        timeSeconds: 100,
    } as unknown as EntitySystem;

    // Reset instant switch
    setInstantSwitch(false);
  });

  it('should switch weapon with animation by default', () => {
    // Starting with Shotgun
    entity.client!.inventory.currentWeapon = WeaponId.Shotgun;
    entity.client!.inventory.ownedWeapons.add(WeaponId.Shotgun);

    // Switch to Machinegun
    ChangeWeapon(entity, WeaponId.Machinegun);

    expect(entity.client!.newWeapon).toBe(WeaponId.Machinegun);
    expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_DROPPING);
    // Should start drop animation
    expect(entity.client!.gun_frame).toBe(FRAME_SHOTGUN_IDLE_LAST + 1);
  });

  it('should switch weapon instantly when enabled', () => {
    setInstantSwitch(true);

    ChangeWeapon(entity, WeaponId.Shotgun);

    expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
    expect(entity.client!.newWeapon).toBeUndefined();
    // Should skip activation
  });

  it('should auto-switch to best weapon via NoAmmoWeaponChange', () => {
      // Setup: Current weapon Railgun, but 0 ammo. Have Shotgun with ammo.
      entity.client!.inventory.ownedWeapons.add(WeaponId.Railgun);
      entity.client!.inventory.currentWeapon = WeaponId.Railgun;
      entity.client!.inventory.ammo.counts[AmmoType.Slugs] = 0;

      entity.client!.inventory.ownedWeapons.add(WeaponId.Shotgun);
      entity.client!.inventory.ammo.counts[AmmoType.Shells] = 10;

      NoAmmoWeaponChange(entity);

      // Should initiate drop of Railgun
      expect(entity.client!.newWeapon).toBe(WeaponId.Shotgun);
      expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_DROPPING);
  });

  it('should finalize switch when ChangeWeapon called without ID', () => {
      entity.client!.newWeapon = WeaponId.Shotgun;
      entity.client!.inventory.ownedWeapons.add(WeaponId.Shotgun);

      ChangeWeapon(entity); // No ID, finish switch

      expect(entity.client!.inventory.currentWeapon).toBe(WeaponId.Shotgun);
      expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_ACTIVATING);
      expect(entity.client!.gun_frame).toBe(0);
      expect(entity.client!.newWeapon).toBeUndefined();
  });

  it('should advance drop animation and switch weapon in Weapon_Generic', () => {
      // Setup dropping state
      entity.client!.inventory.currentWeapon = WeaponId.Shotgun;
      entity.client!.inventory.ownedWeapons.add(WeaponId.Shotgun);
      entity.client!.inventory.ownedWeapons.add(WeaponId.Machinegun);

      ChangeWeapon(entity, WeaponId.Machinegun);

      expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_DROPPING);

      // Advance frames
      // gun_frame starts at IDLE_LAST + 1 (37)
      // DEACTIVATE_LAST is 39

      // Frame 37 -> 38
      sys.timeSeconds += 0.1;
      Weapon_Generic(entity, FRAME_SHOTGUN_ACTIVATE_LAST, FRAME_SHOTGUN_FIRE_LAST, FRAME_SHOTGUN_IDLE_LAST, FRAME_SHOTGUN_DEACTIVATE_LAST, [], [], vi.fn(), sys);
      expect(entity.client!.gun_frame).toBe(FRAME_SHOTGUN_IDLE_LAST + 2); // 38
      expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_DROPPING);

      // Frame 38 -> 39
      sys.timeSeconds += 0.1;
      Weapon_Generic(entity, FRAME_SHOTGUN_ACTIVATE_LAST, FRAME_SHOTGUN_FIRE_LAST, FRAME_SHOTGUN_IDLE_LAST, FRAME_SHOTGUN_DEACTIVATE_LAST, [], [], vi.fn(), sys);
      expect(entity.client!.gun_frame).toBe(FRAME_SHOTGUN_IDLE_LAST + 3); // 39
       expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_DROPPING);

      // Frame 39 (Last) -> Finish Switch
      sys.timeSeconds += 0.1;
      Weapon_Generic(entity, FRAME_SHOTGUN_ACTIVATE_LAST, FRAME_SHOTGUN_FIRE_LAST, FRAME_SHOTGUN_IDLE_LAST, FRAME_SHOTGUN_DEACTIVATE_LAST, [], [], vi.fn(), sys);

      // Should have switched
      expect(entity.client!.inventory.currentWeapon).toBe(WeaponId.Machinegun);
      expect(entity.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_ACTIVATING);
      expect(entity.client!.gun_frame).toBe(0);
  });
});
