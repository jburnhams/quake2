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
  // RAFAEL
  MagSlugs,
  Trap,
  // RAFAEL
  // ROGUE
  Flechettes,
  Tesla,
  Disruptor, // Was missing or named differently?
  Prox,
  // ROGUE
  // Custom or Extras?
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
  MagSlugs = 'ammo_magslug',
  Flechettes = 'ammo_flechettes',
  Disruptor = 'ammo_disruptor',
  Tesla = 'ammo_tesla',
  Trap = 'ammo_trap',
}
