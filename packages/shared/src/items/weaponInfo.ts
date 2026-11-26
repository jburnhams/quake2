import { WeaponId } from './weapons.js';
import { AmmoType } from './ammo.js';

// Order matches Q2 original weapon wheel index order for bitmask generation
// Used by both Game (for STAT_WEAPONS_OWNED calculation) and CGame (for weapon wheel UI)
export const WEAPON_WHEEL_ORDER: WeaponId[] = [
    WeaponId.Blaster,
    WeaponId.Shotgun,
    WeaponId.SuperShotgun,
    WeaponId.Machinegun,
    WeaponId.Chaingun,
    WeaponId.GrenadeLauncher,
    WeaponId.RocketLauncher,
    WeaponId.HandGrenade,
    WeaponId.HyperBlaster,
    WeaponId.Railgun,
    WeaponId.BFG10K
];

// Mapping of weapon to its ammo type
// Used by CGame to lookup ammo counts for weapon wheel
export const WEAPON_AMMO_MAP: Record<WeaponId, AmmoType | null> = {
    [WeaponId.Blaster]: null,
    [WeaponId.Shotgun]: AmmoType.Shells,
    [WeaponId.SuperShotgun]: AmmoType.Shells,
    [WeaponId.Machinegun]: AmmoType.Bullets,
    [WeaponId.Chaingun]: AmmoType.Bullets,
    [WeaponId.HandGrenade]: AmmoType.Grenades,
    [WeaponId.GrenadeLauncher]: AmmoType.Grenades,
    [WeaponId.RocketLauncher]: AmmoType.Rockets,
    [WeaponId.HyperBlaster]: AmmoType.Cells,
    [WeaponId.Railgun]: AmmoType.Slugs,
    [WeaponId.BFG10K]: AmmoType.Cells,

    // Extensions / Rogue / Xatrix
    [WeaponId.Grapple]: null,
    [WeaponId.ChainFist]: null,
    [WeaponId.EtfRifle]: AmmoType.Flechettes,
    [WeaponId.ProxLauncher]: AmmoType.Prox,
    [WeaponId.IonRipper]: AmmoType.Cells,
    [WeaponId.PlasmaBeam]: AmmoType.Cells,
    [WeaponId.Phalanx]: AmmoType.MagSlugs,
    [WeaponId.Disruptor]: AmmoType.Disruptor,
    [WeaponId.Trap]: AmmoType.Trap,
};
