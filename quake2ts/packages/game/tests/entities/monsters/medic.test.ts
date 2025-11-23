import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerMedicSpawns } from '../../../src/entities/monsters/medic.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';

describe('monster_medic', () => {
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
        fraction: 1.0, // Visible
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

    // Mock forEachEntity for findDeadMonster
    (system as any).forEachEntity = vi.fn((callback) => {
        // No-op by default
    });

    context = {
      keyValues: {},
      entities: system,
      warn: vi.fn(),
      free: vi.fn(),
    };

    registry = new SpawnRegistry();
    registerMedicSpawns(registry);
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    ent.classname = 'monster_medic';
    const spawnFunc = registry.get('monster_medic');
    expect(spawnFunc).toBeDefined();

    spawnFunc!(ent, context);

    expect(ent.model).toBe('models/monsters/medic/tris.md2');
    expect(ent.health).toBe(300);
    expect(ent.max_health).toBe(300);
    expect(ent.mass).toBe(400);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('has basic AI behavior', () => {
    const ent = system.spawn();
    const spawnFunc = registry.get('monster_medic');
    spawnFunc!(ent, context);

    expect(ent.monsterinfo.stand).toBeDefined();
    expect(ent.monsterinfo.walk).toBeDefined();
    expect(ent.monsterinfo.run).toBeDefined();
  });

  it('finds dead monsters to heal', () => {
      const ent = system.spawn();
      registry.get('monster_medic')!(ent, context);

      const deadMonster = system.spawn();
      deadMonster.deadflag = DeadFlag.Dead;
      deadMonster.monsterinfo = {} as any; // Mark as monster
      deadMonster.origin = { x: 100, y: 0, z: 0 }; // Nearby
      // Ensure it's not no-visible
      deadMonster.flags = 0;

      // Mock system iteration
      (system as any).forEachEntity = vi.fn((callback) => {
          callback(ent);
          callback(deadMonster);
      });

      // Force visibility check to pass
      // The import trace mock handles it with fraction 1.0

      // Force RNG to pass
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      // Explicitly call the AI frame for standing, which triggers the check
      // We need to access the AI function from the frame
      const standFrame = ent.monsterinfo.current_move?.frames[0];
      expect(standFrame).toBeDefined();

      if (standFrame?.ai) {
          standFrame.ai(ent, 0, system);
      }

      // Should transition to run state (finding target)
      // And set enemy
      expect(ent.enemy).toBe(deadMonster);

      // And move should be run_move (firstframe 70)
      expect(ent.monsterinfo.current_move?.firstframe).toBe(70);

      randomSpy.mockRestore();
  });
});
