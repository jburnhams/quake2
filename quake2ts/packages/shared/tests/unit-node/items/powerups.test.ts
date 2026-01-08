import { describe, expect, it } from 'vitest';
import { PowerupId } from '../../../src/items/powerups.js';

describe('items/powerups', () => {
  it('defines correct PowerupId enum values', () => {
    expect(PowerupId.QuadDamage).toBe('quad');
    expect(PowerupId.Invulnerability).toBe('invulnerability');
    expect(PowerupId.EnviroSuit).toBe('enviro_suit');
    expect(PowerupId.Rebreather).toBe('rebreather');
    expect(PowerupId.Silencer).toBe('silencer');
  });

  it('defines expansion PowerupId enum values', () => {
    expect(PowerupId.PowerScreen).toBe('power_screen');
    expect(PowerupId.PowerShield).toBe('power_shield');
    expect(PowerupId.DoubleDamage).toBe('double_damage');
    expect(PowerupId.Doppelganger).toBe('doppelganger');
    expect(PowerupId.Flashlight).toBe('flashlight');
  });
});
