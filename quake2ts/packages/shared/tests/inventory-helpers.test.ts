import { describe, it, expect } from 'vitest';
import { getAmmoCount, getIconPath } from '../src/inventory-helpers.js';
import { PlayerState, PlayerStat } from '../src/protocol/index.js';
import { WeaponId, AmmoItemId } from '../src/items/index.js';
import { G_SetAmmoStat } from '../src/protocol/stats.js';
import { AmmoType } from '../src/items/ammo.js';

describe('Inventory Helpers', () => {
  describe('getAmmoCount', () => {
    it('should return correct ammo count for a given weapon', () => {
      const stats = new Array(32).fill(0);
      const ps = { stats } as unknown as PlayerState;

      // Set some shells
      G_SetAmmoStat(stats, AmmoType.Shells, 50);

      const count = getAmmoCount(ps, WeaponId.Shotgun);
      expect(count).toBe(50);
    });

    it('should return correct ammo count for a given ammo item', () => {
      const stats = new Array(32).fill(0);
      const ps = { stats } as unknown as PlayerState;

      // Set some rockets
      G_SetAmmoStat(stats, AmmoType.Rockets, 20);

      const count = getAmmoCount(ps, AmmoItemId.Rockets);
      expect(count).toBe(20);
    });

    it('should return 0 for unknown ammo', () => {
      const stats = new Array(32).fill(0);
      const ps = { stats } as unknown as PlayerState;

      // Assuming 'invalid' as WeaponId
      const count = getAmmoCount(ps, 'invalid' as WeaponId);
      expect(count).toBe(0);
    });

    it('should handle Blaster (infinite/no ammo)', () => {
      const stats = new Array(32).fill(0);
      const ps = { stats } as unknown as PlayerState;

      const count = getAmmoCount(ps, WeaponId.Blaster);
      expect(count).toBe(-1); // Infinite
    });
  });

  describe('getIconPath', () => {
    it('should return the correct icon path from config strings', () => {
      const stats = new Array(32).fill(0);
      // Mock player state
      const ps = { stats } as unknown as PlayerState;

      // Mock config strings
      // CS_IMAGES = 32.
      const configStrings = new Array(100).fill('');
      configStrings[32 + 5] = 'pics/w_railgun.pcx';

      // Set STAT_SELECTED_ICON (index 6) to 5.
      ps.stats[PlayerStat.STAT_SELECTED_ICON] = 5;

      const path = getIconPath(PlayerStat.STAT_SELECTED_ICON, ps, configStrings);
      expect(path).toBe('pics/w_railgun.pcx');
    });

    it('should return undefined if stat is 0', () => {
      const stats = new Array(32).fill(0);
      const ps = { stats } as unknown as PlayerState;
      const configStrings = new Array(100).fill('');

      ps.stats[PlayerStat.STAT_SELECTED_ICON] = 0;

      const path = getIconPath(PlayerStat.STAT_SELECTED_ICON, ps, configStrings);
      expect(path).toBeUndefined();
    });

    it('should return undefined if config string index is out of bounds', () => {
      const stats = new Array(32).fill(0);
      const ps = { stats } as unknown as PlayerState;
      const configStrings = new Array(40).fill(''); // Too short

      ps.stats[PlayerStat.STAT_SELECTED_ICON] = 50; // 32 + 50 = 82 > 40

      const path = getIconPath(PlayerStat.STAT_SELECTED_ICON, ps, configStrings);
      expect(path).toBeUndefined();
    });
  });
});
