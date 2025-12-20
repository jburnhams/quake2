import { Entity, EntitySystem, type MonsterMove } from '@quake2ts/game';
import { vi, type Mock } from 'vitest';

export interface MockAI {
  think: Mock<[Entity], void>;
  stand: Mock<[Entity], void>;
  walk: Mock<[Entity], void>;
  run: Mock<[Entity], void>;
  attack: Mock<[Entity], void>;
  pain: Mock<[Entity, number], void>;
  die: Mock<[Entity, any, any, number, any], void>;
}

export interface MockMonsterAI extends MockAI {
  checkAttack: Mock<[Entity], boolean>;
  sight: Mock<[Entity, Entity], boolean>;
  blocked: Mock<[Entity, Entity], void>;
}

export function createMockAI(overrides: Partial<MockAI> = {}): MockAI {
  return {
    think: vi.fn(),
    stand: vi.fn(),
    walk: vi.fn(),
    run: vi.fn(),
    attack: vi.fn(),
    pain: vi.fn(),
    die: vi.fn(),
    ...overrides
  };
}

export function createMockMonsterAI(monsterType: string, overrides: Partial<MockMonsterAI> = {}): MockMonsterAI {
  return {
    ...createMockAI(),
    checkAttack: vi.fn((ent: Entity) => false),
    sight: vi.fn((ent: Entity, other: Entity) => true),
    blocked: vi.fn(),
    ...overrides
  };
}
