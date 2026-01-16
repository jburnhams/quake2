import { describe, expect, it } from 'vitest';

import { ArmorType } from '../../src/combat/armor.js';
import { AMMO_TYPE_COUNT } from '../../src/inventory/ammo.js';
import {
  AmmoItemId,
  AmmoType,
  KeyId,
  PowerupId,
  WeaponId,
  clearExpiredPowerups,
  createPlayerInventory,
  equipArmor,
  addAmmo as giveAmmo,
  giveAmmoItem,
  giveWeapon,
  hasKey,
  hasPowerup,
  hasWeapon,
  selectWeapon,
  addKey,
  addPowerup,
} from '../../src/inventory/index.js';

describe('player inventory creation', () => {
  it('seeds base ammo caps and empty counts', () => {
    const inventory = createPlayerInventory();

    expect(inventory.ammo.counts).toHaveLength(AMMO_TYPE_COUNT);
    expect(inventory.ammo.caps[AmmoType.Bullets]).toBe(200);
    expect(inventory.ammo.caps[AmmoType.Shells]).toBe(100);
    expect(inventory.ammo.caps[AmmoType.Cells]).toBe(200);
    expect(inventory.ammo.counts.every((count) => count === 0)).toBe(true);
  });
});

describe('ammo helpers', () => {
  it('clamps ammo when giving directly', () => {
    const inventory = createPlayerInventory();
    inventory.ammo.counts[AmmoType.Rockets] = 48;

    const result = giveAmmo(inventory.ammo, AmmoType.Rockets, 5);

    expect(result.added).toBe(2);
    expect(inventory.ammo.counts[AmmoType.Rockets]).toBe(50);
  });

  it('delegates pickup logic when using ammo items', () => {
    const inventory = createPlayerInventory();
    inventory.ammo.counts[AmmoType.Cells] = 195;

    const result = giveAmmoItem(inventory, AmmoItemId.Cells);

    expect(result.newCount).toBe(200);
    expect(result.added).toBe(5);
  });
});

describe('weapons and selection', () => {
  it('tracks owned weapons and selection restrictions', () => {
    const inventory = createPlayerInventory();

    let wasNew = giveWeapon(inventory, WeaponId.Shotgun);
    expect(wasNew).toBe(true);
    expect(hasWeapon(inventory, WeaponId.Shotgun)).toBe(true);
    // Expect Blaster because it is the only weapon
    expect(inventory.currentWeapon).toBe(WeaponId.Blaster);

    wasNew = giveWeapon(inventory, WeaponId.Shotgun);
    expect(wasNew).toBe(false);
    expect(hasWeapon(inventory, WeaponId.Shotgun)).toBe(true);
    // Should NOT auto-select unless specified, but logic says if current is null?
    // Blaster is default.
    // However, giveWeapon(..., true) selects it.
    // giveWeapon(..., false) does not select it if we already have a weapon.
    expect(inventory.currentWeapon).toBe(WeaponId.Blaster);

    expect(selectWeapon(inventory, WeaponId.BFG10K)).toBe(false);
    expect(inventory.currentWeapon).toBe(WeaponId.Blaster);

    // Now explicit select
    selectWeapon(inventory, WeaponId.Shotgun);
    expect(inventory.currentWeapon).toBe(WeaponId.Shotgun);

    giveWeapon(inventory, WeaponId.BFG10K, true);
    expect(inventory.currentWeapon).toBe(WeaponId.BFG10K);
  });
});

describe('armor state', () => {
  it('clamps armor to rerelease max counts', () => {
    const inventory = createPlayerInventory();

    const equipped = equipArmor(inventory, ArmorType.JACKET, 180);

    expect(equipped).toEqual({ armorType: ArmorType.JACKET, armorCount: 50 });
    expect(inventory.armor?.armorCount).toBe(50);

    const cleared = equipArmor(inventory, null, 0);
    expect(cleared).toBeNull();
    expect(inventory.armor).toBeNull();
  });
});

describe('powerups and keys', () => {
  it('drops expired powerups and keeps perpetual ones', () => {
    const inventory = createPlayerInventory();

    addPowerup(inventory, PowerupId.QuadDamage, 10000);
    addPowerup(inventory, PowerupId.Silencer, null);

    expect(hasPowerup(inventory, PowerupId.QuadDamage)).toBe(true);
    clearExpiredPowerups(inventory, 12000);

    expect(hasPowerup(inventory, PowerupId.QuadDamage)).toBe(false);
    expect(hasPowerup(inventory, PowerupId.Silencer)).toBe(true);
  });

  it('adds keys without duplicates', () => {
    const inventory = createPlayerInventory();

    expect(addKey(inventory, KeyId.Blue)).toBe(true);
    expect(addKey(inventory, KeyId.Blue)).toBe(false);
    expect(hasKey(inventory, KeyId.Blue)).toBe(true);
  });
});
