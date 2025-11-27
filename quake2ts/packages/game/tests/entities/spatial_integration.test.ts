import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { GameImports, GameTraceResult } from '../../src/imports.js';
import { Vec3 } from '@quake2ts/shared';

// Mock GameEngine
const mockEngine = {
  trace: vi.fn(),
  sound: vi.fn(),
};

// Mock GameImports
const mockImports: GameImports = {
  trace: vi.fn(() => ({
    allsolid: false,
    startsolid: false,
    fraction: 1,
    endpos: { x: 0, y: 0, z: 0 },
    plane: null,
    surfaceFlags: 0,
    contents: 0,
    ent: null,
  })),
  pointcontents: vi.fn(() => 0),
  linkentity: vi.fn(),
  multicast: vi.fn(),
  unicast: vi.fn(),
};

describe('EntitySystem Spatial Integration', () => {
  let system: EntitySystem;

  beforeEach(() => {
    vi.clearAllMocks();
    system = new EntitySystem(mockEngine, mockImports, { x: 0, y: 0, z: -800 });
    system.beginFrame(1.0);
  });

  it('links solid entities to the collision index', () => {
    const ent = system.spawn();
    ent.solid = Solid.BoundingBox;
    ent.mins = { x: -10, y: -10, z: -10 };
    ent.maxs = { x: 10, y: 10, z: 10 };
    ent.origin = { x: 100, y: 0, z: 0 };

    // linkentity is called during spawn/finalizeSpawn or manually
    system.finalizeSpawn(ent);

    // Verify it's in the index by querying it
    const candidates = system.collisionIndex.gatherTriggerTouches(ent.origin, ent.mins, ent.maxs, -1);
    expect(candidates).toContain(ent.index);
  });

  it('does not link non-solid entities to the collision index', () => {
    const ent = system.spawn();
    ent.solid = Solid.Not; // Default
    ent.origin = { x: 200, y: 0, z: 0 };

    system.finalizeSpawn(ent);

    const candidates = system.collisionIndex.gatherTriggerTouches(ent.origin, { x: -1, y: -1, z: -1 }, { x: 1, y: 1, z: 1 }, -1);
    expect(candidates).not.toContain(ent.index);
  });

  it('detects touching entities via spatial index in runTouches', () => {
    const ent1 = system.spawn();
    ent1.solid = Solid.BoundingBox; // Needs to be solid to be in index and activeEntities
    ent1.mins = { x: -16, y: -16, z: 0 };
    ent1.maxs = { x: 16, y: 16, z: 32 };
    ent1.origin = { x: 0, y: 0, z: 0 };
    ent1.touch = vi.fn();

    const ent2 = system.spawn();
    ent2.solid = Solid.BoundingBox;
    ent2.mins = { x: -16, y: -16, z: 0 };
    ent2.maxs = { x: 16, y: 16, z: 32 };
    ent2.origin = { x: 10, y: 10, z: 0 }; // Overlapping
    ent2.touch = vi.fn();

    system.finalizeSpawn(ent1);
    system.finalizeSpawn(ent2);

    // Manually trigger runFrame to execute runTouches
    // We mock thinkScheduler to do nothing
    system.runFrame();

    expect(ent1.touch).toHaveBeenCalledWith(ent1, ent2);
    expect(ent2.touch).toHaveBeenCalledWith(ent2, ent1);
  });

  it('does not trigger touch for non-overlapping entities', () => {
    const ent1 = system.spawn();
    ent1.solid = Solid.BoundingBox;
    ent1.mins = { x: -10, y: -10, z: -10 };
    ent1.maxs = { x: 10, y: 10, z: 10 };
    ent1.origin = { x: 0, y: 0, z: 0 };
    ent1.touch = vi.fn();

    const ent2 = system.spawn();
    ent2.solid = Solid.BoundingBox;
    ent2.mins = { x: -10, y: -10, z: -10 };
    ent2.maxs = { x: 10, y: 10, z: 10 };
    ent2.origin = { x: 100, y: 0, z: 0 }; // Far away
    ent2.touch = vi.fn();

    system.finalizeSpawn(ent1);
    system.finalizeSpawn(ent2);

    system.runFrame();

    expect(ent1.touch).not.toHaveBeenCalled();
    expect(ent2.touch).not.toHaveBeenCalled();
  });

  it('killBox kills overlapping entities using spatial index', () => {
    const killer = system.spawn();
    killer.solid = Solid.Not; // Killbox itself often isn't solid, just a trigger or similar
    killer.origin = { x: 0, y: 0, z: 0 };
    killer.mins = { x: -50, y: -50, z: -50 };
    killer.maxs = { x: 50, y: 50, z: 50 };

    const victim = system.spawn();
    victim.solid = Solid.BoundingBox; // Must be solid/linked to be found by spatial query
    victim.health = 100;
    victim.takedamage = true;
    victim.origin = { x: 10, y: 10, z: 10 };
    victim.mins = { x: -16, y: -16, z: -24 };
    victim.maxs = { x: 16, y: 16, z: 32 };

    system.finalizeSpawn(victim);
    // Killer doesn't need to be linked for killBox to work, it just defines the box

    system.killBox(killer);

    expect(victim.health).toBe(0);
    // expect(victim.freePending).toBe(true); // Depending on killBox impl, it might free
  });

  it('removes entity from spatial index when freed', () => {
    const ent = system.spawn();
    ent.solid = Solid.BoundingBox;
    ent.origin = { x: 0, y: 0, z: 0 };
    ent.mins = { x: -10, y: -10, z: -10 };
    ent.maxs = { x: 10, y: 10, z: 10 };

    system.finalizeSpawn(ent);

    // Verify linked
    let candidates = system.collisionIndex.gatherTriggerTouches(ent.origin, ent.mins, ent.maxs, -1);
    expect(candidates).toContain(ent.index);

    system.freeImmediate(ent);

    // Verify unlinked
    candidates = system.collisionIndex.gatherTriggerTouches(ent.origin, ent.mins, ent.maxs, -1);
    expect(candidates).not.toContain(ent.index);
  });
});
