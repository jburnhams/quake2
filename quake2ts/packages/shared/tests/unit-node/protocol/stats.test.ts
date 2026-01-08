import { describe, it, expect } from 'vitest';
import { G_SetAmmoStat, G_GetAmmoStat, G_SetPowerupStat, G_GetPowerupStat, PlayerStat } from '../../../src/protocol/stats.js';

describe('Stats Helpers', () => {
  describe('G_SetAmmoStat & G_GetAmmoStat', () => {
    it('should pack and unpack values correctly within 9-bit range', () => {
      const stats = new Array(64).fill(0);
      const ammoId = 0; // First ammo type
      const count = 100;

      G_SetAmmoStat(stats, ammoId, count);
      expect(G_GetAmmoStat(stats, ammoId)).toBe(count);
    });

    it('should clamp values larger than 511', () => {
      const stats = new Array(64).fill(0);
      G_SetAmmoStat(stats, 0, 1000);
      expect(G_GetAmmoStat(stats, 0)).toBe(511);
    });

    it('should clamp negative values to 0', () => {
      const stats = new Array(64).fill(0);
      G_SetAmmoStat(stats, 0, -100);
      expect(G_GetAmmoStat(stats, 0)).toBe(0);
    });

    it('should handle multiple ammo types without overlap', () => {
      const stats = new Array(64).fill(0);

      // Set distinct values for different ammo IDs
      // ID 0: 0 bits offset. (9 bits)
      // ID 1: 9 bits offset.
      G_SetAmmoStat(stats, 0, 511); // All 1s for 9 bits
      G_SetAmmoStat(stats, 1, 0);   // All 0s
      G_SetAmmoStat(stats, 2, 255); // Alternating? 0x0FF

      expect(G_GetAmmoStat(stats, 0)).toBe(511);
      expect(G_GetAmmoStat(stats, 1)).toBe(0);
      expect(G_GetAmmoStat(stats, 2)).toBe(255);

      // Change one, ensure others are unaffected
      G_SetAmmoStat(stats, 1, 123);
      expect(G_GetAmmoStat(stats, 0)).toBe(511);
      expect(G_GetAmmoStat(stats, 1)).toBe(123);
      expect(G_GetAmmoStat(stats, 2)).toBe(255);
    });

    it('should write to correct stats indices', () => {
      // STAT_AMMO_INFO_START is 34.
      // ID 0 (9 bits) should affect stats[34].
      const stats = new Array(64).fill(0);
      G_SetAmmoStat(stats, 0, 0x1FF); // 511

      // 0x1FF is 9 bits of 1s.
      // stats[34] should have lowest 9 bits set.
      expect(stats[PlayerStat.STAT_AMMO_INFO_START] & 0x1FF).toBe(0x1FF);
    });
  });

  describe('G_SetPowerupStat & G_GetPowerupStat', () => {
    it('should pack and unpack values (2 bits)', () => {
      const stats = new Array(64).fill(0);
      // Using integer ID for simplicity of test, assumes logic handles number
      const powerupId = 0;

      G_SetPowerupStat(stats, powerupId, 3);
      expect(G_GetPowerupStat(stats, powerupId)).toBe(3);

      G_SetPowerupStat(stats, powerupId, 0);
      expect(G_GetPowerupStat(stats, powerupId)).toBe(0);
    });

    it('should clamp values to 2 bits (0-3)', () => {
      const stats = new Array(64).fill(0);
      G_SetPowerupStat(stats, 0, 5); // Should be clamped to 3
      expect(G_GetPowerupStat(stats, 0)).toBe(3);
    });

    it('should handle multiple powerups without overlap', () => {
      const stats = new Array(64).fill(0);

      // ID 0: 0 bits offset from STAT_POWERUP_INFO_START
      // ID 1: 2 bits offset
      // ID 2: 4 bits offset

      G_SetPowerupStat(stats, 0, 3);
      G_SetPowerupStat(stats, 1, 0);
      G_SetPowerupStat(stats, 2, 2);

      expect(G_GetPowerupStat(stats, 0)).toBe(3);
      expect(G_GetPowerupStat(stats, 1)).toBe(0);
      expect(G_GetPowerupStat(stats, 2)).toBe(2);

      // Modify middle one
      G_SetPowerupStat(stats, 1, 1);
      expect(G_GetPowerupStat(stats, 0)).toBe(3);
      expect(G_GetPowerupStat(stats, 1)).toBe(1);
      expect(G_GetPowerupStat(stats, 2)).toBe(2);
    });
  });
});
