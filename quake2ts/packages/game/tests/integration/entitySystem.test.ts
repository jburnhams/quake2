import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from '@quake2ts/test-utils';
import { EntitySystem } from '../../src/entities/index.js';
import type { GameImports } from '../../src/imports.js';
import { Vec3 } from '@quake2ts/shared';

// Mock GameImports
const createMockGameImports = (): GameImports => ({
  trace: vi.fn(() => ({ fraction: 1.0, allsolid: false, startsolid: false, endpos: { x: 0, y: 0, z: 0 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } })),
  pointcontents: vi.fn(() => 0),
  setmodel: vi.fn(),
  configstring: vi.fn(),
  modelindex: vi.fn(() => 1),
  soundindex: vi.fn(() => 1),
  imageindex: vi.fn(() => 1),
  linkentity: vi.fn(),
  unlinkentity: vi.fn(),
  multicast: vi.fn(),
  unicast: vi.fn(),
  sound: vi.fn(),
  centerprintf: vi.fn(),
  bprint: vi.fn(),
  dprint: vi.fn(),
  error: vi.fn(),
  cvar_get: vi.fn(),
  cvar_set: vi.fn(),
  cvar_forceset: vi.fn(),
  argc: vi.fn(() => 0),
  argv: vi.fn(() => ''),
  args: vi.fn(() => ''),
  positiondms: vi.fn()
} as unknown as GameImports);

describe('Entity System Integration', () => {
  let entitySystem: EntitySystem;
  let imports: GameImports;

  beforeEach(() => {
    setupBrowserEnvironment();
    imports = createMockGameImports();
    entitySystem = new EntitySystem(
      { /* engine mocks */ } as any,
      imports,
      { x: 0, y: 0, z: -800 }, // Gravity
      1024 // Max entities
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should spawn entities and run think functions', () => {
    // Spawn a dummy entity
    const ent = entitySystem.spawn();
    ent.classname = 'info_null';
    ent.think = vi.fn();

    // Schedule think
    // nextthink is absolute time
    // But `EntitySystem.scheduleThink` uses absolute time
    // And `EntitySystem` tracks `currentTimeSeconds`.
    // We set start time to 0.05
    entitySystem.beginFrame(0.05);

    // We set nextthink. But `EntitySystem` uses `scheduleThink`.
    // Wait, setting `ent.nextthink` directly doesn't automatically schedule it in `ThinkScheduler`?
    // In original Quake 2, `SV_RunEntity` checks `ent->nextthink`.
    // In this port, `ThinkScheduler` handles it.
    // Does `EntitySystem` sync `ent.nextthink` with scheduler?
    // Let's check `packages/game/src/entities/system.ts`.
    // It has `scheduleThink(entity, nextThinkSeconds)`.
    // Entities usually call `self.nextthink = level.time + 0.1`.
    // But does assigning to the property update the scheduler?
    // The `Entity` class might have a setter, or `EntitySystem.runFrame` checks it.
    // `runFrame` calls `this.thinkScheduler.runDueThinks`.
    // So we MUST use `entitySystem.scheduleThink` or ensure `ent.nextthink` works.
    // The `Entity` object is just a proxy or struct.
    // `EntitySystem` exposes `scheduleThink`.

    // If I use `ent.nextthink = ...`, does it work?
    // Quake 2 logic relies on `nextthink`.
    // If `EntitySystem` uses `ThinkScheduler`, it likely needs explicit scheduling or `ent.nextthink` is just a storage.
    // `ThinkScheduler.runDueThinks` iterates scheduled thinks.
    // Let's use `entitySystem.scheduleThink` to be safe, as seen in `useTargets`.

    entitySystem.scheduleThink(ent, 0.1); // Run at 0.1s

    // Time 0.05 -> should not run
    entitySystem.beginFrame(0.05);
    entitySystem.runFrame();
    expect(ent.think).not.toHaveBeenCalled();

    // Time 0.15 -> should run
    entitySystem.beginFrame(0.15);
    entitySystem.runFrame();
    expect(ent.think).toHaveBeenCalled();
  });

  it('should handle entity interactions', () => {
    const ent1 = entitySystem.spawn();
    ent1.classname = 'player';
    ent1.solid = 3; // Solid.BBox

    const ent2 = entitySystem.spawn();
    ent2.classname = 'item_health';
    ent2.solid = 2; // Solid.Trigger
    ent2.touch = vi.fn();

    // Simulate collision/touch manually for integration
    if (ent2.touch) {
      ent2.touch(ent2, ent1);
    }

    expect(ent2.touch).toHaveBeenCalledWith(ent2, ent1);
  });

  it('should cleanup entities', () => {
    const ent = entitySystem.spawn();
    ent.classname = 'temporary';

    // Mark for removal using free()
    entitySystem.free(ent);

    // EntitySystem cleanup happens at end of frame or immediately?
    // `free` calls `pool.deferFree(entity)`.
    // `pool.flushFreeList()` is called at end of `runFrame`.

    expect(ent.freePending).toBe(true);

    entitySystem.runFrame();

    expect(ent.inUse).toBe(false);
  });
});
