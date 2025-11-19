import { describe, expect, it } from 'vitest';

import { AmmoType, clampAmmoCounts, createBaseAmmoCaps } from '../src/inventory/ammo.js';

describe('ammo caps', () => {
  it('matches the rerelease defaults for base campaign ammo types', () => {
    const caps = createBaseAmmoCaps();

    expect(caps).toHaveLength(6);
    expect(caps[AmmoType.Bullets]).toBe(200);
    expect(caps[AmmoType.Shells]).toBe(100);
    expect(caps[AmmoType.Rockets]).toBe(50);
    expect(caps[AmmoType.Grenades]).toBe(50);
    expect(caps[AmmoType.Cells]).toBe(200);
    expect(caps[AmmoType.Slugs]).toBe(50);
  });

  it('clamps ammo counts to the configured caps without mutating input', () => {
    const caps = createBaseAmmoCaps();
    const counts = [500, 125, 10, 5, 900, 80];

    const clamped = clampAmmoCounts(counts, caps);

    expect(clamped).toEqual([200, 100, 10, 5, 200, 50]);
    expect(counts).toEqual([500, 125, 10, 5, 900, 80]);
  });
});
