import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTargetCamera, registerTargetCamera } from '../../../../src/entities/camera.js';
import { Entity, MoveType, Solid, ServerFlags } from '../../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../../../src/entities/spawn.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('target_camera', () => {
  let context: ReturnType<typeof createTestContext>;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerTargetCamera(registry);
    context.entities.setSpawnRegistry(registry);
    vi.clearAllMocks();
  });

  it('registers target_camera spawn function', () => {
    expect(registry.get('target_camera')).toBeDefined();
  });

  it('initializes with correct flags', () => {
    const spawnFunc = registry.get('target_camera');
    const entity = context.entities.spawn();
    entity.classname = 'target_camera';

    spawnFunc?.(entity, {
      keyValues: {},
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
    expect(entity.use).toBeDefined();
  });

  it('handles use correctly', () => {
    const spawnFunc = registry.get('target_camera');
    const entity = context.entities.spawn();
    entity.classname = 'target_camera';
    entity.target = 'path1';
    entity.speed = 100;
    entity.sounds = 5;

    spawnFunc?.(entity, {
      keyValues: {},
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    // Create target
    const target = context.entities.spawn();
    target.targetname = 'path1';
    target.origin = { x: 100, y: 0, z: 0 };
    context.entities['targetNameIndex'].set('path1', new Set([target])); // Manual index hack for test context

    // Create activator (player)
    const activator = context.entities.spawn();
    activator.client = {} as any;
    activator.origin = { x: 0, y: 0, z: 0 };

    entity.use?.(entity, null, activator);

    // Check configstring called for sound
    expect(context.entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.CdTrack, '5');

    // Check movetarget set
    expect(entity.movetarget).toBe(target);

    // Check dummy entity spawned
    expect(entity.enemy).toBeDefined();
    expect(entity.enemy?.owner).toBe(activator);
    expect(entity.enemy?.modelindex).toBe(255);

    // Check think scheduled
    expect(entity.think).toBeDefined();
    expect(entity.nextthink).toBeGreaterThan(context.entities.timeSeconds);
  });
});
