import { vi, type Mock } from 'vitest';
import { Entity, EntitySystem, MonsterMove, MonsterAction, AIAction } from '@quake2ts/game';

export interface MockAI {
  checkAttack: Mock;
  findTarget: Mock;
  visible: Mock;
  infront: Mock;
}

export interface MockMonsterAI {
  stand: Mock;
  walk: Mock;
  run: Mock;
  dodge: Mock;
  attack: Mock;
  melee: Mock;
  sight: Mock;
  idle: Mock;
}

export function createMockAI(overrides: Partial<MockAI> = {}): MockAI {
  return {
    checkAttack: vi.fn(() => false),
    findTarget: vi.fn(() => null),
    visible: vi.fn(() => true),
    infront: vi.fn(() => true),
    ...overrides
  };
}

export function createMockMonsterAI(overrides: Partial<MockMonsterAI> = {}): MockMonsterAI {
  return {
    stand: vi.fn(),
    walk: vi.fn(),
    run: vi.fn(),
    dodge: vi.fn(),
    attack: vi.fn(),
    melee: vi.fn(),
    sight: vi.fn(),
    idle: vi.fn(),
    ...overrides
  };
}

export function createMockMonsterMove(
  first: number,
  last: number,
  think: (self: Entity, context: EntitySystem) => void,
  action: (self: Entity, dist: number, context: EntitySystem) => void
): MonsterMove {
  const frames = [];
  for (let i = first; i <= last; i++) {
    frames.push({
      ai: action,
      dist: 0,
      think: think
    });
  }

  return {
    firstframe: first,
    lastframe: last,
    frames,
    endfunc: null
  };
}
