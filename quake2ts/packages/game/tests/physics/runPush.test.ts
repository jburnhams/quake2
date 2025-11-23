import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { runPush } from '../../src/physics/movement.js';
import { EntitySystem } from '../../src/entities/system.js';
import { GameImports, GameTraceResult } from '../../src/imports.js';
import { Vec3 } from '@quake2ts/shared';

describe('runPush', () => {
  let system: EntitySystem;
  let imports: GameImports;
  let traceMock: ReturnType<typeof vi.fn>;
  let linkEntityMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const engine = {
        sound: vi.fn(),
        modelIndex: vi.fn(),
    };

    traceMock = vi.fn();
    linkEntityMock = vi.fn((ent: Entity) => {
        ent.absmin = {
            x: ent.origin.x + ent.mins.x,
            y: ent.origin.y + ent.mins.y,
            z: ent.origin.z + ent.mins.z
        };
        ent.absmax = {
            x: ent.origin.x + ent.maxs.x,
            y: ent.origin.y + ent.maxs.y,
            z: ent.origin.z + ent.maxs.z
        };
    });

    imports = {
      trace: traceMock,
      pointcontents: vi.fn(() => 0),
      linkentity: linkEntityMock,
    };

    system = new EntitySystem(engine, imports);
  });

  it('should move a pusher entity correctly when unobstructed', () => {
    const pusher = system.spawn();
    pusher.movetype = MoveType.Push;
    pusher.solid = Solid.Bsp;
    pusher.origin = { x: 0, y: 0, z: 0 };
    pusher.velocity = { x: 100, y: 0, z: 0 };
    pusher.mins = { x: -10, y: -10, z: -10 };
    pusher.maxs = { x: 10, y: 10, z: 10 };
    imports.linkentity(pusher);

    // Mock successful trace (no collision) for testEntityPosition
    traceMock.mockReturnValue({
      fraction: 1.0,
      startsolid: false,
      allsolid: false,
      ent: null,
      endpos: { x: 0, y: 0, z: 0 } // endpos doesn't matter much for validation trace, just start/all solid
    });

    const frametime = 0.1;
    const result = runPush(pusher, system, imports, frametime);

    expect(result).toBe(true);
    expect(pusher.origin.x).toBeCloseTo(10); // 100 * 0.1
    expect(pusher.origin.y).toBe(0);
    expect(pusher.origin.z).toBe(0);
    expect(linkEntityMock).toHaveBeenCalled();
  });

  it('should revert movement if pusher is blocked by world geometry', () => {
    const pusher = system.spawn();
    pusher.movetype = MoveType.Push;
    pusher.solid = Solid.Bsp;
    pusher.origin = { x: 0, y: 0, z: 0 };
    pusher.velocity = { x: 100, y: 0, z: 0 };
    pusher.mins = { x: -10, y: -10, z: -10 };
    pusher.maxs = { x: 10, y: 10, z: 10 };
    imports.linkentity(pusher);

    // Mock blocked trace
    traceMock.mockReturnValue({
      fraction: 0,
      startsolid: true,
      allsolid: true,
      ent: null,
      endpos: { x: 0, y: 0, z: 0 }
    });

    const frametime = 0.1;
    const result = runPush(pusher, system, imports, frametime);

    expect(result).toBe(false);
    expect(pusher.origin.x).toBe(0); // Should be reverted
  });

  it('should push movable entities that intersect the pusher path', () => {
    const pusher = system.spawn();
    pusher.movetype = MoveType.Push;
    pusher.solid = Solid.Bsp;
    pusher.origin = { x: 0, y: 0, z: 0 };
    pusher.velocity = { x: 100, y: 0, z: 0 };
    pusher.mins = { x: -10, y: -10, z: -10 }; // 20x20x20 box
    pusher.maxs = { x: 10, y: 10, z: 10 };
    imports.linkentity(pusher);

    const victim = system.spawn();
    victim.solid = Solid.Bbox;
    victim.origin = { x: 15, y: 0, z: 0 }; // 5 units away from maxs x (10)
    victim.mins = { x: -5, y: -5, z: -5 };
    victim.maxs = { x: 5, y: 5, z: 5 };
    imports.linkentity(victim);

    // Push moves 10 units. Pusher maxs X becomes 20.
    // Victim mins X is 10. Overlap!

    // Traces are clear
    traceMock.mockReturnValue({
      fraction: 1.0,
      startsolid: false,
      allsolid: false,
      ent: null
    });

    const frametime = 0.1;
    runPush(pusher, system, imports, frametime);

    expect(pusher.origin.x).toBeCloseTo(10);
    expect(victim.origin.x).toBeCloseTo(10 + 15); // Should move by 10?
    // Actually, runPush adds 'move' to victim.
    // Original pos 15. Move is +10. New pos 25.
    expect(victim.origin.x).toBeCloseTo(25);
  });

  it('should move entities standing on the pusher (riders)', () => {
    const pusher = system.spawn();
    pusher.movetype = MoveType.Push;
    pusher.solid = Solid.Bsp;
    pusher.origin = { x: 0, y: 0, z: 0 };
    pusher.velocity = { x: 0, y: 0, z: 100 }; // Moving up
    pusher.mins = { x: -50, y: -50, z: 0 }; // Platform floor at z=0
    pusher.maxs = { x: 50, y: 50, z: 10 };
    imports.linkentity(pusher);

    const rider = system.spawn();
    rider.solid = Solid.Bbox;
    rider.origin = { x: 0, y: 0, z: 10 }; // Standing on top
    rider.mins = { x: -5, y: -5, z: 0 };
    rider.maxs = { x: 5, y: 5, z: 20 };
    rider.groundentity = pusher; // Rider linkage
    imports.linkentity(rider);

    // Traces are clear
    traceMock.mockReturnValue({
      fraction: 1.0,
      startsolid: false,
      allsolid: false,
      ent: null
    });

    const frametime = 0.1;
    runPush(pusher, system, imports, frametime);

    expect(pusher.origin.z).toBeCloseTo(10);
    expect(rider.origin.z).toBeCloseTo(20); // 10 + 10
  });

  it('should rotate entities standing on the pusher', () => {
    const pusher = system.spawn();
    pusher.movetype = MoveType.Push;
    pusher.solid = Solid.Bsp;
    pusher.origin = { x: 0, y: 0, z: 0 };
    pusher.velocity = { x: 0, y: 0, z: 0 };
    pusher.avelocity = { x: 0, y: 900, z: 0 }; // 900 degrees/sec yaw
    pusher.mins = { x: -50, y: -50, z: 0 };
    pusher.maxs = { x: 50, y: 50, z: 10 };
    imports.linkentity(pusher);

    const rider = system.spawn();
    rider.solid = Solid.Bbox;
    // Rider at (10, 0, 10) relative to pusher (0,0,0)
    rider.origin = { x: 10, y: 0, z: 10 };
    rider.angles = { x: 0, y: 0, z: 0 };
    rider.mins = { x: -5, y: -5, z: 0 };
    rider.maxs = { x: 5, y: 5, z: 20 };
    rider.groundentity = pusher;
    imports.linkentity(rider);

    // Traces clear
    traceMock.mockReturnValue({
      fraction: 1.0,
      startsolid: false,
      allsolid: false,
      ent: null
    });

    const frametime = 0.1; // 90 degrees rotation
    runPush(pusher, system, imports, frametime);

    // Rotate 90 deg around Z. (10, 0) -> (0, 10)
    expect(rider.origin.x).toBeCloseTo(0);
    expect(rider.origin.y).toBeCloseTo(10);
    expect(rider.origin.z).toBeCloseTo(10);
    // Rider angles should also rotate by 90
    expect(rider.angles.y).toBeCloseTo(90);
  });

  it('should call blocked callback when obstructed by an entity', () => {
    const pusher = system.spawn();
    pusher.movetype = MoveType.Push;
    pusher.solid = Solid.Bsp;
    pusher.origin = { x: 0, y: 0, z: 0 };
    pusher.velocity = { x: 100, y: 0, z: 0 };
    pusher.mins = { x: -10, y: -10, z: -10 };
    pusher.maxs = { x: 10, y: 10, z: 10 };
    pusher.blocked = vi.fn();
    imports.linkentity(pusher);

    const blocker = system.spawn();
    blocker.solid = Solid.Bbox;
    blocker.origin = { x: 15, y: 0, z: 0 };
    blocker.mins = { x: -5, y: -5, z: -5 };
    blocker.maxs = { x: 5, y: 5, z: 5 };
    blocker.health = 100;
    imports.linkentity(blocker);

    // Setup traces:
    // 1. Pusher self-test (ok)
    // 2. Blocker self-test (blocked!)
    traceMock.mockImplementation((start, mins, maxs, end, ent) => {
      if (ent === pusher) {
        return { fraction: 1, startsolid: false, allsolid: false };
      }
      if (ent === blocker) {
        // Blocker hits a wall when pushed
        return { fraction: 0, startsolid: true, allsolid: true };
      }
      return { fraction: 1 };
    });

    const frametime = 0.1;
    const result = runPush(pusher, system, imports, frametime);

    expect(pusher.blocked).toHaveBeenCalledWith(pusher, blocker);
    expect(result).toBe(false); // Should revert
    expect(pusher.origin.x).toBe(0);
    expect(blocker.origin.x).toBe(15);
  });

  it('should crush (kill) blocking entity if blocked callback does so, then continue moving', () => {
    const pusher = system.spawn();
    pusher.movetype = MoveType.Push;
    pusher.solid = Solid.Bsp;
    pusher.origin = { x: 0, y: 0, z: 0 };
    pusher.velocity = { x: 100, y: 0, z: 0 };
    pusher.mins = { x: -10, y: -10, z: -10 };
    pusher.maxs = { x: 10, y: 10, z: 10 };

    // Blocked handler kills the blocker
    pusher.blocked = vi.fn((self, other) => {
        if (other) {
            other.health = 0;
            other.solid = Solid.Not; // It stops blocking
        }
    });

    imports.linkentity(pusher);

    const blocker = system.spawn();
    blocker.solid = Solid.Bbox;
    blocker.origin = { x: 15, y: 0, z: 0 };
    blocker.mins = { x: -5, y: -5, z: -5 };
    blocker.maxs = { x: 5, y: 5, z: 5 };
    blocker.health = 10;
    imports.linkentity(blocker);

    // Setup traces:
    // 1. Pusher self-test (ok)
    // 2. Blocker self-test (blocked!)
    traceMock.mockImplementation((start, mins, maxs, end, ent) => {
      if (ent === pusher) {
        return { fraction: 1, startsolid: false, allsolid: false };
      }
      if (ent === blocker) {
         // Blocker hits a wall when pushed
         // BUT, if solid is Not, runPush might check that.
         // However, testEntityPosition is called BEFORE the blocked callback.
         return { fraction: 0, startsolid: true, allsolid: true };
      }
      return { fraction: 1 };
    });

    const frametime = 0.1;
    const result = runPush(pusher, system, imports, frametime);

    expect(pusher.blocked).toHaveBeenCalledWith(pusher, blocker);
    expect(blocker.health).toBe(0);
    expect(blocker.solid).toBe(Solid.Not);

    // The logic in runPush says:
    // if (ent.solid !== Solid.Not && (!ent.health || ent.health > 0)) { REVERT }
    // Since we set solid to Not (and health to 0), it should NOT revert.

    expect(result).toBe(true);
    expect(pusher.origin.x).toBeCloseTo(10);
    // The blocker (now dead) should also have moved, as the push happened before the check
    expect(blocker.origin.x).toBeCloseTo(25);
  });
});
