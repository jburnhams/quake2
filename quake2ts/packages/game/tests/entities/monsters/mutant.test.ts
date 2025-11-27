import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_mutant } from '../../../src/entities/monsters/mutant.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { GameEngine } from '../../../src/engine.js';
import { GameImports } from '../../../src/game.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import * as damageModule from '../../../src/combat/damage.js';
import * as gibsModule from '../../../src/entities/gibs.js';

const mockEngine = {
  sound: vi.fn(),
} as unknown as GameEngine;

const mockImports = {
  trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
  pointcontents: vi.fn().mockReturnValue(0),
  linkentity: vi.fn(),
} as unknown as GameImports;

const mockContext = {
  entities: {
    engine: mockEngine,
    free: vi.fn(),
    trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
    multicast: vi.fn(),
    spawn: vi.fn().mockReturnValue({} as Entity),
  } as unknown as EntitySystem,
} as unknown as SpawnContext;

describe('monster_mutant', () => {
  let mutant: Entity;

  beforeEach(() => {
    vi.clearAllMocks();
    mutant = new Entity(1);
    mutant.timestamp = 10;
    SP_monster_mutant(mutant, mockContext);
  });

  it('initializes with correct properties', () => {
    expect(mutant.classname).toBe('monster_mutant');
    expect(mutant.model).toBe('models/monsters/mutant/tris.md2');
    expect(mutant.health).toBe(300);
    expect(mutant.movetype).toBe(MoveType.Step);
    expect(mutant.solid).toBe(Solid.BoundingBox);
    expect(mutant.takedamage).toBe(true);
  });

  it('handles pain correctly', () => {
    mutant.health = 300;
    mutant.pain_finished_time = 0;
    const painCallback = mutant.pain!;

    painCallback(mutant, null, 0, 10);

    expect(mutant.pain_finished_time).toBeGreaterThan(mutant.timestamp);

    mutant.health = 100;
    painCallback(mutant, null, 0, 10);
    expect(mutant.skin).toBe(1);
  });

  it('handles death correctly', () => {
    const dieCallback = mutant.die!;
    mutant.health = 0;

    dieCallback(mutant, null, null, 10, { x: 0, y: 0, z: 0 });

    expect(mutant.deadflag).toBe(DeadFlag.Dead);
    expect(mutant.solid).toBe(Solid.Not);
  });

  it('transitions to attack state', () => {
      expect(mutant.monsterinfo.attack).toBeDefined();
      mutant.monsterinfo.attack!(mutant);
      // attack_move firstframe 70
      expect(mutant.monsterinfo.current_move?.firstframe).toBe(70);
  });

  it('checkattack logic selects jump', () => {
      const enemy = new Entity(2);
      enemy.origin = { x: 300, y: 0, z: 0 }; // Distance 300, perfect for jump
      mutant.enemy = enemy;
      mutant.origin = { x: 0, y: 0, z: 0 };
      enemy.health = 100;

      // Mock random to trigger jump ( < 0.3 )
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = mutant.monsterinfo.checkattack!(mutant, mockContext as unknown as EntitySystem);

      expect(result).toBe(true);
      // Jump move firstframe 93
      expect(mutant.monsterinfo.current_move?.firstframe).toBe(93);
  });

  it('checkattack logic selects melee when close', () => {
      const enemy = new Entity(2);
      enemy.origin = { x: 50, y: 0, z: 0 }; // Close
      mutant.enemy = enemy;
      mutant.origin = { x: 0, y: 0, z: 0 };
      enemy.health = 100;

      // Mock random to trigger attack ( < 0.5 )
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = mutant.monsterinfo.checkattack!(mutant, mockContext as unknown as EntitySystem);

      expect(result).toBe(true);
      // Attack move firstframe 70
      expect(mutant.monsterinfo.current_move?.firstframe).toBe(70);
  });
});
