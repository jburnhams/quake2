import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpawns } from '../../src/entities/targets.js';
import { Entity, ServerFlags, AiFlags } from '../../src/entities/entity.js';
import { createTestContext } from '../test-helpers.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { RenderFx } from '@quake2ts/shared';

describe('target_spawner', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerTargetSpawns(registry);
    entity = new Entity(1);
    entity.classname = 'target_spawner';
    entity.origin = { x: 10, y: 20, z: 30 };
    entity.angles = { x: 0, y: 0, z: 0 };
  });

  it('should initialize correctly', () => {
    const spawnFn = registry.get('target_spawner');
    expect(spawnFn).toBeDefined();
    spawnFn?.(entity, context);

    expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
    expect(entity.use).toBeDefined();
  });

  it('should spawn target entity when used', () => {
    entity.target = 'monster_soldier';
    const spawnFn = registry.get('target_spawner');
    spawnFn?.(entity, context);

    // Mock spawn function for monster_soldier
    const mockSpawn = vi.fn((ent, ctx) => {
        ent.classname = 'monster_soldier';
    });
    // Register mock in registry instead of mocking getSpawnFunction
    registry.register('monster_soldier', mockSpawn);

    // Trigger use
    const activator = new Entity(2);
    entity.use?.(entity, null, activator);

    expect(context.entities.spawn).toHaveBeenCalled();
    expect(mockSpawn).toHaveBeenCalled();
    expect(context.entities.finalizeSpawn).toHaveBeenCalled();
    expect(context.entities.linkentity).toHaveBeenCalled();
    expect(context.entities.killBox).toHaveBeenCalled();

    // Capture the spawned entity
    const spawnedEnt = (context.entities.spawn as any).mock.results[0].value;

    // Check flags
    expect(spawnedEnt.monsterinfo.aiflags & AiFlags.DoNotCount).toBeTruthy();
    expect(spawnedEnt.renderfx & RenderFx.IrVisible).toBeTruthy();
  });

  it('should apply speed/velocity to spawned entity', () => {
    entity.target = 'projectile_rocket';
    entity.speed = 500;
    // Default angles 0,0,0 -> Forward is X (1,0,0)

    const spawnFn = registry.get('target_spawner');
    spawnFn?.(entity, context);

    const mockSpawn = vi.fn();
    registry.register('projectile_rocket', mockSpawn);

    // Capture spawned entity
    const spawnedEnt = new Entity(3);
    (context.entities.spawn as any).mockReturnValue(spawnedEnt);

    entity.use?.(entity, null, null);

    // Check velocity
    // 500 * (1, 0, 0)
    expect(spawnedEnt.velocity.x).toBeCloseTo(500);
    expect(spawnedEnt.velocity.y).toBeCloseTo(0);
    expect(spawnedEnt.velocity.z).toBeCloseTo(0);
  });
});
