import { describe, it, expect } from 'vitest';
import { getAmmoCount, getIconPath } from '../../src/inventory-helpers.js';
import { PlayerState } from '../../src/protocol/player-state.js';
import { AmmoItemId, WeaponId, AmmoType } from '../../src/items/index.js';
import { ConfigStringIndex } from '../../src/protocol/configstrings.js';
import { PlayerStat, G_SetAmmoStat } from '../../src/protocol/stats.js';

// Mock PlayerState factory
const createPlayerState = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  pm_type: 0,
  pm_time: 0,
  pm_flags: 0,
  origin: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  viewAngles: { x: 0, y: 0, z: 0 },
  onGround: false,
  waterLevel: 0,
  mins: { x: 0, y: 0, z: 0 },
  maxs: { x: 0, y: 0, z: 0 },
  damageAlpha: 0,
  damageIndicators: [],
  blend: [0, 0, 0, 0],
  stats: [], // To be populated
  kick_angles: { x: 0, y: 0, z: 0 },
  kick_origin: { x: 0, y: 0, z: 0 },
  gunoffset: { x: 0, y: 0, z: 0 },
  gunangles: { x: 0, y: 0, z: 0 },
  gunindex: 0,
  gun_frame: 0,
  rdflags: 0,
  fov: 90,
  renderfx: 0,
  ...overrides,
});

describe('inventory-helpers', () => {
  describe('getAmmoCount', () => {
    it('should return correct ammo count for AmmoItemId', () => {
      const ps = createPlayerState();
      // Use helper to pack stats correctly
      G_SetAmmoStat(ps.stats, AmmoType.Shells, 50);

      expect(getAmmoCount(ps, AmmoItemId.Shells)).toBe(50);
    });

    it('should return correct ammo count for WeaponId', () => {
      const ps = createPlayerState();
      // Shotgun uses Shells (AmmoType 1)
      G_SetAmmoStat(ps.stats, AmmoType.Shells, 25);

      expect(getAmmoCount(ps, WeaponId.Shotgun)).toBe(25);
    });

    it('should return -1 for weapons with no ammo (Blaster)', () => {
      const ps = createPlayerState();
      expect(getAmmoCount(ps, WeaponId.Blaster)).toBe(-1);
    });

    it('should return 0 for unknown items', () => {
      const ps = createPlayerState();
      expect(getAmmoCount(ps, 'unknown_item' as any)).toBe(0);
    });

    it('should return 0 if stat is missing', () => {
      const ps = createPlayerState();
      // Stats array empty
      expect(getAmmoCount(ps, AmmoItemId.Rockets)).toBe(0); // Assuming G_GetAmmoStat handles undefined/empty stats
    });
  });

  describe('getIconPath', () => {
    it('should return correct icon path for valid stat index', () => {
      const ps = createPlayerState();
      const configStrings: string[] = [];

      // Setup ConfigStrings
      // Use ConfigStringIndex.Images instead of magic number 32
      const imageIndex = 5;
      const csIndex = ConfigStringIndex.Images + imageIndex;
      configStrings[csIndex] = 'pics/icon.pcx';

      // Set the stat to point to this image index
      ps.stats[PlayerStat.STAT_SELECTED_ICON] = imageIndex;

      expect(getIconPath(PlayerStat.STAT_SELECTED_ICON, ps, configStrings)).toBe('pics/icon.pcx');
    });

    it('should return undefined if icon index is 0', () => {
      const ps = createPlayerState();
      ps.stats[PlayerStat.STAT_SELECTED_ICON] = 0;
      const configStrings: string[] = [];

      expect(getIconPath(PlayerStat.STAT_SELECTED_ICON, ps, configStrings)).toBeUndefined();
    });

    it('should return undefined if config string is missing', () => {
      const ps = createPlayerState();
      ps.stats[PlayerStat.STAT_SELECTED_ICON] = 10;
      const configStrings: string[] = []; // Empty

      expect(getIconPath(PlayerStat.STAT_SELECTED_ICON, ps, configStrings)).toBeUndefined();
    });
  });
});
