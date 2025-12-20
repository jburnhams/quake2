import { Entity, Item, PlayerInventory, createPlayerInventory, AmmoType } from '@quake2ts/game';
import { vi, type Mock } from 'vitest';

export interface MockInventory extends PlayerInventory {
  addItem: Mock<[Item, number], boolean>;
  useItem: Mock<[Item], boolean>;
  hasItem: Mock<[Item], boolean>;
}

export function createMockInventory(overrides: Partial<PlayerInventory> = {}): MockInventory {
  const inventory = createPlayerInventory();

  return Object.assign(inventory, {
    addItem: vi.fn(),
    useItem: vi.fn(),
    hasItem: vi.fn(),
    ...overrides
  }) as unknown as MockInventory;
}

export function createMockItem(itemType: string, overrides: Partial<Item> = {}): Item {
  return {
    id: itemType,
    name: itemType,
    pickup_name: itemType,
    icon: 'icons/generic',
    pickup: vi.fn(),
    use: vi.fn(),
    drop: vi.fn(),
    tag: 0,
    flags: 0,
    quantity: 1,
    ammo_type: AmmoType.Shells,
    ...overrides
  } as unknown as Item;
}

export function createMockWeaponItem(weaponName: string): Item {
  return createMockItem(weaponName, {
    // flags: 0 // IT_WEAPON - flags removed from Item type
  } as any);
}

export function createMockAmmoItem(ammoName: string): Item {
  return createMockItem(ammoName, {
    // flags: 0 // IT_AMMO
  } as any);
}

export function createMockArmorItem(armorName: string): Item {
  return createMockItem(armorName, {
    // flags: 0 // IT_ARMOR
  } as any);
}

export function createMockHealthItem(healthName: string): Item {
  return createMockItem(healthName, {
    // flags: 0 // IT_HEALTH
  } as any);
}

export function createMockPowerup(powerupType: string, duration: number = 30): Item {
  return createMockItem(powerupType, {
    // flags: 0 // IT_POWERUP
  } as any);
}
