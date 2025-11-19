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
