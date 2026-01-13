import { describe, expect, it } from 'vitest';
import { WEAPON_WHEEL_ORDER, WEAPON_AMMO_MAP } from '../../src/items/weaponInfo.js';
import { WeaponId } from '../../src/items/weapons.js';
import { AmmoType } from '../../src/items/ammo.js';

describe('items/weaponInfo', () => {
  it('defines correct WEAPON_WHEEL_ORDER', () => {
    const expectedOrder = [
      WeaponId.Blaster,
      WeaponId.Shotgun,
      WeaponId.SuperShotgun,
      WeaponId.Machinegun,
      WeaponId.Chaingun,
      WeaponId.GrenadeLauncher,
      WeaponId.RocketLauncher,
      WeaponId.HandGrenade,
      WeaponId.HyperBlaster,
      WeaponId.Railgun,
      WeaponId.BFG10K
    ];

    expect(WEAPON_WHEEL_ORDER).toEqual(expectedOrder);
    expect(WEAPON_WHEEL_ORDER).toHaveLength(11);
  });

  it('maps weapons to correct ammo types', () => {
    expect(WEAPON_AMMO_MAP[WeaponId.Blaster]).toBeNull();
    expect(WEAPON_AMMO_MAP[WeaponId.Shotgun]).toBe(AmmoType.Shells);
    expect(WEAPON_AMMO_MAP[WeaponId.SuperShotgun]).toBe(AmmoType.Shells);
    expect(WEAPON_AMMO_MAP[WeaponId.Machinegun]).toBe(AmmoType.Bullets);
    expect(WEAPON_AMMO_MAP[WeaponId.Chaingun]).toBe(AmmoType.Bullets);
    expect(WEAPON_AMMO_MAP[WeaponId.HandGrenade]).toBe(AmmoType.Grenades);
    expect(WEAPON_AMMO_MAP[WeaponId.GrenadeLauncher]).toBe(AmmoType.Grenades);
    expect(WEAPON_AMMO_MAP[WeaponId.RocketLauncher]).toBe(AmmoType.Rockets);
    expect(WEAPON_AMMO_MAP[WeaponId.HyperBlaster]).toBe(AmmoType.Cells);
    expect(WEAPON_AMMO_MAP[WeaponId.Railgun]).toBe(AmmoType.Slugs);
    expect(WEAPON_AMMO_MAP[WeaponId.BFG10K]).toBe(AmmoType.Cells);
  });

  it('maps expansion weapons to correct ammo types', () => {
    expect(WEAPON_AMMO_MAP[WeaponId.Grapple]).toBeNull();
    expect(WEAPON_AMMO_MAP[WeaponId.EtfRifle]).toBe(AmmoType.Flechettes);
    expect(WEAPON_AMMO_MAP[WeaponId.Phalanx]).toBe(AmmoType.MagSlugs);
    expect(WEAPON_AMMO_MAP[WeaponId.Disruptor]).toBe(AmmoType.Disruptor);
  });
});
