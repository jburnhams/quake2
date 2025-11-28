import { setCompressedInteger, getCompressedInteger } from './bitpack.js';
import { PowerupId } from '../items/powerups.js';

// Matching rerelease/bg_local.h:196-262
export enum PlayerStat {
    STAT_HEALTH_ICON = 0,
    STAT_HEALTH,
    STAT_AMMO_ICON,
    STAT_AMMO,
    STAT_ARMOR_ICON,
    STAT_ARMOR,
    STAT_SELECTED_ICON,
    STAT_PICKUP_ICON,
    STAT_PICKUP_STRING,
    STAT_TIMER_ICON,
    STAT_TIMER,
    STAT_HELPICON,
    STAT_SELECTED_ITEM,
    STAT_LAYOUTS,
    STAT_FRAGS,
    STAT_FLASHES,
    STAT_CHASE,
    STAT_SPECTATOR,

    // CTF Stats (Rerelease/KEX)
    STAT_CTF_TEAM1_PIC = 18,
    STAT_CTF_TEAM1_CAPS = 19,
    STAT_CTF_TEAM2_PIC = 20,
    STAT_CTF_TEAM2_CAPS = 21,
    STAT_CTF_FLAG_PIC = 22,
    STAT_CTF_JOINED_TEAM1_PIC = 23,
    STAT_CTF_JOINED_TEAM2_PIC = 24,
    STAT_CTF_TEAM1_HEADER = 25,
    STAT_CTF_TEAM2_HEADER = 26,
    STAT_CTF_TECH = 27,
    STAT_CTF_ID_VIEW = 28,
    STAT_CTF_MATCH = 29,
    STAT_CTF_ID_VIEW_COLOR = 30,
    STAT_CTF_TEAMINFO = 31,

    // Rerelease additions
    STAT_WEAPONS_OWNED_1 = 32,
    STAT_WEAPONS_OWNED_2 = 33,

    // Ammo counts (start index)
    STAT_AMMO_INFO_START = 34,
    // Calculated below, but enum needs literal or constant if we want to use it as type.
    // However, for TS Enum, we can just define start.

    // Powerups start after Ammo.
    // AMMO_MAX=12, 9 bits each -> 108 bits -> 7 int16s.
    // 34 + 7 = 41.
    STAT_POWERUP_INFO_START = 41,

    // Keys and other KEX stats (Start after Powerups)
    // POWERUP_MAX=23, 2 bits each -> 46 bits -> 3 int16s.
    // 41 + 3 = 44.
    STAT_KEY_A = 44,
    STAT_KEY_B = 45,
    STAT_KEY_C = 46,

    STAT_ACTIVE_WHEEL_WEAPON = 47,
    STAT_COOP_RESPAWN = 48,
    STAT_LIVES = 49,
    STAT_HIT_MARKER = 50,
    STAT_SELECTED_ITEM_NAME = 51,
    STAT_HEALTH_BARS = 52,
    STAT_ACTIVE_WEAPON = 53,

    STAT_LAST
}

// Constants for bit packing logic
export const AMMO_MAX = 12;
export const NUM_BITS_FOR_AMMO = 9;
export const NUM_AMMO_STATS = Math.ceil((AMMO_MAX * NUM_BITS_FOR_AMMO) / 16); // 7

export const POWERUP_MAX = 23; // Adjusted to include TechRegeneration (index 22)
export const NUM_BITS_FOR_POWERUP = 2;
export const NUM_POWERUP_STATS = Math.ceil((POWERUP_MAX * NUM_BITS_FOR_POWERUP) / 16); // 3

// Powerup ID mapping from string to C++ integer index (powerup_t in bg_local.h)
const POWERUP_STAT_MAP: Partial<Record<PowerupId, number>> = {
  [PowerupId.PowerScreen]: 0,
  [PowerupId.PowerShield]: 1,
  // 2 is POWERUP_AM_BOMB (not in PowerupId?)
  [PowerupId.QuadDamage]: 3,
  [PowerupId.QuadFire]: 4,
  [PowerupId.Invulnerability]: 5,
  [PowerupId.Invisibility]: 6,
  [PowerupId.Silencer]: 7,
  [PowerupId.Rebreather]: 8,
  [PowerupId.EnviroSuit]: 9,
  // 10 is POWERUP_ADRENALINE (not in PowerupId?)
  [PowerupId.IRGoggles]: 11,
  [PowerupId.DoubleDamage]: 12,
  [PowerupId.SphereVengeance]: 13,
  [PowerupId.SphereHunter]: 14,
  [PowerupId.SphereDefender]: 15,
  [PowerupId.Doppelganger]: 16,
  [PowerupId.Flashlight]: 17,
  [PowerupId.Compass]: 18,
  [PowerupId.TechResistance]: 19,
  [PowerupId.TechStrength]: 20,
  [PowerupId.TechHaste]: 21,
  [PowerupId.TechRegeneration]: 22,
};

// 9 bits for ammo count
export function G_SetAmmoStat(stats: number[], ammoId: number, count: number): void {
  if (ammoId < 0 || ammoId >= AMMO_MAX) return;

  // Clamp count to 9 bits (0-511)
  let val = count;
  if (val > 511) val = 511;
  if (val < 0) val = 0;

  setCompressedInteger(stats, PlayerStat.STAT_AMMO_INFO_START, ammoId, val, NUM_BITS_FOR_AMMO);
}

export function G_GetAmmoStat(stats: number[], ammoId: number): number {
  if (ammoId < 0 || ammoId >= AMMO_MAX) return 0;
  return getCompressedInteger(stats, PlayerStat.STAT_AMMO_INFO_START, ammoId, NUM_BITS_FOR_AMMO);
}

// 2 bits for powerup active/inactive state
export function G_SetPowerupStat(stats: number[], powerupId: PowerupId | number, val: number): void {
  let index: number | undefined;

  if (typeof powerupId === 'number') {
    index = powerupId;
  } else {
    index = POWERUP_STAT_MAP[powerupId];
  }

  if (index === undefined || index < 0 || index >= POWERUP_MAX) return;

  // Clamp value to 2 bits (0-3)
  let safeVal = val;
  if (safeVal > 3) safeVal = 3;
  if (safeVal < 0) safeVal = 0;

  setCompressedInteger(stats, PlayerStat.STAT_POWERUP_INFO_START, index, safeVal, NUM_BITS_FOR_POWERUP);
}

export function G_GetPowerupStat(stats: number[], powerupId: PowerupId | number): number {
  let index: number | undefined;

  if (typeof powerupId === 'number') {
    index = powerupId;
  } else {
    index = POWERUP_STAT_MAP[powerupId];
  }

  if (index === undefined || index < 0 || index >= POWERUP_MAX) return 0;

  return getCompressedInteger(stats, PlayerStat.STAT_POWERUP_INFO_START, index, NUM_BITS_FOR_POWERUP);
}
