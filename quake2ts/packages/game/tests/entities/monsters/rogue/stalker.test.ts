import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_stalker } from '../../../../src/entities/monsters/rogue/stalker.js';
import { Entity, MoveType, Solid, EntityFlags, DeadFlag } from '../../../../src/entities/entity.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { ZERO_VEC3 } from '@quake2ts/shared';

// Mock dependencies
const mockSound = vi.fn();
const mockLinkEntity = vi.fn();
const mockFree = vi.fn();
const mockSoundIndex = vi.fn();
const mockModelIndex = vi.fn();
const mockCheckBottom = vi.fn().mockReturnValue(true);

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

describe('monster_stalker', () => {
  let entity: Entity;

  beforeEach(() => {
    entity = new Entity();
    entity.monsterinfo = {} as any;
    entity.origin = { ...ZERO_VEC3 };
    entity.angles = { ...ZERO_VEC3 };
    vi.clearAllMocks();
  });

  it('should spawn with correct properties', () => {
    SP_monster_stalker(entity, mockContext);

    expect(mockModelIndex).toHaveBeenCalledWith("models/monsters/stalker/tris.md2");

    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
    expect(entity.health).toBe(250);
    expect(entity.mass).toBe(250);
    expect(entity.classname).toBe('monster_stalker');
  });

  it('should set ceiling orientation if flag set', () => {
      entity.spawnflags = 8; // SPAWNFLAG_STALKER_ONROOF
      SP_monster_stalker(entity, mockContext);

      expect(entity.angles.z).toBe(180);
  });
});
