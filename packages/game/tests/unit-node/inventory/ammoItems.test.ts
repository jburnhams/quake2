import { describe, expect, it } from 'vitest';

import {
  AMMO_TYPE_COUNT,
  AmmoItemId,
  AmmoType,
  addAmmo,
  getAmmoItemDefinition,
  pickupAmmo,
} from '../../../src/inventory/ammo.js';
import { createMockInventory, createMockAmmoItem } from '@quake2ts/test-utils';

function makeInventory(starting?: Partial<Record<AmmoType, number>>) {
  // Use createMockInventory to create a complete inventory, but extract/manipulate the ammo part as needed by tests.
  // However, createMockInventory returns PlayerInventory which contains ammo property.
  // The tests here use `createAmmoInventory` which returns just the AmmoInventory part.
  // We can use createMockInventory and access .ammo

  const inventory = createMockInventory();
  if (starting) {
    for (const [key, value] of Object.entries(starting)) {
      const ammo = Number(key) as AmmoType;
      inventory.ammo.counts[ammo] = value!;
    }
  }
  return inventory.ammo;
}

describe('ammo item definitions', () => {
  it('match rerelease quantities and ammo mappings', () => {
    const shells = getAmmoItemDefinition(AmmoItemId.Shells);
    const bullets = getAmmoItemDefinition(AmmoItemId.Bullets);
    const rockets = getAmmoItemDefinition(AmmoItemId.Rockets);
    const grenades = getAmmoItemDefinition(AmmoItemId.Grenades);
    const cells = getAmmoItemDefinition(AmmoItemId.Cells);
    const slugs = getAmmoItemDefinition(AmmoItemId.Slugs);

    expect(shells.quantity).toBe(10);
    expect(shells.ammoType).toBe(AmmoType.Shells);

    expect(bullets.quantity).toBe(50);
    expect(bullets.ammoType).toBe(AmmoType.Bullets);

    expect(cells.quantity).toBe(50);
    expect(cells.ammoType).toBe(AmmoType.Cells);

    expect(rockets.quantity).toBe(5);
    expect(rockets.ammoType).toBe(AmmoType.Rockets);

    expect(slugs.quantity).toBe(10);
    expect(slugs.ammoType).toBe(AmmoType.Slugs);

    expect(grenades.quantity).toBe(5);
    expect(grenades.ammoType).toBe(AmmoType.Grenades);
    expect(grenades.weaponAmmo).toBe(true);
  });
});

describe('adding ammo', () => {
  it('caps ammo at the configured maximum like G_AddAmmoAndCap', () => {
    const inventory = makeInventory({ [AmmoType.Bullets]: 195 });

    const result = addAmmo(inventory, AmmoType.Bullets, 20);

    expect(result).toEqual({
      ammoType: AmmoType.Bullets,
      added: 5,
      newCount: 200,
      capped: 200,
      pickedUp: true,
    });
    expect(inventory.counts[AmmoType.Bullets]).toBe(200);
  });

  it('returns falsey pickup flag when already at cap', () => {
    const inventory = makeInventory({ [AmmoType.Shells]: 100 });

    const result = addAmmo(inventory, AmmoType.Shells, 10);

    expect(result.pickedUp).toBe(false);
    expect(result.added).toBe(0);
    expect(result.newCount).toBe(100);
  });
});

describe('ammo pickups', () => {
  it('uses definition quantity when no override is provided', () => {
    const inventory = makeInventory({});

    const result = pickupAmmo(inventory, AmmoItemId.Rockets);

    expect(result.added).toBe(5);
    expect(inventory.counts[AmmoType.Rockets]).toBe(5);
  });

  it('applies overrides like dropped ammo counts in the rerelease', () => {
    const inventory = makeInventory({ [AmmoType.Grenades]: 48 });

    const result = pickupAmmo(inventory, AmmoItemId.Grenades, { countOverride: 20 });

    expect(result).toEqual({
      ammoType: AmmoType.Grenades,
      added: 2,
      newCount: 50,
      capped: 50,
      pickedUp: true,
    });
    expect(inventory.counts[AmmoType.Grenades]).toBe(50);
  });

  it('respects individual caps for every ammo type', () => {
    const inventory = makeInventory({}); // defaults

    // prime inventory with near-cap values for every slot
    for (let i = 0; i < AMMO_TYPE_COUNT; i++) {
      inventory.counts[i] = (inventory.caps[i] ?? 0) - 1;
    }

    const pickedUp = pickupAmmo(inventory, AmmoItemId.Cells);

    expect(pickedUp.newCount).toBe(200);
    expect(pickedUp.added).toBe(1);
    expect(inventory.counts[AmmoType.Cells]).toBe(200);
  });
});
