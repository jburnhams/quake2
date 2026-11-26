import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerIcarusSpawns } from '../../../../src/entities/monsters/icarus.js';
import { MoveType, Solid, EntityFlags } from '../../../../src/entities/entity.js';
import { SpawnRegistry } from '../../../../src/entities/spawn.js';
import { createTestContext, createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('monster_icarus', () => {
  let context: any;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerIcarusSpawns(registry);
  });

  it('spawns with correct properties', () => {
    const ent = createMonsterEntityFactory('monster_icarus');
    const spawnFunc = registry.get('monster_icarus');
    spawnFunc!(ent, context);

    expect(ent.model).toBe('models/monsters/icarus/tris.md2');
    expect(ent.health).toBe(240);
    expect(ent.mass).toBe(200);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
    expect(ent.flags & EntityFlags.Fly).toBeTruthy();
  });

  it('has AI states', () => {
    const ent = createMonsterEntityFactory('monster_icarus');
    registry.get('monster_icarus')!(ent, context);
    expect(ent.monsterinfo.stand).toBeDefined();
    expect(ent.monsterinfo.walk).toBeDefined();
    expect(ent.monsterinfo.run).toBeDefined();
    expect(ent.monsterinfo.attack).toBeDefined();
  });

  it('attacks when in range', () => {
    const ent = createMonsterEntityFactory('monster_icarus');
    registry.get('monster_icarus')!(ent, context);

    const enemy = createPlayerEntityFactory();
    enemy.health = 100;
    enemy.origin = { x: 100, y: 0, z: 0 };
    ent.enemy = enemy;

    if (ent.monsterinfo.attack) {
        ent.monsterinfo.attack(ent);
    }

    // Should be in an attack move
    expect(ent.monsterinfo.current_move?.firstframe).toBeGreaterThan(0);
  });
});
