import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_shambler } from '../../../src/entities/monsters/shambler.js';
import { createTestContext } from '@quake2ts/test-utils';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';

// Mock dependencies
vi.mock('../../../src/ai/rogue.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/ai/rogue.js')>();
  return {
    ...actual,
    PredictAim: vi.fn().mockReturnValue({ aimdir: { x: 1, y: 0, z: 0 }, aimpoint: { x: 100, y: 0, z: 0 } }),
  };
});

vi.mock('../../../src/entities/monsters/attack.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/entities/monsters/attack.js')>();
    return {
        ...actual,
        monster_fire_bullet: vi.fn(),
        monster_fire_hit: vi.fn(),
    };
});

describe('monster_shambler', () => {
  let context: any;
  let self: Entity;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createTestContext();
    context.health_multiplier = 1;
    self = new Entity(1);
    self.origin = { x: 0, y: 0, z: 0 };
    self.angles = { x: 0, y: 0, z: 0 };
  });

  it('should spawn correctly', () => {
    SP_monster_shambler(self, context);
    expect(self.classname).toBe('monster_shambler');
    expect(self.movetype).toBe(MoveType.Step);
    expect(self.solid).toBe(Solid.BoundingBox);
    expect(self.health).toBe(600);
    expect(self.model).toBe('models/monsters/shambler/tris.md2');
  });

  it('should initialize lightning model', () => {
      // Logic for checking model index precache
      const modelIndexSpy = vi.spyOn(context.entities, 'modelIndex');
      SP_monster_shambler(self, context);
      expect(modelIndexSpy).toHaveBeenCalledWith('models/proj/lightning/tris.md2');
  });

  it('should have pain and die callbacks', () => {
      SP_monster_shambler(self, context);
      expect(self.pain).toBeDefined();
      expect(self.die).toBeDefined();
  });
});
