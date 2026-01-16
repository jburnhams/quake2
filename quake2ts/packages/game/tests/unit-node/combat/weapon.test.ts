// =================================================================
// Quake II - Weapon Definition Tests
// =================================================================

import { describe, expect, it } from 'vitest';
import { WEAPONS, WeaponType } from '../../../src/combat/weapon';

describe('Weapon Definitions', () => {
  it('should have correct properties for Blaster', () => {
    const blaster = WEAPONS[WeaponType.BLASTER];
    expect(blaster.name).toBe('Blaster');
    expect(blaster.ammo).toBeNull();
    expect(blaster.damage).toBe(15);
    expect(blaster.fireRate).toBe(0.5);
    expect(blaster.spread).toBe(0);
    expect(blaster.projectileSpeed).toBe(1000);
  });

  it('should have correct properties for Shotgun', () => {
    const shotgun = WEAPONS[WeaponType.SHOTGUN];
    expect(shotgun.name).toBe('Shotgun');
    expect(shotgun.ammo).toBe('shells');
    expect(shotgun.damage).toBe(4);
    expect(shotgun.fireRate).toBe(1);
    expect(shotgun.spread).toBe(0.1);
    expect(shotgun.projectileSpeed).toBeNull();
  });

  it('should have correct properties for Super Shotgun', () => {
    const superShotgun = WEAPONS[WeaponType.SUPER_SHOTGUN];
    expect(superShotgun.name).toBe('Super Shotgun');
    expect(superShotgun.ammo).toBe('shells');
    expect(superShotgun.damage).toBe(6);
    expect(superShotgun.fireRate).toBe(1.2);
    expect(superShotgun.spread).toBe(0.2);
    expect(superShotgun.projectileSpeed).toBeNull();
  });

  it('should have correct properties for Machinegun', () => {
    const machinegun = WEAPONS[WeaponType.MACHINEGUN];
    expect(machinegun.name).toBe('Machinegun');
    expect(machinegun.ammo).toBe('bullets');
    expect(machinegun.damage).toBe(8);
    expect(machinegun.fireRate).toBe(0.1);
    expect(machinegun.spread).toBe(0.05);
    expect(machinegun.projectileSpeed).toBeNull();
  });

  it('should have correct properties for Chaingun', () => {
    const chaingun = WEAPONS[WeaponType.CHAINGUN];
    expect(chaingun.name).toBe('Chaingun');
    expect(chaingun.ammo).toBe('bullets');
    expect(chaingun.damage).toBe(8);
    expect(chaingun.fireRate).toBe(0.05);
    expect(chaingun.spread).toBe(0.1);
    expect(chaingun.projectileSpeed).toBeNull();
  });

  it('should have correct properties for Grenade Launcher', () => {
    const grenadeLauncher = WEAPONS[WeaponType.GRENADE_LAUNCHER];
    expect(grenadeLauncher.name).toBe('Grenade Launcher');
    expect(grenadeLauncher.ammo).toBe('grenades');
    expect(grenadeLauncher.damage).toBe(120);
    expect(grenadeLauncher.fireRate).toBe(1);
    expect(grenadeLauncher.spread).toBe(0);
    expect(grenadeLauncher.projectileSpeed).toBe(600);
  });

  it('should have correct properties for Rocket Launcher', () => {
    const rocketLauncher = WEAPONS[WeaponType.ROCKET_LAUNCHER];
    expect(rocketLauncher.name).toBe('Rocket Launcher');
    expect(rocketLauncher.ammo).toBe('rockets');
    expect(rocketLauncher.damage).toBe(100);
    expect(rocketLauncher.fireRate).toBe(1.2);
    expect(rocketLauncher.spread).toBe(0);
    expect(rocketLauncher.projectileSpeed).toBe(650);
  });

  it('should have correct properties for HyperBlaster', () => {
    const hyperBlaster = WEAPONS[WeaponType.HYPERBLASTER];
    expect(hyperBlaster.name).toBe('HyperBlaster');
    expect(hyperBlaster.ammo).toBe('cells');
    expect(hyperBlaster.damage).toBe(20);
    expect(hyperBlaster.fireRate).toBe(0.1);
    expect(hyperBlaster.spread).toBe(0);
    expect(hyperBlaster.projectileSpeed).toBe(1000);
  });

  it('should have correct properties for Railgun', () => {
    const railgun = WEAPONS[WeaponType.RAILGUN];
    expect(railgun.name).toBe('Railgun');
    expect(railgun.ammo).toBe('slugs');
    expect(railgun.damage).toBe(150);
    expect(railgun.fireRate).toBe(1.5);
    expect(railgun.spread).toBe(0);
    expect(railgun.projectileSpeed).toBeNull();
  });

  it('should have correct properties for BFG10K', () => {
    const bfg10k = WEAPONS[WeaponType.BFG10K];
    expect(bfg10k.name).toBe('BFG10K');
    expect(bfg10k.ammo).toBe('cells');
    expect(bfg10k.damage).toBe(200);
    expect(bfg10k.fireRate).toBe(2);
    expect(bfg10k.spread).toBe(0);
    expect(bfg10k.projectileSpeed).toBe(400);
  });
});
