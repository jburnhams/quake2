import { vi, type Mock } from 'vitest';
import { DamageMod, Entity, EntitySystem, WeaponState } from '@quake2ts/game';

export interface MockDamageInfo {
  damage: number;
  mod: DamageMod;
  knockback: number;
  attacker: Entity | null;
  inflictor: Entity | null;
  dir: { x: number, y: number, z: number } | null;
  point: { x: number, y: number, z: number } | null;
}

export function createMockDamageInfo(overrides: Partial<MockDamageInfo> = {}): MockDamageInfo {
  return {
    damage: 10,
    mod: DamageMod.UNKNOWN,
    knockback: 0,
    attacker: null,
    inflictor: null,
    dir: null,
    point: null,
    ...overrides
  };
}

const WEAPON_NAMES: Record<string, string> = {
  'weapon_blaster': 'Blaster',
  'weapon_shotgun': 'Shotgun',
  'weapon_supershotgun': 'Super Shotgun',
  'weapon_machinegun': 'Machinegun',
  'weapon_chaingun': 'Chaingun',
  'weapon_grenadelauncher': 'Grenade Launcher',
  'weapon_rocketlauncher': 'Rocket Launcher',
  'weapon_hyperblaster': 'HyperBlaster',
  'weapon_railgun': 'Railgun',
  'weapon_bfg': 'BFG10K',
};

export function createMockWeapon(name: string = 'Mock Weapon') {
  const displayName = WEAPON_NAMES[name] || name;
  return {
    name: displayName,
    ammoType: 'bullets',
    ammoUse: 1,
    selection: vi.fn(),
    think: vi.fn(),
    command: vi.fn(),
  };
}

export const mockMonsterAttacks = {
  fireBlaster: vi.fn(),
  fireRocket: vi.fn(),
  fireGrenade: vi.fn(),
  fireHeat: vi.fn(),
  fireBullet: vi.fn(),
  fireShotgun: vi.fn(),
  fireRailgun: vi.fn(),
  fireBFG: vi.fn(),
};
