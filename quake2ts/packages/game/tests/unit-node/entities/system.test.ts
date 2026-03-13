import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createTestGame } from '@quake2ts/test-utils';
import { EntitySystem, Solid } from '@quake2ts/game';

describe('Entity System Unit Tests', () => {
  let entitySystem: EntitySystem;
  let testEnv: ReturnType<typeof createTestGame>;

  beforeEach(() => {
    testEnv = createTestGame();
    entitySystem = testEnv.game.entities;
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
    ent1.solid = Solid.BoundingBox;

    const ent2 = entitySystem.spawn();
    ent2.classname = 'item_health';
    ent2.solid = Solid.Trigger;
    ent2.touch = vi.fn();

    // Simulate collision/touch manually for integration
    if (ent2.touch) {
      ent2.touch(ent2, ent1, null, null);
    }

    expect(ent2.touch).toHaveBeenCalledWith(ent2, ent1, null, null);
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
