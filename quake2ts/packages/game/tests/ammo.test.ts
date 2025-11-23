import { describe, expect, it } from 'vitest';

import { AmmoType, AMMO_TYPE_COUNT, clampAmmoCounts, createBaseAmmoCaps } from '../src/inventory/ammo.js';

describe('ammo caps', () => {
  it('matches the rerelease defaults for base campaign ammo types', () => {
    const caps = createBaseAmmoCaps();

    expect(caps).toHaveLength(AMMO_TYPE_COUNT);
    expect(caps[AmmoType.Bullets]).toBe(200);
    expect(caps[AmmoType.Shells]).toBe(100);
    expect(caps[AmmoType.Rockets]).toBe(50);
    expect(caps[AmmoType.Grenades]).toBe(50);
    expect(caps[AmmoType.Cells]).toBe(200);
    expect(caps[AmmoType.Slugs]).toBe(50);
  });

  it('clamps ammo counts to the configured caps without mutating input', () => {
    const caps = createBaseAmmoCaps();
    // Create an array of size AMMO_TYPE_COUNT with some large values
    const counts = new Array(AMMO_TYPE_COUNT).fill(1000);
    // Set specific test values
    counts[AmmoType.Bullets] = 500;
    counts[AmmoType.Shells] = 125;
    counts[AmmoType.Rockets] = 10;
    counts[AmmoType.Grenades] = 5;
    counts[AmmoType.Cells] = 900;
    counts[AmmoType.Slugs] = 80;

    const clamped = clampAmmoCounts(counts, caps);

    expect(clamped[AmmoType.Bullets]).toBe(200);
    expect(clamped[AmmoType.Shells]).toBe(100);
    expect(clamped[AmmoType.Rockets]).toBe(10);
    expect(clamped[AmmoType.Grenades]).toBe(5);
    expect(clamped[AmmoType.Cells]).toBe(200);
    expect(clamped[AmmoType.Slugs]).toBe(50);

    // Verify inputs were not mutated
    expect(counts[AmmoType.Bullets]).toBe(500);
  });
});
