import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpawns } from '../../../src/entities/targets.js';
import { ServerFlags } from '../../../src/entities/entity.js';
import { createDefaultSpawnRegistry, SpawnFunction } from '../../../src/entities/spawn.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { createEntityFactory, createTestContext, type TestContext } from '@quake2ts/test-utils';
import type { Entity } from '../../../src/entities/entity.js';

describe('target_healthbar', () => {
  let context: TestContext;
  let entity: Entity;
  let spawnFunc: SpawnFunction;
  let configStringMock: ReturnType<typeof vi.fn>;
  let pickTargetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    configStringMock = vi.fn();
    pickTargetMock = vi.fn();

    context = createTestContext({
      imports: {
        configstring: configStringMock,
      },
    });

    // Override pickTarget on the entities mock
    context.entities.pickTarget = pickTargetMock;

    // Set up health_bar_entities array in level state
    context.entities.level.health_bar_entities = [null, null, null, null];

    const entityData = createEntityFactory({
      classname: 'target_healthbar',
      target: 'boss',
      message: 'Big Boss',
    });

    entity = context.entities.spawn();
    Object.assign(entity, entityData);

    const registry = createDefaultSpawnRegistry();
    registerTargetSpawns(registry);
    spawnFunc = registry.get('target_healthbar')!;
  });

  it('attaches to target and sets health bar config string', () => {
    spawnFunc(entity, context);

    const targetEnt = context.entities.spawn();
    targetEnt.spawn_count = 100;
    targetEnt.svflags = ServerFlags.Monster;

    entity.health = 100;

    pickTargetMock.mockReturnValue(targetEnt);

    // Call use
    entity.use?.(entity, null, null);

    // Should set health bar entity
    const level = context.entities.level;
    expect(level.health_bar_entities[0]).toBe(entity);
    expect(entity.enemy).toBe(targetEnt);

    expect(configStringMock).toHaveBeenCalledWith(ConfigStringIndex.HealthBarName, 'Big Boss');
  });

  it('frees itself if target missing', () => {
    spawnFunc(entity, context);
    pickTargetMock.mockReturnValue(null);
    entity.health = 100;

    entity.use?.(entity, null, null);

    // context.entities.free is a mock in createTestContext
    expect(context.entities.free).toHaveBeenCalledWith(entity);
  });
});
