import { vi, type Mock } from 'vitest';
import { Entity, EntitySystem, MonsterMove, MonsterAction, AIAction } from '@quake2ts/game';

/**
 * Interface representing generic AI capabilities for testing.
 */
export interface MockAI {
  checkAttack: Mock;
  findTarget: Mock;
  visible: Mock;
  infront: Mock;
}

/**
 * Interface representing specific monster AI behavior mocks.
 */
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

/**
 * Creates a mock AI helper object.
 *
 * @param overrides - Optional overrides for AI functions.
 * @returns A MockAI object.
 */
export function createMockAI(overrides: Partial<MockAI> = {}): MockAI {
  return {
    checkAttack: vi.fn(() => false),
    findTarget: vi.fn(() => null),
    visible: vi.fn(() => true),
    infront: vi.fn(() => true),
    ...overrides
  };
}

/**
 * Creates a mock Monster AI behavior object.
 *
 * @param overrides - Optional overrides for monster AI actions.
 * @returns A MockMonsterAI object.
 */
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

/**
 * Creates a generic MonsterMove object for testing animations and state transitions.
 *
 * @param first - The first frame number.
 * @param last - The last frame number.
 * @param think - The think function to call each frame.
 * @param action - The AI action to execute each frame (e.g. ai_run).
 * @returns A configured MonsterMove object.
 */
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
