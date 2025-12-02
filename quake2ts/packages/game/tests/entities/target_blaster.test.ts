import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpawns } from '../../src/entities/targets.js';
import { Entity, ServerFlags } from '../../src/entities/entity.js';
import { createTestContext } from '../test-helpers.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { createBlasterBolt } from '../../src/entities/projectiles.js';
import { DamageMod } from '../../src/combat/damageMods.js';

// Mock projectile creation
vi.mock('../../src/entities/projectiles.js', () => ({
    createBlasterBolt: vi.fn(() => new Entity(2)),
}));

describe('target_blaster', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerTargetSpawns(registry);

    entity = new Entity(1);
    entity.classname = 'target_blaster';
    entity.angles = { x: 0, y: 0, z: 0 };
    vi.clearAllMocks();
  });

  it('should initialize with defaults', () => {
    const spawnFn = registry.get('target_blaster');
    expect(spawnFn).toBeDefined();
    spawnFn?.(entity, context);

    expect(entity.dmg).toBe(15);
    expect(entity.speed).toBe(1000);
    expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
    expect(entity.movedir.x).toBeCloseTo(1);
    expect(entity.movedir.y).toBeCloseTo(0);
    expect(entity.movedir.z).toBeCloseTo(0);
  });

  it('should fire blaster when used', () => {
    const spawnFn = registry.get('target_blaster');
    spawnFn?.(entity, context);

    entity.use?.(entity, null, null);

    expect(createBlasterBolt).toHaveBeenCalledWith(
        context.entities,
        entity,
        entity.origin,
        entity.movedir,
        15,
        1000,
        DamageMod.TARGET_BLASTER
    );
    expect(context.entities.sound).toHaveBeenCalledWith(entity, 2, 'weapons/laser2.wav', 1, 1, 0);
  });

  it('should handle NOTRAIL spawnflag', () => {
    // SPAWNFLAG_BLASTER_NOTRAIL = 1
    entity.spawnflags = 1;
    const spawnFn = registry.get('target_blaster');
    spawnFn?.(entity, context);

    entity.use?.(entity, null, null);

    // Check effect setting
    // We mocked createBlasterBolt to return an entity.
    const bolt = (createBlasterBolt as any).mock.results[0].value;
    // EF_HYPERBLASTER = 0x00001000
    expect(bolt.effects & 0x00001000).toBeTruthy();
  });
});
