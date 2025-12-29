import { vi, type Mock } from 'vitest';
import { DamageMod, Entity, ArmorType, type RegularArmorState, type PowerArmorState } from '@quake2ts/game';

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

export interface MockWeapon {
  name: string;
  ammoType: string;
  ammoUse: number;
  selection: Mock;
  think: Mock;
  command: Mock;
}

export function createMockWeapon(name: string = 'Mock Weapon'): MockWeapon {
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

export const mockMonsterAttacks: {
  fireBlaster: Mock;
  fireRocket: Mock;
  fireGrenade: Mock;
  fireHeat: Mock;
  fireBullet: Mock;
  fireShotgun: Mock;
  fireRailgun: Mock;
  fireBFG: Mock;
  fireIonripper: Mock;
  fireBlueblaster: Mock;
  fireDabeam: Mock;
} = {
  fireBlaster: vi.fn(),
  fireRocket: vi.fn(),
  fireGrenade: vi.fn(),
  fireHeat: vi.fn(),
  fireBullet: vi.fn(),
  fireShotgun: vi.fn(),
  fireRailgun: vi.fn(),
  fireBFG: vi.fn(),
  fireIonripper: vi.fn(),
  fireBlueblaster: vi.fn(),
  fireDabeam: vi.fn(),
};

const FORWARD_ANGLES = { x: 0, y: 0, z: 0 } as const;
const ORIGIN = { x: 0, y: 0, z: 0 } as const;

export function createRegularArmorState(armorType: ArmorType | null, armorCount: number): RegularArmorState {
  return { armorType, armorCount };
}

export function createPowerArmorState(partial: Partial<PowerArmorState> = {}): PowerArmorState {
  return {
    type: null,
    cellCount: 0,
    angles: FORWARD_ANGLES,
    origin: ORIGIN,
    health: 100,
    ...partial,
  };
}
