import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as soldierModule from '../../../../src/entities/monsters/soldier.js';
import { Entity } from '../../../../src/entities/entity.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { M_ShouldReactToPain } from '../../../../src/entities/monsters/common.js';
import { createTestContext, createEntity, TestContext } from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('../../../../src/entities/monsters/attack.js', () => ({
  monster_fire_bullet: vi.fn(),
  monster_fire_blaster: vi.fn(),
  monster_fire_shotgun: vi.fn(),
  monster_fire_ionripper: vi.fn(),
  monster_fire_blueblaster: vi.fn(),
  monster_fire_dabeam: vi.fn(),
}));

describe('monster_soldier', () => {
  let context: TestContext;
  let sys: EntitySystem;
  let soldier: Entity;

  const {
      SP_monster_soldier,
  } = soldierModule;

  beforeEach(() => {
    context = createTestContext();
    sys = context.entities;
    soldier = createEntity({ index: 1 });
    vi.clearAllMocks();
  });

  it('soldier pain is suppressed on nightmare skill (3)', () => {
    // Update skill on the entity system
    // The type definition might read-only, but the runtime object is mutable in tests
    (sys as any).skill = 3;

    SP_monster_soldier(soldier, context);

    // Default pain sets current_move to pain_move if health < 50%
    soldier.health = 5; // Should trigger pain

    // We can't easily mock the local pain_move variable in the module,
    // but we can check if M_ShouldReactToPain returns false.

    expect(M_ShouldReactToPain(soldier, sys)).toBe(false);
  });

  it('soldier pain is allowed on hard skill (2)', () => {
    (sys as any).skill = 2;

    expect(M_ShouldReactToPain(soldier, sys)).toBe(true);
  });
});
