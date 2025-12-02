import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpawns } from '../../src/entities/targets.js';
import { Entity, ServerFlags } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { createDefaultSpawnRegistry, SpawnFunction } from '../../src/entities/spawn.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('target_healthbar', () => {
  let context: EntitySystem;
  let entity: Entity;
  let spawnFunc: SpawnFunction;
  let configStringMock: ReturnType<typeof vi.fn>;
  let pickTargetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    configStringMock = vi.fn();
    pickTargetMock = vi.fn();

    context = {
      spawn: vi.fn().mockReturnValue({}),
      linkentity: vi.fn(),
      configString: configStringMock,
      pickTarget: pickTargetMock,
      warn: vi.fn(),
      free: vi.fn(),
      entities: {
        spawn: vi.fn().mockReturnValue({}),
        timeSeconds: 100,
        configString: configStringMock,
        pickTarget: pickTargetMock,
        level: {
            health_bar_entities: new Array(4).fill(null), // Mock health bar slots
        },
        warn: vi.fn(),
        free: vi.fn(),
      },
      keyValues: {},
    } as unknown as EntitySystem;

    entity = {
      classname: 'target_healthbar',
      target: 'boss',
      message: 'Big Boss',
      use: undefined,
    } as unknown as Entity;

    const registry = createDefaultSpawnRegistry();
    registerTargetSpawns(registry);
    spawnFunc = registry.get('target_healthbar')!;
  });

  it('attaches to target and sets health bar config string', () => {
    spawnFunc(entity, context as any);

    const targetEnt = {
        spawn_count: 100,
        svflags: ServerFlags.Monster,
    } as unknown as Entity;

    // Entity needs health to match target spawn_count?
    // C code: ent->health != target->spawn_count check for validity.
    // Let's set entity.health = 100
    entity.health = 100;

    pickTargetMock.mockReturnValue(targetEnt);

    // Call use
    entity.use?.(entity, null, null);

    // Should set health bar entity
    const level = (context.entities as any).level;
    expect(level.health_bar_entities[0]).toBe(entity);
    expect(entity.enemy).toBe(targetEnt);

    // Check config string update
    // CONSTANT for health bar name?
    // Rerelease: CONFIG_HEALTH_BAR_NAME
    // We need to define or use existing constant.
    // Assuming ConfigStringIndex.HealthBarName or similar if exists, else raw index?
    // Rerelease uses `gi.configstring(CONFIG_HEALTH_BAR_NAME, ent->message);`
    // Let's check `ConfigStringIndex` again.

    // In `ConfigStringIndex` in `configstrings.ts`, I see:
    // ...
    // StatusBar = 5,
    // CONFIG_N64_PHYSICS = 56,
    // ...
    // But I don't see `CONFIG_HEALTH_BAR_NAME`.
    // It might be a new constant.
    // In `g_local.h` or similar?
    // Rerelease adds:
    // #define CONFIG_HEALTH_BAR_NAME		55

    // So we should use 55.

    expect(configStringMock).toHaveBeenCalledWith(55, 'Big Boss');
  });

  it('frees itself if target missing', () => {
    spawnFunc(entity, context as any);
    pickTargetMock.mockReturnValue(null);
    entity.health = 100;

    entity.use?.(entity, null, null);

    // Should call free
    // Note: in tests we used context.entities.free or context.free depending on implementation
    // The implementation should use context.entities.free usually
    expect(context.entities.free).toHaveBeenCalledWith(entity);
  });
});
