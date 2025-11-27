/**
 * Ammo type identifiers shared across game and cgame.
 * Reference: rerelease/g_items.cpp, game/src/inventory/ammo.ts
 */

export enum AmmoType {
  Bullets = 0,
  Shells,
  Rockets,
  Grenades,
  Cells,
  Slugs,
  // New additions
  Trap,
  Tesla,
  MagSlugs,
  Flechettes,
  Prox,
  Nuke,
  Rounds,
}

export const AMMO_TYPE_COUNT = Object.keys(AmmoType).length / 2;

/**
 * Item classnames for ammo pickups.
 * Used for spawning and identifying ammo items.
 */
export enum AmmoItemId {
  Shells = 'ammo_shells',
  Bullets = 'ammo_bullets',
  Rockets = 'ammo_rockets',
  Grenades = 'ammo_grenades',
  Cells = 'ammo_cells',
  Slugs = 'ammo_slugs',
}
