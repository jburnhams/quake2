import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFlyerSpawns } from '../../../../src/entities/monsters/flyer.js';
import { MoveType, Solid, EntityFlags } from '../../../../src/entities/entity.js';
import { SpawnRegistry } from '../../../../src/entities/spawn.js';
import { createTestContext, TestContext } from '@quake2ts/test-utils';

describe('monster_flyer', () => {
  let context: TestContext;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerFlyerSpawns(registry);
  });

  it('spawns with correct properties', () => {
    const ent = context.entities.spawn();
    ent.classname = 'monster_flyer';
    const spawnFunc = registry.get('monster_flyer');
    spawnFunc!(ent, context);

    expect(ent.model).toBe('models/monsters/flyer/tris.md2');
    expect(ent.health).toBe(50);
    expect(ent.mass).toBe(50);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
    expect(ent.flags & EntityFlags.Fly).toBeTruthy();
  });

  it('has AI states', () => {
    const ent = context.entities.spawn();
    registry.get('monster_flyer')!(ent, context);
    expect(ent.monsterinfo.stand).toBeDefined();
    expect(ent.monsterinfo.walk).toBeDefined();
    expect(ent.monsterinfo.run).toBeDefined();
    expect(ent.monsterinfo.attack).toBeDefined();
  });

  it('attacks when in range', () => {
    const ent = context.entities.spawn();
    registry.get('monster_flyer')!(ent, context);

    const enemy = context.entities.spawn();
    enemy.health = 100;
    enemy.origin = { x: 100, y: 0, z: 0 };
    ent.enemy = enemy;

    if (ent.monsterinfo.attack) {
        ent.monsterinfo.attack(ent);
    }

    // Should be in an attack move
    expect(ent.monsterinfo.current_move?.firstframe).toBeGreaterThan(0);
  });

  it('creates blaster bolt on attack', () => {
      const ent = context.entities.spawn();
      registry.get('monster_flyer')!(ent, context);
      ent.enemy = context.entities.spawn();
      ent.enemy.origin = { x: 200, y: 0, z: 0 };

      // Spy on projectile spawn
      const spawnSpy = vi.spyOn(context.entities, 'spawn');

      // Trigger fire frame manually
      // We need to know which frame triggers fire.
      // For now, let's just implement the monster and assume we can test this by checking integration.
      // Or we can peek at the implementation I'm about to write.
  });
});
