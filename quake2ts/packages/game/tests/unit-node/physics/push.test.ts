import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPush } from '../../../src/physics/movement.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameImports, GameTraceResult } from '../../../src/imports.js';
import { Vec3 } from '@quake2ts/shared';
import { createTestGame, spawnEntity, createEntityFactory } from '@quake2ts/test-utils';

describe('Physics: runPush', () => {
  let system: EntitySystem;
  let imports: GameImports;
  let pusher: Entity;
  let entities: Entity[] = [];

  // Simple AABB collision check
  const checkCollision = (ent: Entity, worldBrushes: { min: Vec3, max: Vec3 }[]): boolean => {
    // Re-compute absmin/max for the entity based on current origin
    const absmin = {
      x: ent.origin.x + ent.mins.x,
      y: ent.origin.y + ent.mins.y,
      z: ent.origin.z + ent.mins.z,
    };
    const absmax = {
      x: ent.origin.x + ent.maxs.x,
      y: ent.origin.y + ent.maxs.y,
      z: ent.origin.z + ent.maxs.z,
    };

    for (const brush of worldBrushes) {
      if (
        absmin.x < brush.max.x &&
        absmax.x > brush.min.x &&
        absmin.y < brush.max.y &&
        absmax.y > brush.min.y &&
        absmin.z < brush.max.z &&
        absmax.z > brush.min.z
      ) {
        return true; // Collision
      }
    }
    return false;
  };

  let worldBrushes: { min: Vec3, max: Vec3 }[] = [];

  beforeEach(() => {
    entities = [];
    worldBrushes = [];

    const gameResult = createTestGame();
    system = gameResult.game.entities;
    imports = gameResult.imports;

    // Override forEachEntity to use our local array of entities
    vi.spyOn(system, 'forEachEntity').mockImplementation((callback: (e: Entity) => void) => {
      entities.forEach(callback);
    });

    // Mock GameImports
    imports.trace.mockImplementation((start, mins, maxs, end, passent, contentmask) => {
        // Simplified trace: just check if end pos is in a world brush
        // We assume 'ent' (passent) has its mins/maxs.
        // If start == end, it's a position test.

        // Mock entity for position test
        const testEnt = {
           origin: end,
           mins: mins || {x:0, y:0, z:0},
           maxs: maxs || {x:0, y:0, z:0}
        } as Entity;

        const collided = checkCollision(testEnt, worldBrushes);

        return {
          allsolid: collided,
          startsolid: collided,
          fraction: collided ? 0 : 1, // Simple all-or-nothing for this test
          endpos: end,
          plane: null,
          ent: null,
        } as GameTraceResult;
    });

    imports.linkentity.mockImplementation((ent: Entity) => {
        // Update absmin/absmax based on origin + mins/maxs
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

    pusher = spawnEntity(system, createEntityFactory({
      classname: 'func_door',
      movetype: MoveType.Push,
      solid: Solid.Bsp,
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -10, y: -10, z: -10 },
      maxs: { x: 10, y: 10, z: 10 },
      velocity: { x: 100, y: 0, z: 0 }, // Moving +X at 100 units/s
      avelocity: { x: 0, y: 0, z: 0 },
    }));
    imports.linkentity(pusher);

    entities.push(pusher);
  });

  it('should move pusher freely when unobstructed', () => {
    const result = runPush(pusher, system, imports, 0.1);

    expect(result).toBe(true);
    expect(pusher.origin.x).toBeCloseTo(10); // 100 * 0.1
    expect(imports.linkentity).toHaveBeenCalledWith(pusher);
  });

  it('should revert move if pusher hits a world wall (self-collision)', () => {
    // Add a wall at X=5 that the pusher (width 20, center 0 -> max 10) will hit if it moves 10 units
    // Actually, pusher maxs.x is 10. Origin starts at 0. AbsMax is 10.
    // If it moves 10 units, Origin becomes 10. AbsMax becomes 20.
    // Let's put a wall at X=15.
    worldBrushes.push({ min: { x: 15, y: -100, z: -100 }, max: { x: 100, y: 100, z: 100 } });

    const result = runPush(pusher, system, imports, 0.1);

    // Origin 10 -> AbsMax 20. Overlaps wall (15 to 100).
    // Should fail.
    expect(result).toBe(false);
    expect(pusher.origin.x).toBe(0); // Reverted
  });

  it('should carry rider entities (groundentity == pusher)', () => {
    const rider = spawnEntity(system, createEntityFactory({
      classname: 'player',
      origin: { x: 0, y: 0, z: 11 }, // On top of pusher
      mins: { x: -10, y: -10, z: 0 },
      maxs: { x: 10, y: 10, z: 10 },
      solid: Solid.Bsp, // Or Bbox
      groundentity: pusher,
    }));

    // Pre-calc abs for rider
    imports.linkentity(rider);
    entities.push(rider);

    const result = runPush(pusher, system, imports, 0.1);

    expect(result).toBe(true);
    expect(pusher.origin.x).toBeCloseTo(10);
    expect(rider.origin.x).toBeCloseTo(10); // Should have moved with pusher
  });

  it('should push entities in the path', () => {
    const victim = spawnEntity(system, createEntityFactory({
      origin: { x: 15, y: 0, z: 0 }, // 5 units away from pusher's max X (10)
      mins: { x: -10, y: -10, z: -10 },
      maxs: { x: 10, y: 10, z: 10 },
      solid: Solid.BoundingBox,
    }));
    // AbsMin X = 5.

    imports.linkentity(victim);
    entities.push(victim);

    // Pusher moves 10 units. New AbsMax X = 20.
    // Victim AbsMin X = 5. Overlap!
    // Victim should be pushed.

    const result = runPush(pusher, system, imports, 0.1);

    expect(result).toBe(true);
    expect(pusher.origin.x).toBeCloseTo(10);
    expect(victim.origin.x).toBeCloseTo(15 + 10); // Pushed by the move delta (10)
  });

  it('should revert if pushed entity hits a wall (blocking)', () => {
    const victim = spawnEntity(system, createEntityFactory({
      origin: { x: 15, y: 0, z: 0 },
      mins: { x: -10, y: -10, z: -10 },
      maxs: { x: 10, y: 10, z: 10 },
      solid: Solid.BoundingBox,
      health: 100, // Has health, so it's a valid blocker
    }));
    imports.linkentity(victim);
    entities.push(victim);

    // Wall that stops the victim but not the pusher initially
    // Pusher moves to X=10. Victim moves to X=25.
    // Victim width is 20 (-10 to 10).
    // At X=25, Victim AbsBox is X=[15, 35].
    // Place wall at X=30.
    worldBrushes.push({ min: { x: 30, y: -100, z: -100 }, max: { x: 100, y: 100, z: 100 } });

    pusher.blocked = vi.fn();

    const result = runPush(pusher, system, imports, 0.1);

    expect(result).toBe(false);
    expect(pusher.blocked).toHaveBeenCalledWith(pusher, victim);
    expect(pusher.origin.x).toBe(0); // Reverted
    expect(victim.origin.x).toBe(15); // Reverted
  });

  it('should continue if blocked callback clears the obstacle (pusher crushing)', () => {
    const victim = spawnEntity(system, createEntityFactory({
      origin: { x: 15, y: 0, z: 0 },
      mins: { x: -10, y: -10, z: -10 },
      maxs: { x: 10, y: 10, z: 10 },
      solid: Solid.BoundingBox,
      health: 100,
    }));
    imports.linkentity(victim);
    entities.push(victim);

    // Wall blocks victim
    worldBrushes.push({ min: { x: 30, y: -100, z: -100 }, max: { x: 100, y: 100, z: 100 } });

    pusher.blocked = vi.fn((self, other) => {
      if (other) {
         other.health = 0;
         other.solid = Solid.Not; // It dies and becomes non-solid
      }
    });

    const result = runPush(pusher, system, imports, 0.1);

    expect(result).toBe(true); // Should succeed now
    expect(pusher.blocked).toHaveBeenCalled();
    expect(pusher.origin.x).toBeCloseTo(10);
    // Victim should have moved too because it was pushed before the check?
    // Actually, in runPush:
    // 1. Move victim.
    // 2. Check victim collision. -> Hits wall.
    // 3. Call blocked. -> Victim dies.
    // 4. Check if victim still blocks. -> ent.solid is now Not.
    // 5. Does NOT revert.
    expect(victim.origin.x).toBeCloseTo(25);
  });

  it('should handle multiple entities being pushed', () => {
    const rider = spawnEntity(system, createEntityFactory({
      origin: { x: 0, y: 0, z: 11 },
      mins: { x: -5, y: -5, z: 0 },
      maxs: { x: 5, y: 5, z: 10 },
      groundentity: pusher,
      solid: Solid.Bsp,
    }));
    imports.linkentity(rider);
    entities.push(rider);

    const pushable = spawnEntity(system, createEntityFactory({
      origin: { x: 15, y: 0, z: 0 },
      mins: { x: -5, y: -5, z: -5 },
      maxs: { x: 5, y: 5, z: 5 },
      solid: Solid.BoundingBox,
    }));
    imports.linkentity(pushable);
    entities.push(pushable);

    const result = runPush(pusher, system, imports, 0.1);

    expect(result).toBe(true);
    expect(pusher.origin.x).toBeCloseTo(10);
    expect(rider.origin.x).toBeCloseTo(10);
    expect(pushable.origin.x).toBeCloseTo(25);
  });
});
