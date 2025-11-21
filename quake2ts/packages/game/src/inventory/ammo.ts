export enum AmmoType {
  Bullets = 0,
  Shells,
  Rockets,
  Grenades,
  Cells,
  Slugs,
}

export const AMMO_TYPE_COUNT = Object.keys(AmmoType).length / 2;

export type AmmoCaps = readonly number[];

export type AmmoSeed = Partial<Record<AmmoType, number>>;

export interface AmmoInventory {
  readonly caps: AmmoCaps;
  counts: number[];
}

export interface AmmoAdjustmentResult {
  readonly ammoType: AmmoType;
  readonly added: number;
  readonly newCount: number;
  readonly capped: number;
  readonly pickedUp: boolean;
}

export enum AmmoItemId {
  Shells = 'ammo_shells',
  Bullets = 'ammo_bullets',
  Rockets = 'ammo_rockets',
  Grenades = 'ammo_grenades',
  Cells = 'ammo_cells',
  Slugs = 'ammo_slugs',
}

export interface AmmoItemDefinition {
  readonly id: AmmoItemId;
  readonly ammoType: AmmoType;
  readonly quantity: number;
  readonly weaponAmmo: boolean;
}

const AMMO_ITEM_DEFINITIONS: Record<AmmoItemId, AmmoItemDefinition> = {
  [AmmoItemId.Shells]: { id: AmmoItemId.Shells, ammoType: AmmoType.Shells, quantity: 10, weaponAmmo: false },
  [AmmoItemId.Bullets]: { id: AmmoItemId.Bullets, ammoType: AmmoType.Bullets, quantity: 50, weaponAmmo: false },
  [AmmoItemId.Rockets]: { id: AmmoItemId.Rockets, ammoType: AmmoType.Rockets, quantity: 5, weaponAmmo: false },
  [AmmoItemId.Grenades]: { id: AmmoItemId.Grenades, ammoType: AmmoType.Grenades, quantity: 5, weaponAmmo: true },
  [AmmoItemId.Cells]: { id: AmmoItemId.Cells, ammoType: AmmoType.Cells, quantity: 50, weaponAmmo: false },
  [AmmoItemId.Slugs]: { id: AmmoItemId.Slugs, ammoType: AmmoType.Slugs, quantity: 10, weaponAmmo: false },
};

export function getAmmoItemDefinition(id: AmmoItemId): AmmoItemDefinition {
  return AMMO_ITEM_DEFINITIONS[id];
}

export function createAmmoInventory(caps: AmmoCaps = createBaseAmmoCaps(), seed?: AmmoSeed): AmmoInventory {
  const counts = Array(AMMO_TYPE_COUNT).fill(0);
  if (seed) {
    for (const [ammoType, count] of Object.entries(seed)) {
      counts[Number(ammoType)] = count;
    }
  }
  return { caps: caps.slice(), counts };
}

/**
 * Mirrors the rerelease defaults in p_client.cpp where max ammo counts are
 * seeded to 50, then overridden for select types (bullets/shells/cells).
 */
export function createBaseAmmoCaps(): number[] {
  const caps = Array(AMMO_TYPE_COUNT).fill(50);
  caps[AmmoType.Bullets] = 200;
  caps[AmmoType.Shells] = 100;
  caps[AmmoType.Cells] = 200;
  return caps;
}

export function clampAmmoCounts(counts: readonly number[], caps: AmmoCaps): number[] {
  const limit = Math.min(counts.length, caps.length);
  const clamped: number[] = counts.slice(0, limit);

  for (let i = 0; i < limit; i++) {
    const cap = caps[i];
    if (cap !== undefined) {
      clamped[i] = Math.min(counts[i], cap);
    }
  }

  return clamped;
}

export function addAmmo(inventory: AmmoInventory, ammoType: AmmoType, amount: number): AmmoAdjustmentResult {
  const cap = inventory.caps[ammoType];
  const current = inventory.counts[ammoType] ?? 0;

  if (cap !== undefined && current >= cap) {
    return { ammoType, added: 0, newCount: current, capped: cap, pickedUp: false };
  }

  const uncapped = current + amount;
  const newCount = cap === undefined ? uncapped : Math.min(uncapped, cap);
  const added = newCount - current;

  inventory.counts[ammoType] = newCount;

  return { ammoType, added, newCount, capped: cap ?? Number.POSITIVE_INFINITY, pickedUp: added > 0 };
}

export interface AmmoPickupOptions {
  readonly countOverride?: number;
}

export function pickupAmmo(
  inventory: AmmoInventory,
  itemId: AmmoItemId,
  options: AmmoPickupOptions = {},
): AmmoAdjustmentResult {
  const def = getAmmoItemDefinition(itemId);
  const amount = options.countOverride ?? def.quantity;

  return addAmmo(inventory, def.ammoType, amount);
}
