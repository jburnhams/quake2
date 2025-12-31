import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTriggerFlashlight } from '../../../src/entities/triggers/flashlight.js';
import { Entity, MoveType, Solid, ServerFlags, EntityFlags } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('trigger_flashlight', () => {
  let context: ReturnType<typeof createTestContext>;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerTriggerFlashlight(registry);
    context.entities.setSpawnRegistry(registry);
    vi.clearAllMocks();
  });

  it('registers trigger_flashlight spawn function', () => {
    expect(registry.get('trigger_flashlight')).toBeDefined();
  });

  it('initializes with correct properties', () => {
    const spawnFunc = registry.get('trigger_flashlight');
    const entity = context.entities.spawn();
    entity.classname = 'trigger_flashlight';

    spawnFunc?.(entity, {
      keyValues: {},
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    expect(entity.solid).toBe(Solid.Trigger);
    expect(entity.movetype).toBe(MoveType.None);
    expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
    expect(entity.touch).toBeDefined();
  });

  it('toggles flashlight on for style 1', () => {
    const spawnFunc = registry.get('trigger_flashlight');
    const entity = context.entities.spawn();
    entity.classname = 'trigger_flashlight';
    entity.style = 1; // Always ON

    spawnFunc?.(entity, {
      keyValues: {},
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    const clientEnt = context.entities.spawn();
    clientEnt.client = {} as any;

    entity.touch?.(entity, clientEnt);

    expect(clientEnt.flags & EntityFlags.Flashlight).toBeTruthy();
    expect(context.entities.sound).toHaveBeenCalledWith(clientEnt, 0, 'items/flashlight_on.wav', 1, 3, 0);
  });

  it('toggles flashlight off for style 2', () => {
    const spawnFunc = registry.get('trigger_flashlight');
    const entity = context.entities.spawn();
    entity.classname = 'trigger_flashlight';
    entity.style = 2; // Always OFF

    spawnFunc?.(entity, {
      keyValues: {},
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    const clientEnt = context.entities.spawn();
    clientEnt.client = {} as any;
    clientEnt.flags |= EntityFlags.Flashlight; // Start with ON

    entity.touch?.(entity, clientEnt);

    expect(clientEnt.flags & EntityFlags.Flashlight).toBeFalsy();
    expect(context.entities.sound).toHaveBeenCalledWith(clientEnt, 0, 'items/flashlight_off.wav', 1, 3, 0);
  });

  it('toggles flashlight based on direction', () => {
    const spawnFunc = registry.get('trigger_flashlight');
    const entity = context.entities.spawn();
    entity.classname = 'trigger_flashlight';
    // No style, uses direction. movedir defaults to forward (X) for 0 angle
    entity.angles = { x: 0, y: 0, z: 0 };

    spawnFunc?.(entity, {
      keyValues: {},
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    const clientEnt = context.entities.spawn();
    clientEnt.client = {} as any;
    clientEnt.velocity = { x: 100, y: 0, z: 0 }; // Moving along X (forward) -> ON

    entity.touch?.(entity, clientEnt);
    expect(clientEnt.flags & EntityFlags.Flashlight).toBeTruthy();

    // Moving backward -> OFF
    clientEnt.velocity = { x: -100, y: 0, z: 0 };
    entity.touch?.(entity, clientEnt);
    expect(clientEnt.flags & EntityFlags.Flashlight).toBeFalsy();
  });
});
