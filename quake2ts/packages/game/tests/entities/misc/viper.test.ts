import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerMiscViper, registerMiscViperBomb } from '../../../src/entities/misc/flyers.js';
import { Entity, MoveType, Solid, ServerFlags } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('misc_viper', () => {
  let context: ReturnType<typeof createTestContext>;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerMiscViper(registry);
    registerMiscViperBomb(registry);
    context.entities.setSpawnRegistry(registry);
    vi.clearAllMocks();
  });

  it('registers misc_viper and misc_viper_bomb', () => {
    expect(registry.get('misc_viper')).toBeDefined();
    expect(registry.get('misc_viper_bomb')).toBeDefined();
  });

  it('misc_viper initializes correctly', () => {
    const spawnFunc = registry.get('misc_viper');
    const entity = context.entities.spawn();
    entity.classname = 'misc_viper';
    entity.target = 'path1';

    spawnFunc?.(entity, {
      keyValues: {},
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.moveinfo?.speed).toBe(300);
    expect(entity.think).toBeDefined();
    expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
  });

  it('misc_viper_bomb initializes correctly', () => {
    const spawnFunc = registry.get('misc_viper_bomb');
    const entity = context.entities.spawn();
    entity.classname = 'misc_viper_bomb';

    spawnFunc?.(entity, {
      keyValues: {},
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    expect(entity.movetype).toBe(MoveType.None); // Until used
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.use).toBeDefined();
    expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
  });

  it('misc_viper_bomb usage launches bomb', () => {
    const viperSpawn = registry.get('misc_viper');
    const bombSpawn = registry.get('misc_viper_bomb');

    // Create viper
    const viper = context.entities.spawn();
    viper.classname = 'misc_viper';
    viper.target = 'path1';
    viperSpawn?.(viper, { keyValues: {}, entities: context.entities, warn: vi.fn(), free: vi.fn() });

    // Setup viper moveinfo for velocity check
    viper.moveinfo = { dir: { x: 1, y: 0, z: 0 }, speed: 300 };
    // Hack to make find work in test
    // We need to implement context.forEachEntity properly in test helper or mock find logic
    // The test helper mock iterates over targetNameIndex, but we are looking by classname here.
    // Let's manually inject into a mock list if possible or spy on forEachEntity?
    // In test-helpers.ts, forEachEntity uses targetNameIndex. We can hack it by adding to targetNameIndex with a fake name or updating mock.
    // Or we can assume misc_viper_bomb_use logic works if we mock forEachEntity to yield our viper.

    context.entities.find = vi.fn((predicate) => predicate(viper) ? viper : undefined);

    // Create bomb
    const bomb = context.entities.spawn();
    bomb.classname = 'misc_viper_bomb';
    bombSpawn?.(bomb, { keyValues: {}, entities: context.entities, warn: vi.fn(), free: vi.fn() });

    // Use bomb
    bomb.use?.(bomb, null, null);

    expect(bomb.movetype).toBe(MoveType.Toss);
    expect(bomb.solid).toBe(Solid.BoundingBox);
    expect((bomb.svflags & ServerFlags.NoClient)).toBeFalsy();
    expect(bomb.velocity).toEqual({ x: 300, y: 0, z: 0 });
    expect(bomb.touch).toBeDefined();
  });
});
