import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as soldierModule from '../../../../src/entities/monsters/soldier.js';
import { Entity, MoveType, Solid } from '../../../../src/entities/entity.js';
import { SpawnContext } from '../../../../src/entities/spawn.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { GameEngine } from '../../../../src/index.js';
import { M_ShouldReactToPain } from '../../../../src/entities/monsters/common.js';

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
  let sys: EntitySystem;
  let context: SpawnContext;
  let soldier: Entity;

  const {
      SP_monster_soldier,
  } = soldierModule;

  beforeEach(() => {
    // Basic mock of EntitySystem and SpawnContext
    const soundMock = vi.fn();
    const engineMock = {
        modelIndex: vi.fn().mockReturnValue(1),
        sound: soundMock,
    } as unknown as GameEngine;

    sys = {
        spawn: () => new Entity(1),
        modelIndex: (s: string) => 1,
        timeSeconds: 10,
        multicast: vi.fn(),
        engine: engineMock,
        sound: soundMock,
        linkentity: vi.fn(),
        skill: 1 // Default Medium
    } as unknown as EntitySystem;

    context = {
        entities: sys,
        health_multiplier: 1.0,
    } as unknown as SpawnContext;

    soldier = new Entity(1);
    vi.clearAllMocks();
  });

  it('soldier pain is suppressed on nightmare skill (3)', () => {
    sys = { ...sys, skill: 3 } as any;
    context = { ...context, entities: sys } as any;

    SP_monster_soldier(soldier, context);

    // Default pain sets current_move to pain_move if health < 50%
    soldier.health = 5; // Should trigger pain

    // Mock the pain_move to something we can check
    const pain_move = { firstframe: 100, lastframe: 105, frames: [], endfunc: null } as any;
    // We can't easily mock the local pain_move variable in the module,
    // but we can check if M_ShouldReactToPain returns false.

    expect(M_ShouldReactToPain(soldier, sys)).toBe(false);
  });

  it('soldier pain is allowed on hard skill (2)', () => {
    sys = { ...sys, skill: 2 } as any;
    context = { ...context, entities: sys } as any;

    expect(M_ShouldReactToPain(soldier, sys)).toBe(true);
  });
});
