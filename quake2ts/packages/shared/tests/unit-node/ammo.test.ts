import { describe, expect, it } from 'vitest';
import { AmmoItemId, AmmoType, AMMO_TYPE_COUNT } from '../../src/items/ammo.js';

describe('items/ammo', () => {
  it('defines correct AmmoType enum values', () => {
    // Basic types
    expect(AmmoType.Bullets).toBe(0);
    expect(AmmoType.Shells).toBe(1);
    expect(AmmoType.Rockets).toBe(2);
    expect(AmmoType.Grenades).toBe(3);
    expect(AmmoType.Cells).toBe(4);
    expect(AmmoType.Slugs).toBe(5);
  });

  it('defines expansion AmmoType enum values', () => {
    // Ensure expansion types are present and distinct
    expect(AmmoType.MagSlugs).toBeGreaterThan(AmmoType.Slugs);
    expect(AmmoType.Trap).toBeGreaterThan(AmmoType.MagSlugs);
    expect(AmmoType.Flechettes).toBeGreaterThan(AmmoType.Trap);
  });

  it('calculates AMMO_TYPE_COUNT correctly', () => {
    // This is a dynamic check based on the enum size
    expect(AMMO_TYPE_COUNT).toBeGreaterThan(0);
    expect(Number.isInteger(AMMO_TYPE_COUNT)).toBe(true);
  });

  it('defines correct AmmoItemId string values', () => {
    expect(AmmoItemId.Shells).toBe('ammo_shells');
    expect(AmmoItemId.Bullets).toBe('ammo_bullets');
    expect(AmmoItemId.Rockets).toBe('ammo_rockets');
    expect(AmmoItemId.Grenades).toBe('ammo_grenades');
    expect(AmmoItemId.Cells).toBe('ammo_cells');
    expect(AmmoItemId.Slugs).toBe('ammo_slugs');
    expect(AmmoItemId.MagSlugs).toBe('ammo_magslug');
    expect(AmmoItemId.Flechettes).toBe('ammo_flechettes');
  });
});
