import { describe, expect, it } from 'vitest';
import { WeaponId } from '../../../src/inventory/index.js';
import { createPlayerInventory, deserializePlayerInventory, serializePlayerInventory } from '../../../src/inventory/playerInventory.js';

describe('Player Inventory Serialization', () => {
  it('should serialize and deserialize player inventory', () => {
    const inventory = createPlayerInventory({
      weapons: [WeaponId.Shotgun, WeaponId.SuperShotgun],
      currentWeapon: WeaponId.Shotgun,
    });
    const serialized = serializePlayerInventory(inventory);
    const deserialized = deserializePlayerInventory(serialized);

    expect(deserialized.ownedWeapons).toEqual(new Set([WeaponId.Shotgun, WeaponId.SuperShotgun]));
    expect(deserialized.currentWeapon).toEqual(WeaponId.Shotgun);
  });
});
