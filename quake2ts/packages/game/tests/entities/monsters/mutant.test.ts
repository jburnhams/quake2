import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerMutantSpawns } from '../../../src/entities/monsters/mutant.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';

describe('monster_mutant', () => {
  let system: EntitySystem;
  let context: SpawnContext;
  let registry: SpawnRegistry;

  beforeEach(() => {
    // Mock game engine and imports
    const engine = {
      sound: vi.fn(),
      modelIndex: vi.fn().mockReturnValue(1),
    };
    const imports = {
      trace: vi.fn().mockReturnValue({
        allsolid: false,
        startsolid: false,
        fraction: 1,
        endpos: { x: 0, y: 0, z: 0 },
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
        ent: null,
      }),
      pointcontents: vi.fn().mockReturnValue(0),
      linkentity: vi.fn(),
      multicast: vi.fn(),
      unicast: vi.fn(),
    };

    const gameExports = createGame(imports, engine as any, { gravity: { x: 0, y: 0, z: -800 } });
    system = (gameExports as any).entities;

    context = {
      keyValues: {},
      entities: system,
      warn: vi.fn(),
      free: vi.fn(),
    };

    registry = new SpawnRegistry();
    registerMutantSpawns(registry);
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    ent.classname = 'monster_mutant';
    const spawnFunc = registry.get('monster_mutant');
    expect(spawnFunc).toBeDefined();

    spawnFunc!(ent, context);

    expect(ent.model).toBe('models/monsters/mutant/tris.md2');
    expect(ent.health).toBe(300);
    expect(ent.max_health).toBe(300);
    expect(ent.mass).toBe(300);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('has basic AI behavior', () => {
    const ent = system.spawn();
    const spawnFunc = registry.get('monster_mutant');
    spawnFunc!(ent, context);

    expect(ent.monsterinfo.stand).toBeDefined();
    expect(ent.monsterinfo.walk).toBeDefined();
    expect(ent.monsterinfo.run).toBeDefined();
    expect(ent.monsterinfo.checkattack).toBeDefined();
  });

  it('triggers jump attack when appropriate', () => {
      const ent = system.spawn();
      registry.get('monster_mutant')!(ent, context);

      const enemy = system.spawn();
      enemy.origin = { x: 200, y: 0, z: 0 }; // Mid range
      ent.enemy = enemy;

      // Force RNG to trigger jump
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = ent.monsterinfo.checkattack!(ent);

      expect(result).toBe(true);
      // Should transition to jump move (firstframe 90 in our approx)
      expect(ent.monsterinfo.current_move?.firstframe).toBe(90);

      randomSpy.mockRestore();
  });
});
