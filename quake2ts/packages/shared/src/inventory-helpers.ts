import { PlayerState } from './protocol/index.js';
import { AmmoItemId, AmmoType, WeaponId } from './items/index.js';
import { G_GetAmmoStat } from './protocol/stats.js';
import { WEAPON_AMMO_MAP } from './items/index.js';
import { ConfigStringIndex } from './protocol/configstrings.js';

// Blaster uses no ammo in standard Q2.
// We handle mapping `AmmoItemId` (string) to `AmmoType` (enum).
export const AMMO_ITEM_MAP: Record<AmmoItemId, AmmoType> = {
  [AmmoItemId.Shells]: AmmoType.Shells,
  [AmmoItemId.Bullets]: AmmoType.Bullets,
  [AmmoItemId.Rockets]: AmmoType.Rockets,
  [AmmoItemId.Grenades]: AmmoType.Grenades,
  [AmmoItemId.Cells]: AmmoType.Cells,
  [AmmoItemId.Slugs]: AmmoType.Slugs,
  [AmmoItemId.MagSlugs]: AmmoType.MagSlugs,
  [AmmoItemId.Flechettes]: AmmoType.Flechettes,
  [AmmoItemId.Disruptor]: AmmoType.Disruptor,
  [AmmoItemId.Tesla]: AmmoType.Tesla,
  [AmmoItemId.Trap]: AmmoType.Trap,
  [AmmoItemId.Prox]: AmmoType.Prox,
};

/**
 * Retrieves the ammo count for a given item (Weapon or Ammo).
 * @param playerState The current player state.
 * @param item The item identifier (WeaponId or AmmoItemId).
 * @returns The ammo count, or 0 if not found/applicable. Returns -1 for infinite ammo (e.g. Blaster).
 */
export function getAmmoCount(playerState: PlayerState, item: WeaponId | AmmoItemId): number {
  let ammoType: AmmoType | null | undefined;

  // Check if it's an Ammo Item ID
  if (Object.values(AmmoItemId).includes(item as AmmoItemId)) {
    ammoType = AMMO_ITEM_MAP[item as AmmoItemId];
  }
  // Check if it's a Weapon ID
  else if (Object.values(WeaponId).includes(item as WeaponId)) {
    ammoType = WEAPON_AMMO_MAP[item as WeaponId];

    // Existing map has null for Blaster, Grapple, etc.
    if (ammoType === null) {
        return -1;
    }
  }

  if (ammoType === undefined || ammoType === null) {
    return 0;
  }

  return G_GetAmmoStat(playerState.stats, ammoType);
}

/**
 * Resolves the icon path for a given stat index (e.g. STAT_SELECTED_ICON).
 * @param statIndex The index in the stats array to read (e.g. PlayerStat.STAT_SELECTED_ICON).
 * @param playerState The player state containing the stats.
 * @param configStrings The array of configuration strings (from client state).
 * @returns The path to the icon image, or undefined if invalid.
 */
export function getIconPath(
  statIndex: number,
  playerState: PlayerState,
  configStrings: string[]
): string | undefined {
  const iconIndex = playerState.stats[statIndex];

  // 0 usually means no icon or null
  if (iconIndex === undefined || iconIndex <= 0) {
    return undefined;
  }

  // The value in the stat is the index into the Config Strings relative to ConfigStringIndex.Images.
  const configIndex = ConfigStringIndex.Images + iconIndex;

  if (configIndex < 0 || configIndex >= configStrings.length) {
    return undefined;
  }

  return configStrings[configIndex];
}
