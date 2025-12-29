import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  traceBox,
  pointContents,
  CONTENTS_SOLID,
  CONTENTS_WATER,
  CONTENTS_TRIGGER,
  MASK_SHOT,
  MASK_SOLID,
  type TraceResult,
  type Vec3
} from '@quake2ts/shared';
import {
  makeLeafModel,
  makeBrushFromMinsMaxs,
} from '@quake2ts/test-utils';
import { runProjectileMovement, runPush, runGravity } from '../../../src/physics/movement.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { GameImports, GameTraceResult } from '../../../src/imports.js';
import { EntitySystem } from '../../../src/entities/system.js';

// Helper to create a functional trace mock that uses traceBox with a provided model
function createTraceDelegate(model: any) {
  return (start: Vec3, mins: Vec3, maxs: Vec3, end: Vec3, passent: Entity | null, contentmask: number): GameTraceResult => {
    // Note: traceBox usually expects a headnode (index).
    // Our makeLeafModel helper puts everything in leaf 0, so we pass -1 to start search (or 0 if nodes are built).
    // However, makeLeafModel creates a degenerate tree with no nodes, just one leaf (index 0).
    // traceBox with headnode 0 will try to access model.nodes[0] which might be empty.
    // If we pass -1 (or negative), it interprets it as leaf index (-1 - (-1) = 0).
    // So headnode: -1 is correct for single-leaf models.
    const result = traceBox({
      model,
      start,
      end,
      mins,
      maxs,
      contentMask: contentmask,
      headnode: -1
    });

    return {
      fraction: result.fraction,
      endpos: result.endpos,
      plane: result.plane,
      ent: null, // Basic BSP trace hits world, not entities
      contents: result.contents ?? 0,
      allsolid: result.allsolid,
      startsolid: result.startsolid,
      surface: {
          flags: result.surfaceFlags || 0,
          name: '',
          value: 0
      }
    } as unknown as GameTraceResult;
  };
}

