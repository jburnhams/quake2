import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpawns } from '../../src/entities/targets.js';
import { Entity, MoveType, Solid, EntityFlags, ServerFlags } from '../../src/entities/entity.js';
import { EntitySystem, LevelState } from '../../src/entities/system.js';
import { createTestContext } from '../test-helpers.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('target_camera', () => {
  let context: ReturnType<typeof createTestContext>;
  let system: EntitySystem;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    system = context.entities; // createTestContext returns { entities: system, ... }
    registry = new SpawnRegistry();
    registerTargetSpawns(registry);
    system.setSpawnRegistry(registry);
  });

  it('should register target_camera spawn', () => {
    expect(registry.get('target_camera')).toBeDefined();
  });

  it('should initialize target_camera properties', () => {
    const ent = system.spawn();
    ent.classname = 'target_camera';

    const spawnFunc = registry.get('target_camera');
    spawnFunc?.(ent, {
        entities: system,
        keyValues: {},
        warn: vi.fn(),
        free: system.free.bind(system)
    });

    expect(ent.use).toBeDefined();
    expect(ent.svflags).toBe(ServerFlags.NoClient);
  });

  it('should spawn a dummy player and start camera movement on use', () => {
    const camera = system.spawn();
    camera.classname = 'target_camera';
    camera.target = 'path1';
    camera.speed = 100;
    camera.wait = 10; // 10 seconds wait at end

    const spawnFunc = registry.get('target_camera');
    spawnFunc?.(camera, { entities: system, keyValues: {}, warn: vi.fn(), free: vi.fn() });

    const path1 = system.spawn();
    path1.targetname = 'path1';
    path1.origin = { x: 100, y: 0, z: 0 };
    path1.classname = 'path_corner';

    // Mock pickTarget to return path1
    (system.pickTarget as unknown as ReturnType<typeof vi.fn>).mockReturnValue(path1);

    const activator = system.spawn();
    activator.classname = 'player';
    activator.client = {
        ps: { viewangles: { x: 0, y: 0, z: 0 }, pm_type: 0, pm_flags: 0, pm_time: 0 },
        pers: { connected: true, health: 100, max_health: 100 },
        resp: { entertime: 0, co_op_respawn_time: 0, score: 0 },
        inventory: { ammo: { counts: [] }, items: [], armor: { armorCount: 0, armorType: 0 } },
        v_angle: { x: 0, y: 0, z: 0 },
        cmd_angles: { x: 0, y: 0, z: 0 },
        buttons: 0,
        oldbuttons: 0,
        latched_buttons: 0
    } as any;
    activator.origin = { x: 0, y: 0, z: 0 };
    activator.angles = { x: 0, y: 0, z: 0 };

    // Act
    camera.use?.(camera, activator, activator);

    // Assert
    expect(system.level.intermissiontime).toBe(system.timeSeconds);
    expect(system.level.intermission_origin).toEqual(camera.origin);

    // Mock should record spawn call
    expect(system.spawn).toHaveBeenCalled();
    // Since spawn is mocked to return a generic entity, we can't easily check for the specific dummy unless we track returned values.
    // But we can check linkentity was called on a dummy.
    expect(system.linkentity).toHaveBeenCalled();

    // Check camera thinking
    // We can't check camera.think directly if we mocked scheduleThink to just set nextthink
    expect(camera.think).toBeDefined();
    expect(camera.nextthink).toBeGreaterThan(system.timeSeconds);
    expect(camera.movetarget).toBe(path1);
  });

  it('should handle camera movement and update intermission angle', () => {
      // Setup camera moving from 0,0,0 to 100,0,0
      const camera = system.spawn();
      camera.classname = 'target_camera';
      camera.target = 'path1';
      camera.speed = 100;
      camera.origin = { x: 0, y: 0, z: 0 };

      const spawnFunc = registry.get('target_camera');
      spawnFunc?.(camera, { entities: system, keyValues: {}, warn: vi.fn(), free: vi.fn() });

      const path1 = system.spawn();
      path1.targetname = 'path1';
      path1.origin = { x: 100, y: 0, z: 0 };

      (system.pickTarget as unknown as ReturnType<typeof vi.fn>).mockReturnValue(path1);

      const activator = system.spawn();
      activator.classname = 'player';
      activator.client = {} as any; // Minimal client

      camera.use?.(camera, activator, activator);

      // Advance time slightly
      system.timeSeconds += 0.1;
      camera.nextthink = system.timeSeconds;

      // We need to trigger update_target_camera
      if (camera.think) {
          camera.think(camera, { entities: system });
      }

      // Check intermission origin updated
      expect(system.level.intermission_origin.x).toBeGreaterThan(0);
  });

  it('should stop camera when end of path reached', () => {
    const camera = system.spawn();
    camera.classname = 'target_camera';
    camera.target = 'path1';
    camera.speed = 1000; // Fast
    camera.origin = { x: 0, y: 0, z: 0 };
    camera.wait = 0; // Immediate finish

    const spawnFunc = registry.get('target_camera');
    spawnFunc?.(camera, { entities: system, keyValues: {}, warn: vi.fn(), free: vi.fn() });

    const path1 = system.spawn();
    path1.targetname = 'path1';
    path1.origin = { x: 10, y: 0, z: 0 };

    (system.pickTarget as unknown as ReturnType<typeof vi.fn>).mockReturnValue(path1);

    const activator = system.spawn();
    activator.classname = 'player';
    activator.client = {} as any;

    camera.use?.(camera, activator, activator);

    // Simulate enough frames to reach destination
    for(let i=0; i<10; i++) {
        system.timeSeconds += 0.1;
        if (camera.think && camera.nextthink <= system.timeSeconds) {
            camera.think(camera, { entities: system });
        }
    }

    // Should be at destination
    expect(camera.origin).toEqual(path1.origin);
  });
});
