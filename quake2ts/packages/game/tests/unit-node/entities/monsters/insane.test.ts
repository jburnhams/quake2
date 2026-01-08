import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_misc_insane } from '../../../src/entities/monsters/insane.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { GameEngine } from '../../../src/index.js';

describe('monster_insane', () => {
  let system: EntitySystem;
  let context: SpawnContext;
  let entity: Entity;
  let mockEngine: GameEngine;

  beforeEach(() => {
    mockEngine = {
      sound: vi.fn(),
      modelIndex: vi.fn().mockReturnValue(1),
    } as any;

    system = new EntitySystem(mockEngine);
    entity = system.spawn();
    context = {
      keyValues: {},
      entities: system,
      warn: vi.fn(),
      free: vi.fn(),
    };
  });

  it('should initialize with correct stats', () => {
    SP_misc_insane(entity, context);

    expect(entity.classname).toBe(''); // spawn function doesn't set classname usually, caller does
    expect(entity.model).toBe('models/monsters/insane/tris.md2');
    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
    expect(entity.health).toBe(100);
    expect(entity.max_health).toBe(100);
    expect(entity.mass).toBe(300);
    expect(entity.takedamage).toBe(true);
    expect(entity.pain).toBeDefined();
    expect(entity.die).toBeDefined();
    expect(entity.monsterinfo.stand).toBeDefined();
    expect(entity.monsterinfo.walk).toBeDefined();
    expect(entity.monsterinfo.run).toBeDefined();
  });

  it('should handle pain', () => {
    SP_misc_insane(entity, context);
    const pain = entity.pain!;

    // Simulate time passing for debounce
    system.beginFrame(10);

    // Mock sound to verify call
    const soundSpy = vi.spyOn(system, 'sound');

    pain(entity, null, 0, 10);

    expect(soundSpy).toHaveBeenCalled();
    // Expect pain animation to be set
    expect(entity.monsterinfo.current_move).toBeDefined();
  });

  it('should handle death', () => {
    SP_misc_insane(entity, context);
    const die = entity.die!;

    // Mock sound
    const soundSpy = vi.spyOn(system, 'sound');

    die(entity, null, null, 10, {x:0,y:0,z:0} as any, 0 as any);

    expect(entity.deadflag).toBe(DeadFlag.Dead);
    expect(entity.takedamage).toBe(true);
    expect(soundSpy).toHaveBeenCalled();
    expect(entity.monsterinfo.current_move).toBeDefined(); // Death frames
  });

  it('should handle gib death', () => {
    SP_misc_insane(entity, context);
    entity.health = -60;
    const die = entity.die!;

    // Mock throwGibs indirectly via sound or just check result
    // Mocking imports is hard here without full mock setup,
    // but we can check if it tries to free itself
    const freeSpy = vi.spyOn(system, 'free');

    die(entity, null, null, 10, {x:0,y:0,z:0} as any, 0 as any);

    expect(freeSpy).toHaveBeenCalledWith(entity);
  });
});
