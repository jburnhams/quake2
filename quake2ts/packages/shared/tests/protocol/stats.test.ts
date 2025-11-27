import { describe, it, expect } from 'vitest';
import { G_SetAmmoStat, G_GetAmmoStat } from '../../src/protocol/stats.js';

describe('Stats Helpers', () => {
  describe('G_SetAmmoStat', () => {
    it('should pass through values within 9-bit range', () => {
      expect(G_SetAmmoStat(0)).toBe(0);
      expect(G_SetAmmoStat(100)).toBe(100);
      expect(G_SetAmmoStat(511)).toBe(511);
    });

    it('should clamp values larger than 511', () => {
      expect(G_SetAmmoStat(512)).toBe(511);
      expect(G_SetAmmoStat(1000)).toBe(511);
    });

    it('should clamp negative values to 0', () => {
      expect(G_SetAmmoStat(-1)).toBe(0);
      expect(G_SetAmmoStat(-100)).toBe(0);
    });
  });

  describe('G_GetAmmoStat', () => {
    it('should retrieve values within 9-bit range', () => {
      expect(G_GetAmmoStat(0)).toBe(0);
      expect(G_GetAmmoStat(100)).toBe(100);
      expect(G_GetAmmoStat(511)).toBe(511);
    });

    it('should mask out higher bits', () => {
      // 512 is 1000000000 (10th bit set), should become 0
      expect(G_GetAmmoStat(512)).toBe(0);
      // 513 is 1000000001, should become 1
      expect(G_GetAmmoStat(513)).toBe(1);
    });
  });
});
