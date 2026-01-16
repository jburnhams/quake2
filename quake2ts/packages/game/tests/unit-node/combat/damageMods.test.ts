import { describe, expect, it } from 'vitest';

import { DamageMod, ORDERED_DAMAGE_MODS, damageModName } from '../../../src/combat/index.js';

describe('DamageMod enumeration', () => {
  it('retains the rerelease MOD_* ordering', () => {
    const expectedNames = [
      'MOD_UNKNOWN',
      'MOD_BLASTER',
      'MOD_SHOTGUN',
      'MOD_SSHOTGUN',
      'MOD_MACHINEGUN',
      'MOD_CHAINGUN',
      'MOD_GRENADE',
      'MOD_G_SPLASH',
      'MOD_ROCKET',
      'MOD_R_SPLASH',
      'MOD_HYPERBLASTER',
      'MOD_RAILGUN',
      'MOD_BFG_LASER',
      'MOD_BFG_BLAST',
      'MOD_BFG_EFFECT',
      'MOD_HANDGRENADE',
      'MOD_HG_SPLASH',
      'MOD_WATER',
      'MOD_SLIME',
      'MOD_LAVA',
      'MOD_CRUSH',
      'MOD_TELEFRAG',
      'MOD_TELEFRAG_SPAWN',
      'MOD_FALLING',
      'MOD_SUICIDE',
      'MOD_HELD_GRENADE',
      'MOD_EXPLOSIVE',
      'MOD_BARREL',
      'MOD_BOMB',
      'MOD_EXIT',
      'MOD_SPLASH',
      'MOD_TARGET_LASER',
      'MOD_TRIGGER_HURT',
      'MOD_HIT',
      'MOD_TARGET_BLASTER',
      'MOD_RIPPER',
      'MOD_PHALANX',
      'MOD_BRAINTENTACLE',
      'MOD_BLASTOFF',
      'MOD_GEKK',
      'MOD_TRAP',
      'MOD_CHAINFIST',
      'MOD_DISINTEGRATOR',
      'MOD_ETF_RIFLE',
      'MOD_BLASTER2',
      'MOD_HEATBEAM',
      'MOD_TESLA',
      'MOD_PROX',
      'MOD_NUKE',
      'MOD_VENGEANCE_SPHERE',
      'MOD_HUNTER_SPHERE',
      'MOD_DEFENDER_SPHERE',
      'MOD_TRACKER',
      'MOD_DBALL_CRUSH',
      'MOD_DOPPLE_EXPLODE',
      'MOD_DOPPLE_VENGEANCE',
      'MOD_DOPPLE_HUNTER',
      'MOD_GRAPPLE',
      'MOD_BLUEBLASTER',
      'MOD_FRIENDLY_FIRE',
    ];

    expect(ORDERED_DAMAGE_MODS.map(damageModName)).toEqual(expectedNames);
    // Numeric parity with the original C++ enum is important for serialization
    // and obituary lookups; verify each entry lines up with its index.
    ORDERED_DAMAGE_MODS.forEach((mod, index) => {
      expect(mod).toBe(index);
      expect(damageModName(mod)).toBe(expectedNames[index]);
    });
  });

  it('exposes stringified names for obituary formatting', () => {
    expect(damageModName(DamageMod.RAILGUN)).toBe('MOD_RAILGUN');
    expect(damageModName(DamageMod.BFG_EFFECT)).toBe('MOD_BFG_EFFECT');
  });
});
