import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerIcarusSpawns } from '../../../src/entities/monsters/icarus.js';
import { Entity, MoveType, Solid, EntityFlags } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('monster_icarus', () => {
  let system: EntitySystem;
  let context: SpawnContext;
  let registry: SpawnRegistry;

  beforeEach(() => {
    const { imports, engine } = createGameImportsAndEngine();

    const gameExports = createGame(imports, engine as any, { gravity: { x: 0, y: 0, z: -800 } });
    system = (gameExports as any).entities;
    context = {
      keyValues: {},
      entities: system,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    };
    registry = new SpawnRegistry();
    registerIcarusSpawns(registry);
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    ent.classname = 'monster_icarus';
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
    const ent = system.spawn();
    registry.get('monster_icarus')!(ent, context);
    expect(ent.monsterinfo.stand).toBeDefined();
    expect(ent.monsterinfo.walk).toBeDefined();
    expect(ent.monsterinfo.run).toBeDefined();
    expect(ent.monsterinfo.attack).toBeDefined();
  });

  it('attacks when in range', () => {
    const ent = system.spawn();
    registry.get('monster_icarus')!(ent, context);

    const enemy = system.spawn();
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