describe('Physics Integration Tests', () => {
  let imports: GameImports;
  let system: EntitySystem;
  let entities: Entity[] = [];

  beforeEach(() => {
    entities = [];
    system = {
      forEachEntity: (callback: (e: Entity) => void) => {
        entities.forEach(callback);
      },
    } as any;

    imports = {
      trace: vi.fn(),
      linkentity: vi.fn((ent: Entity) => {
        // Update absmin/absmax
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
      }),
    } as unknown as GameImports;
  });

  it('Projectile Collision: should stop/hit when firing into a wall', () => {
    // Setup a world with a wall at x=100
    const wall = makeBrushFromMinsMaxs(
      { x: 100, y: -100, z: -100 },
      { x: 120, y: 100, z: 100 },
      CONTENTS_SOLID
    );
    const model = makeLeafModel([wall]);

    // Wire up trace
    imports.trace = createTraceDelegate(model);

    // Create projectile
    const proj = new Entity(1);
    proj.movetype = MoveType.FlyMissile;
    proj.origin = { x: 0, y: 0, z: 0 };
    proj.velocity = { x: 200, y: 0, z: 0 }; // Moving towards wall
    proj.mins = { x: 0, y: 0, z: 0 };
    proj.maxs = { x: 0, y: 0, z: 0 }; // Point projectile
    proj.clipmask = MASK_SHOT; // Ensure it hits solid

    // Time to impact: distance 100 / speed 200 = 0.5s.
    // Run for 0.6s
    const frametime = 0.1;
    let hit = false;

    for (let i = 0; i < 6; i++) {
        const oldX = proj.origin.x;
        runProjectileMovement(proj, imports, frametime);

        // If we hit the wall, runProjectileMovement sets origin to impact point.
        // It does NOT stop velocity automatically (that's handled by touch function usually),
        // but it should clamp position.

        // If we moved less than expected (velocity * frametime), we hit something
        const expectedMove = proj.velocity.x * frametime;
        const actualMove = proj.origin.x - oldX;

        if (actualMove < expectedMove - 0.01) {
            hit = true;
            // Should be at x=100 (minus epsilon)
            expect(proj.origin.x).toBeCloseTo(100, 0); // Precision might vary due to epsilon
            break;
        }
    }

    expect(hit).toBe(true);
  });

  it('Water Detection: should detect water contents', () => {
    // Setup water brush at z=-64 to z=0
    const water = makeBrushFromMinsMaxs(
        { x: -100, y: -100, z: -64 },
        { x: 100, y: 100, z: 0 },
        CONTENTS_WATER
    );
    const model = makeLeafModel([water]);

    // Test point in water
    const pInWater = { x: 0, y: 0, z: -32 };
    const c1 = pointContents(pInWater, model, -1);
    expect(c1 & CONTENTS_WATER).toBeTruthy();

    // Test point above water
    const pAbove = { x: 0, y: 0, z: 10 };
    const c2 = pointContents(pAbove, model, -1);
    expect(c2 & CONTENTS_WATER).toBeFalsy();
  });

  it('Trigger Volumes: should detect overlap with trigger brush', () => {
    // Setup trigger brush at x=50
    const trigger = makeBrushFromMinsMaxs(
        { x: 50, y: -50, z: -50 },
        { x: 100, y: 50, z: 50 },
        CONTENTS_TRIGGER
    );
    const model = makeLeafModel([trigger]);
    imports.trace = createTraceDelegate(model);

    const ent = new Entity(1);
    ent.origin = { x: 0, y: 0, z: 0 };
    ent.mins = { x: -10, y: -10, z: -10 };
    ent.maxs = { x: 10, y: 10, z: 10 };
    ent.clipmask = CONTENTS_TRIGGER;

    // Move into trigger
    const end = { x: 60, y: 0, z: 0 };
    const tr = imports.trace(ent.origin, ent.mins, ent.maxs, end, ent, CONTENTS_TRIGGER);

    // Trace should not be blocked by trigger (fraction 1) but should detect it?
    // Actually standard trace ignores triggers unless specified, but if we pass CONTENTS_TRIGGER in mask, it hits?
    // In Quake 2, triggers are usually sensors. traceBox normally hits anything in mask.
    // If we trace against CONTENTS_TRIGGER, it should hit.

    expect(tr.contents & CONTENTS_TRIGGER).toBeTruthy();
    // It should hit the face of the trigger at x=40 (50 - 10 bounds)
    expect(tr.fraction).toBeLessThan(1);
    expect(tr.endpos.x).toBeCloseTo(40, 0);
  });

  it('Platform Riding: rider should move with pusher and stop when blocked by world', () => {
    // World setup: Wall at x=100
    const wall = makeBrushFromMinsMaxs(
        { x: 100, y: -100, z: -100 },
        { x: 120, y: 100, z: 100 },
        CONTENTS_SOLID
    );
    const model = makeLeafModel([wall]);
    imports.trace = createTraceDelegate(model);

    // Pusher setup (Platform)
    const pusher = new Entity(1);
    pusher.movetype = MoveType.Push;
    pusher.solid = Solid.Bsp;
    pusher.origin = { x: 0, y: 0, z: 0 };
    pusher.mins = { x: -20, y: -20, z: -10 };
    pusher.maxs = { x: 20, y: 20, z: 10 };
    pusher.clipmask = MASK_SOLID;
    // Init abs
    imports.linkentity(pusher);
    pusher.velocity = { x: 100, y: 0, z: 0 }; // Moving right
    pusher.avelocity = { x: 0, y: 0, z: 0 };

    entities.push(pusher);

    // Rider setup
    const rider = new Entity(2);
    rider.origin = { x: 0, y: 0, z: 11 }; // On top
    rider.mins = { x: -10, y: -10, z: 0 };
    rider.maxs = { x: 10, y: 10, z: 10 };
    rider.groundentity = pusher;
    rider.solid = Solid.BoundingBox; // Needs to be solid to be pushed/checked?
    imports.linkentity(rider);

    entities.push(rider);

    // 1. Move free
    let res = runPush(pusher, system, imports, 0.1); // Move 10 units
    expect(res).toBe(true);
    expect(pusher.origin.x).toBeCloseTo(10);
    expect(rider.origin.x).toBeCloseTo(10);

    // 2. Move until pusher hits wall
    // Wall at 100. Pusher maxs.x is 20. So it hits at x=80.
    // Current x=10. Dist to impact = 70.
    // Let's jump to near impact.
    pusher.origin.x = 75;
    rider.origin.x = 75;
    imports.linkentity(pusher);
    imports.linkentity(rider);

    // Move 10 units -> target 85. Should hit wall at 80.
    // Since pusher hits wall, runPush returns false and reverts.
    res = runPush(pusher, system, imports, 0.1);

    expect(res).toBe(false);
    expect(pusher.origin.x).toBe(75); // Reverted
    expect(rider.origin.x).toBe(75); // Reverted
  });
});
