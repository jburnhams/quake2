import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_supertank } from '../../../src/entities/monsters/supertank.js';
import { SP_monster_boss2 } from '../../../src/entities/monsters/boss2.js';
import { SP_monster_floater } from '../../../src/entities/monsters/floater.js';
import { Entity, MoveType, Solid, EntityFlags, DeadFlag } from '../../../src/entities/entity.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { createRandomGenerator } from '@quake2ts/shared';

describe('Boss/Monster Spawns', () => {
  let entity: Entity;
  let context: SpawnContext;

  beforeEach(() => {
    entity = new Entity(1);
    const engine = {
        sound: vi.fn(),
        modelIndex: vi.fn(() => 0),
    };
    context = {
      keyValues: {},
      entities: {
        spawn: () => new Entity(2),
        free: vi.fn(),
        finalizeSpawn: vi.fn(),
        freeImmediate: vi.fn(),
        timeSeconds: 10,
        modelIndex: vi.fn(() => 0),
        scheduleThink: vi.fn(),
        linkentity: vi.fn(),
        multicast: vi.fn(),
        engine, // Attach mocked engine
        sound: engine.sound,
        rng: createRandomGenerator(12345),
      } as any,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    };
    entity.timestamp = 10;
  });

  describe('SP_monster_supertank', () => {
    it('sets correct stats', () => {
      SP_monster_supertank(entity, context);
      expect(entity.classname).toBe('monster_supertank');
      expect(entity.health).toBe(1500);
      expect(entity.max_health).toBe(1500);
      expect(entity.mass).toBe(800);
      expect(entity.movetype).toBe(MoveType.Step);
      expect(entity.solid).toBe(Solid.BoundingBox);
      expect(entity.takedamage).toBe(true);
      expect(entity.monsterinfo.stand).toBeDefined();
      expect(entity.monsterinfo.run).toBeDefined();
      expect(entity.monsterinfo.attack).toBeDefined();
    });

    it('handles death (gibbing)', () => {
        SP_monster_supertank(entity, context);
        entity.health = -100; // Trigger gib
        entity.die?.(entity, null, null, 100, {x:0,y:0,z:0} as any, 0 as any);
        expect(context.entities.free).toHaveBeenCalledWith(entity);
    });

    it('handles death (normal)', () => {
        SP_monster_supertank(entity, context);
        entity.health = 0;
        entity.die?.(entity, null, null, 10, {x:0,y:0,z:0} as any, 0 as any);
        expect(entity.deadflag).toBe(DeadFlag.Dead);
        expect(entity.solid).toBe(Solid.Not);
        // Should transition to death frames
        expect(entity.monsterinfo.current_move).toBeDefined();
    });
  });

  describe('SP_monster_boss2 (Hornet)', () => {
    it('sets correct stats', () => {
        SP_monster_boss2(entity, context);
        expect(entity.classname).toBe('monster_boss2');
        expect(entity.health).toBe(3000);
        expect(entity.flags & EntityFlags.Fly).toBeTruthy();
    });
  });

  describe('SP_monster_floater', () => {
      it('sets correct stats', () => {
          SP_monster_floater(entity, context);
          expect(entity.classname).toBe('monster_floater');
          expect(entity.health).toBe(200);
          expect(entity.flags & EntityFlags.Fly).toBeTruthy();
      });
  });
});
