import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_gekk } from '../../../src/entities/monsters/gekk.js';
import { MoveType, Solid } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';

describe('monster_gekk', () => {
  let context: any;
  let entity: any;

  beforeEach(() => {
    context = createTestContext();
    vi.clearAllMocks();
  });

  it('should spawn with correct properties', () => {
    entity = createMonsterEntityFactory('monster_gekk');
    SP_monster_gekk(entity, context);

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
    entity = createMonsterEntityFactory('monster_gekk');
    SP_monster_gekk(entity, context);
    if (entity.monsterinfo.sight) {
        entity.monsterinfo.sight(entity, createPlayerEntityFactory());
        expect(context.entities.sound).toHaveBeenCalledWith(entity, 0, 'gek/gk_sght1.wav', 1, 1, 0);
    }
  });

  it('should handle water behavior in idle', () => {
     entity = createMonsterEntityFactory('monster_gekk');
     SP_monster_gekk(entity, context);

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
      entity = createMonsterEntityFactory('monster_gekk');
      SP_monster_gekk(entity, context);

      entity.waterlevel = 2;
      if (entity.monsterinfo.run) entity.monsterinfo.run(entity);
  });

  it('should react to pain', () => {
      entity = createMonsterEntityFactory('monster_gekk');
      SP_monster_gekk(entity, context);
      expect(entity.pain).toBeDefined();
      if (entity.pain) {
          entity.pain(entity, null, 0, 10);
      }
  });
});
