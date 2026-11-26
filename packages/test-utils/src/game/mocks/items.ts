import {
  type PlayerInventory,
  createPlayerInventory,
  WeaponId,
  PowerupId,
  KeyId,
  createAmmoInventory
} from '@quake2ts/game';
import {
  type BaseItem,
  type WeaponItem,
  type HealthItem,
  type ArmorItem,
  type PowerupItem,
  type PowerArmorItem,
  type KeyItem,
  type FlagItem,
  WEAPON_ITEMS,
  HEALTH_ITEMS,
  ARMOR_ITEMS,
  POWERUP_ITEMS,
  POWER_ARMOR_ITEMS,
  KEY_ITEMS,
  FLAG_ITEMS,
  getAmmoItemDefinition,
  AmmoItemId
} from '@quake2ts/game';

/**
 * Creates a mock player inventory with default values suitable for testing.
 * Can be customized with overrides.
 *
 * @param overrides - Partial PlayerInventory properties.
 * @returns A complete PlayerInventory object.
 */
export function createMockInventory(overrides: Partial<PlayerInventory> = {}): PlayerInventory {
  const defaultInventory = createPlayerInventory();

  // Merge simple properties
  const inventory: PlayerInventory = {
    ...defaultInventory,
    ...overrides
  };

  // If overrides.ammo is provided (as a full object), it replaces the default.
  // We don't merge deeper here because the caller usually provides a complete mock
  // or is happy with the default structure.

  return inventory;
}

/**
 * Generic factory for any item type.
 * Attempts to find a predefined item by ID first, then applies overrides.
 *
 * @param id - The item ID (e.g. 'weapon_railgun', 'item_health').
 * @param overrides - Partial BaseItem properties.
 * @returns A BaseItem object.
 */
export function createMockItem(id: string, overrides: Partial<BaseItem> = {}): BaseItem {
  let base: BaseItem | undefined;

  // Search in all registries
  base = WEAPON_ITEMS[id] ||
         HEALTH_ITEMS[id] ||
         ARMOR_ITEMS[id] ||
         POWERUP_ITEMS[id] ||
         POWER_ARMOR_ITEMS[id] ||
         KEY_ITEMS[id] ||
         FLAG_ITEMS[id];

  if (!base) {
    // If not found, create a generic minimal item
    base = {
      id,
      name: `Mock Item ${id}`
    };
  }

  return {
    ...base,
    ...overrides
  };
}

/**
 * Creates a mock WeaponItem based on a WeaponId.
 *
 * @param weaponId - The WeaponId (e.g. WeaponId.Railgun).
 * @param overrides - Partial WeaponItem properties.
 * @returns A WeaponItem object.
 */
export function createMockWeaponItem(weaponId: WeaponId, overrides: Partial<WeaponItem> = {}): WeaponItem {
    // Find the item definition for this weaponId
    const found = Object.values(WEAPON_ITEMS).find(w => w.weaponId === weaponId);

    const base: WeaponItem = found ? { ...found } : {
        type: 'weapon',
        id: `weapon_${weaponId}`,
        name: `Mock Weapon ${weaponId}`,
        weaponId,
        ammoType: null,
        initialAmmo: 0,
        pickupAmmo: 0,
        fireRate: 1
    };

    return { ...base, ...overrides };
}

/**
 * Creates a mock HealthItem with a specific amount.
 *
 * @param amount - The health amount.
 * @param overrides - Partial HealthItem properties.
 * @returns A HealthItem object.
 */
export function createMockHealthItem(amount: number, overrides: Partial<HealthItem> = {}): HealthItem {
    return {
        type: 'health',
        id: 'item_health_mock',
        name: 'Mock Health',
        amount,
        max: 100,
        ...overrides
    };
}

/**
 * Creates a mock ArmorItem with a specific amount.
 *
 * @param amount - The armor amount.
 * @param overrides - Partial ArmorItem properties.
 * @returns An ArmorItem object.
 */
export function createMockArmorItem(amount: number, overrides: Partial<ArmorItem> = {}): ArmorItem {
    return {
        type: 'armor',
        id: 'item_armor_mock',
        name: 'Mock Armor',
        amount,
        ...overrides
    };
}

/**
 * Creates a mock AmmoItem based on an AmmoItemId.
 *
 * @param ammoItemId - The AmmoItemId.
 * @param overrides - Partial BaseItem properties.
 * @returns A BaseItem representing ammo.
 * @throws Error if ammoItemId is unknown.
 */
export function createMockAmmoItem(ammoItemId: AmmoItemId, overrides: Partial<BaseItem> = {}): BaseItem {
    const def = getAmmoItemDefinition(ammoItemId);
    if (!def) {
        throw new Error(`Unknown ammo item id: ${ammoItemId}`);
    }

    const base: BaseItem = {
        id: def.id,
        name: `Mock Ammo ${def.id}`
    };

    return {
        ...base,
        ...overrides
    };
}


/**
 * Creates a mock PowerupItem.
 *
 * @param id - The item ID (e.g. 'item_quad').
 * @param duration - The duration of the powerup.
 * @param overrides - Partial PowerupItem properties.
 * @returns A PowerupItem object.
 */
export function createMockPowerupItem(id: string, duration: number, overrides: Partial<PowerupItem> = {}): PowerupItem {
    const found = POWERUP_ITEMS[id];
    const base: PowerupItem = found ? { ...found } : {
        type: 'powerup',
        id,
        name: `Mock Powerup ${id}`,
        timer: duration
    };

    if (duration !== undefined && !found) {
        base.timer = duration;
    }

    return { ...base, ...overrides };
}
