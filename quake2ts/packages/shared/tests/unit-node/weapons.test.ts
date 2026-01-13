import { describe, expect, it } from 'vitest';
import { WeaponId } from '../../src/items/weapons.js';

describe('items/weapons', () => {
  it('defines correct WeaponId enum values', () => {
    expect(WeaponId.Blaster).toBe('blaster');
    expect(WeaponId.Shotgun).toBe('shotgun');
    expect(WeaponId.SuperShotgun).toBe('supershotgun');
    expect(WeaponId.Machinegun).toBe('machinegun');
    expect(WeaponId.Chaingun).toBe('chaingun');
    expect(WeaponId.HandGrenade).toBe('grenades');
    expect(WeaponId.GrenadeLauncher).toBe('grenadelauncher');
    expect(WeaponId.RocketLauncher).toBe('rocketlauncher');
    expect(WeaponId.HyperBlaster).toBe('hyperblaster');
    expect(WeaponId.Railgun).toBe('railgun');
    expect(WeaponId.BFG10K).toBe('bfg10k');
  });

  it('defines expansion WeaponId enum values', () => {
    expect(WeaponId.Grapple).toBe('grapple');
    expect(WeaponId.ChainFist).toBe('chainfist');
    expect(WeaponId.IonRipper).toBe('ionripper');
    expect(WeaponId.PlasmaBeam).toBe('plasmabeam');
    expect(WeaponId.Phalanx).toBe('phalanx');
    expect(WeaponId.Disruptor).toBe('disruptor');
    expect(WeaponId.Trap).toBe('trap');
  });
});
