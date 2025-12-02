import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_fixbot } from '../../../src/entities/monsters/fixbot.js';
import { Entity, MoveType, Solid, EntityFlags } from '../../../src/entities/entity.js';
import { ZERO_VEC3 } from '@quake2ts/shared';

// Mock dependencies
const mockSound = vi.fn();
const mockLinkEntity = vi.fn();
const mockFree = vi.fn();

describe('monster_fixbot', () => {
  let entity: Entity;
  let mockContext: any;

  beforeEach(() => {
    entity = new Entity();
    entity.monsterinfo = {} as any;
    entity.origin = { ...ZERO_VEC3 };
    entity.angles = { ...ZERO_VEC3 };
    vi.clearAllMocks();

    mockContext = {
      entities: {
        engine: {
          sound: mockSound,
        },
        sound: mockSound,
        linkentity: mockLinkEntity,
        free: mockFree,
        spawn: vi.fn().mockImplementation(() => {
            return {
                origin: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                angles: { x: 0, y: 0, z: 0 },
                size: { x: 0, y: 0, z: 0 },
                mins: { x: 0, y: 0, z: 0 },
                maxs: { x: 0, y: 0, z: 0 },
                absmin: { x: 0, y: 0, z: 0 },
                absmax: { x: 0, y: 0, z: 0 },
            };
        }),
        timeSeconds: 10,
        checkGround: vi.fn(),
        trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
        modelIndex: vi.fn().mockReturnValue(0),
        scheduleThink: vi.fn(),
        finalizeSpawn: vi.fn(),
      },
    };
  });

  it('should spawn with correct properties', () => {
    SP_monster_fixbot(entity, mockContext);

    expect(entity.classname).toBe('monster_fixbot');
    expect(entity.model).toBe('models/monsters/fixbot/tris.md2');
    expect(entity.health).toBe(150);
    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
    expect(entity.monsterinfo.stand).toBeDefined();
    expect(entity.monsterinfo.walk).toBeDefined();
    expect(entity.monsterinfo.run).toBeDefined();
    expect(entity.monsterinfo.attack).toBeDefined();

    // Check flight flag
    expect(entity.flags & EntityFlags.Fly).toBeTruthy();
  });

  it('should react to pain', () => {
      SP_monster_fixbot(entity, mockContext);
      expect(entity.pain).toBeDefined();
      if (entity.pain) {
          entity.pain(entity, null, 0, 10);
          expect(mockSound).toHaveBeenCalledWith(entity, 0, 'flyer/flypain1.wav', 1, 1, 0);
      }
  });

  it('should die and explode', () => {
      SP_monster_fixbot(entity, mockContext);
      expect(entity.die).toBeDefined();

      // Mock throwGibs behavior if possible or verify side effects
      // We can check sound and free call
      if (entity.die) {
          entity.die(entity, null, null, 100, ZERO_VEC3, 0 as any);
          expect(mockSound).toHaveBeenCalledWith(entity, 0, 'flyer/flydeth1.wav', 1, 1, 0);
          expect(mockFree).toHaveBeenCalledWith(entity);
      }
  });

});
