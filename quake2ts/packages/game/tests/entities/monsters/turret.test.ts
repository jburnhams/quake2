import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_turret } from '../../../src/entities/monsters/turret.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { ZERO_VEC3 } from '@quake2ts/shared';

// Mock dependencies
const mockSound = vi.fn();
const mockLinkEntity = vi.fn();
const mockFree = vi.fn();
const mockSoundIndex = vi.fn();
const mockModelIndex = vi.fn();
const mockMonsterFireBlaster = vi.fn();

// We need to intercept the imports in turret.ts.
// Since we are using ESM and standard Vitest mocking, we can mock the module.
vi.mock('../../../src/entities/monsters/attack.js', () => ({
  monster_fire_blaster: (...args: any[]) => mockMonsterFireBlaster(...args),
}));

const mockContext: any = {
  entities: {
    engine: {
      sound: mockSound,
    },
    sound: mockSound,
    linkentity: mockLinkEntity,
    free: mockFree,
    soundIndex: mockSoundIndex,
    modelIndex: mockModelIndex,
    timeSeconds: 10,
    checkGround: vi.fn(),
    trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
  },
};

describe('monster_turret', () => {
  let entity: Entity;

  beforeEach(() => {
    entity = new Entity();
    entity.monsterinfo = {} as any;
    entity.origin = { ...ZERO_VEC3 };
    entity.angles = { ...ZERO_VEC3 };
    entity.spawnflags = 0;
    vi.clearAllMocks();
  });

  it('should spawn with correct properties', () => {
    SP_monster_turret(entity, mockContext);

    expect(entity.model).toBe("models/monsters/turret/tris.md2");
    expect(entity.health).toBe(100);
    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
    expect(entity.takedamage).toBe(true);

    expect(entity.monsterinfo.stand).toBeDefined();
    expect(entity.monsterinfo.attack).toBeDefined();
  });

  it('should execute attack logic and fire blaster', () => {
      SP_monster_turret(entity, mockContext);
      const enemy = new Entity();
      enemy.origin = { x: 100, y: 0, z: 0 };
      enemy.health = 100; // Must be alive
      entity.enemy = enemy;

      // Trigger attack
      if (entity.monsterinfo.attack) {
          entity.monsterinfo.attack(entity);
          // current_move should be attack_move
      }

      // Check frames behavior
      // attack_move frames are generated. We know index 4 triggers firing.
      // We can inspect frames directly if we could access the move object, or just invoke 'think' from the frame if exported or accessible.

      // Since 'attack_move' is not exported, we can iterate frames on entity.
      // After SP_monster_turret, current_move is stand_move (via turret_stand call).

      // Let's force set attack move via hook or simulating logic.
      // But attack() sets current_move to attack_move.

      const move = entity.monsterinfo.current_move;
      // We expect this to be attack_move now.
      expect(move).toBeDefined();
      if (!move) return;

      // Find the frame that fires (index 4 in array, so 5th frame)
      const fireFrame = move.frames[4]; // relative index in array
      expect(fireFrame).toBeDefined();

      if (fireFrame.think) {
          fireFrame.think(entity, mockContext.entities);

          expect(mockSound).toHaveBeenCalledWith(entity, 0, 'turret/fire.wav', 1, 1, 0);
          expect(mockMonsterFireBlaster).toHaveBeenCalled();
      } else {
          // If think is undefined, logic changed or test assumption wrong
          throw new Error("Expected firing frame to have think function");
      }
  });

  it('should handle pain', () => {
      SP_monster_turret(entity, mockContext);
      if (entity.pain) {
          entity.pain(entity, null, 0, 10);
          expect(mockSound).toHaveBeenCalledWith(entity, 0, 'turret/pain.wav', 1, 1, 0);
      }
  });

  it('should die properly', () => {
      SP_monster_turret(entity, mockContext);
      if (entity.die) {
          entity.die(entity, null, null, 100, ZERO_VEC3, 0);
          expect(mockSound).toHaveBeenCalledWith(entity, 0, 'turret/death.wav', 1, 1, 0);
          // Should transition to dying state
          expect(entity.deadflag).toBe(DeadFlag.Dying);
      }
  });
});
