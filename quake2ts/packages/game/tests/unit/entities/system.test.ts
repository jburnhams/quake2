import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from '@quake2ts/test-utils';
import { EntitySystem } from '@quake2ts/game';
import type { GameImports } from '@quake2ts/game';

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

describe('Entity System Unit Tests', () => {
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
    entitySystem.beginFrame(0.05);

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

    expect(ent.freePending).toBe(true);

    entitySystem.runFrame();

    expect(ent.inUse).toBe(false);
  });
});
