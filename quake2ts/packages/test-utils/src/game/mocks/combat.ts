import { Entity, DamageMod, type WeaponState } from '@quake2ts/game';
import { type Vec3 } from '@quake2ts/shared';
import { vi, type Mock } from 'vitest';

export interface MockWeapon {
  fire: Mock<[Entity], void>;
  reload: Mock<[Entity], void>;
  damage: number;
}

export interface DamageInfo {
  attacker: Entity | null;
  target: Entity;
  damage: number;
  kick: number;
  damageFlags: number;
  mod: DamageMod;
  point: Vec3;
  dir: Vec3;
}

export function createMockWeapon(weaponType: string, overrides: Partial<MockWeapon> = {}): MockWeapon {
  return {
    fire: vi.fn(),
    reload: vi.fn(),
    damage: 10,
    ...overrides
  };
}

export function createMockDamageInfo(overrides: Partial<DamageInfo> = {}): DamageInfo {
  return {
    attacker: null,
    target: new Entity(0),
    damage: 0,
    kick: 0,
    damageFlags: 0,
    mod: DamageMod.UNKNOWN,
    point: { x: 0, y: 0, z: 0 },
    dir: { x: 0, y: 0, z: 0 },
    ...overrides
  };
}

export const mockMonsterFireBlaster = vi.fn((entity: Entity, start: Vec3, dir: Vec3, damage: number) => {});
export const mockMonsterFireRocket = vi.fn((entity: Entity, start: Vec3, dir: Vec3, damage: number) => {});
export const mockMonsterFireRailgun = vi.fn((entity: Entity, start: Vec3, dir: Vec3, damage: number) => {});
