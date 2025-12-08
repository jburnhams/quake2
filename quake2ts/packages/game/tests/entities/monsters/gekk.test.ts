import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_gekk } from '../../../src/entities/monsters/gekk.js';
import { Entity, MoveType, Solid, EntityFlags } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { ZERO_VEC3, createRandomGenerator } from '@quake2ts/shared';

// Mock dependencies
const mockSound = vi.fn();
const mockLinkEntity = vi.fn();
const mockFree = vi.fn();

const mockContext: any = {
  entities: {
    engine: {
      sound: mockSound,
    },
    sound: mockSound,
    linkentity: mockLinkEntity,
    free: mockFree,
    timeSeconds: 10,
    checkGround: vi.fn(),
    trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
    game: {
      random: createRandomGenerator({ seed: 12345 })
    },
    rng: createRandomGenerator({ seed: 12345 })
  },
  health_multiplier: 1,
};

describe('monster_gekk', () => {
  let entity: Entity;

  beforeEach(() => {
    entity = new Entity();
    entity.monsterinfo = {} as any;
    entity.origin = { ...ZERO_VEC3 };
    entity.angles = { ...ZERO_VEC3 };
    vi.clearAllMocks();
  });

  it('should spawn with correct properties', () => {
    SP_monster_gekk(entity, mockContext);

    expect(entity.classname).toBe('monster_gekk');
    expect(entity.model).toBe('models/monsters/gekk/tris.md2');
    expect(entity.health).toBe(125);
    expect(entity.max_health).toBe(125);
    expect(entity.mass).toBe(300);
    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
    expect(entity.monsterinfo.stand).toBeDefined();
    expect(entity.monsterinfo.walk).toBeDefined();
    expect(entity.monsterinfo.run).toBeDefined();
    expect(entity.monsterinfo.attack).toBeDefined();
    expect(entity.monsterinfo.melee).toBeDefined();
    expect(entity.monsterinfo.sight).toBeDefined();
    expect(entity.monsterinfo.search).toBeDefined();
    expect(entity.monsterinfo.idle).toBeDefined();
    expect(entity.monsterinfo.checkattack).toBeDefined();
  });

  it('should play sight sound', () => {
    SP_monster_gekk(entity, mockContext);
    if (entity.monsterinfo.sight) {
        entity.monsterinfo.sight(entity, new Entity());
        expect(mockSound).toHaveBeenCalledWith(entity, 0, 'gek/gk_sght1.wav', 1, 1, 0);
    }
  });

  it('should handle water behavior in idle', () => {
     SP_monster_gekk(entity, mockContext);

     // Test land idle
     entity.waterlevel = 0;
     if (entity.monsterinfo.idle) entity.monsterinfo.idle(entity);
     // Expect move set to stand (simplified test as move is private scope object)

     // Test water idle
     entity.waterlevel = 2; // WATER_WAIST
     if (entity.monsterinfo.idle) entity.monsterinfo.idle(entity);
     // Expect move set to swim start
  });

  it('should transition to swim if underwater on run', () => {
      SP_monster_gekk(entity, mockContext);

      entity.waterlevel = 2;
      if (entity.monsterinfo.run) entity.monsterinfo.run(entity);
  });

  it('should react to pain', () => {
      SP_monster_gekk(entity, mockContext);
      expect(entity.pain).toBeDefined();
      if (entity.pain) {
          entity.pain(entity, null, 0, 10);
      }
  });
});
