import { Entity, MoveType, Solid, TraceResult as GameTraceResult } from '@quake2ts/game';
import { Vec3, addVec3, scaleVec3, subtractVec3, normalizeVec3, copyVec3, CollisionPlane } from '@quake2ts/shared';
import { TestContext } from '../helpers.js';

export interface PhysicsScenario {
  entities: Entity[];
  world: Entity;
  traceResults: Map<string, any>;
}

export interface FullTraceResult {
  allsolid: boolean;
  startsolid: boolean;
  fraction: number;
  endpos: Vec3;
  plane: CollisionPlane | null;
  surfaceFlags: number;
  contents: number;
  ent: Entity | null;
}

/**
 * Simulates moving an entity towards a destination, handling collision via the context's trace function.
 * This is a simplified kinematic simulation for testing purposes.
 */
export function simulateMovement(
  entity: Entity,
  destination: Vec3,
  context: TestContext
): FullTraceResult {
  const start = copyVec3(entity.origin);
  const dir = subtractVec3(destination, start);
  const dist = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);

  if (dist < 0.001) {
    return {
      fraction: 1.0,
      endpos: destination,
      plane: { normal: { x: 0, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 },
      ent: null,
      allsolid: false,
      startsolid: false,
      surfaceFlags: 0,
      contents: 0
    };
  }

  // Perform trace using the context's mock trace
  const trace = context.entities.trace(
    start,
    destination,
    entity.mins,
    entity.maxs,
    entity,
    0
  ) as unknown as FullTraceResult;

  // Update entity position based on trace result
  if (trace.fraction < 1.0) {
    entity.origin = copyVec3(trace.endpos);
  } else {
    entity.origin = copyVec3(destination);
  }

  // Update linkage
  if (context.entities.linkentity) {
    context.entities.linkentity(entity);
  }

  return trace;
}

/**
 * Simulates gravity for a single frame.
 */
export function simulateGravity(
  entity: Entity,
  deltaTime: number,
  context: TestContext,
  gravity: number = 800
) {
  if (entity.movetype === MoveType.Fly || entity.movetype === MoveType.Noclip) {
    return;
  }

  // Apply gravity to velocity
  const currentVelocity = copyVec3(entity.velocity);
  entity.velocity = { ...currentVelocity, z: currentVelocity.z - gravity * deltaTime };

  // Move by velocity * time (simplified Euler integration)
  const moveStep = scaleVec3(entity.velocity, deltaTime);
  const dest = addVec3(entity.origin, moveStep);

  // Check for ground
  const trace = context.entities.trace(
    entity.origin,
    { ...entity.origin, z: entity.origin.z - 0.25 }, // Check just below
    entity.mins,
    entity.maxs,
    entity,
    0
  ) as unknown as FullTraceResult;

  // Check if trace.plane is not null before accessing normal
  if (trace.fraction < 1.0 && trace.plane && trace.plane.normal.z > 0.7) {
    entity.groundentity = trace.ent || context.entities.world;
    const vel = copyVec3(entity.velocity);
    entity.velocity = { ...vel, z: 0 }; // Stop falling
  } else {
    entity.groundentity = null;
    // Apply movement
    simulateMovement(entity, dest, context);
  }
}

/**
 * Simulates a jump action.
 */
export function simulateJump(
  entity: Entity,
  context: TestContext,
  jumpVelocity: number = 270
) {
  // Check if on ground
  const groundTrace = context.entities.trace(
    entity.origin,
    { ...entity.origin, z: entity.origin.z - 2 },
    entity.mins,
    entity.maxs,
    entity,
    0
  ) as unknown as FullTraceResult;

  if (groundTrace.fraction < 1.0 || entity.groundentity) {
    const vel = copyVec3(entity.velocity);
    entity.velocity = { ...vel, z: jumpVelocity };
    entity.groundentity = null;
    // Slight nudge up to break friction/ground contact
    const org = copyVec3(entity.origin);
    entity.origin = { ...org, z: org.z + 1 };
    if (context.entities.linkentity) {
      context.entities.linkentity(entity);
    }
  }
}

/**
 * Creates a standard physics test scenario with a floor and some obstacles.
 */
export function createPhysicsTestScenario(
  scenarioType: 'basic' | 'stairs' | 'platform' = 'basic',
  context: TestContext
): PhysicsScenario {
  const world = context.entities.world || new Entity(0);
  world.solid = Solid.Bsp;
  world.classname = 'worldspawn';

  const entities: Entity[] = [world];

  const floorZ = 0;

  const traceFn = (
    start: Vec3,
    end: Vec3,
    mins: Vec3 | null,
    maxs: Vec3 | null,
    passEntity: Entity | null,
    mask: number
  ): FullTraceResult => {
    // Basic floor check: Simulate a flat plane at floorZ
    // We check if the AABB travels through the floor plane.

    // Calculate the lowest Z point of the entity's AABB
    const minOffsetZ = mins ? mins.z : 0;
    const startBottomZ = start.z + minOffsetZ;
    const endBottomZ = end.z + minOffsetZ;

    // If movement crosses the floor plane
    if (startBottomZ >= floorZ && endBottomZ < floorZ) {
      const totalDist = startBottomZ - endBottomZ;
      const distToFloor = startBottomZ - floorZ;
      const t = distToFloor / totalDist;

      if (t >= 0 && t <= 1.0) {
         return {
            fraction: t,
            endpos: {
              x: start.x + (end.x - start.x) * t,
              y: start.y + (end.y - start.y) * t,
              z: floorZ - minOffsetZ // Ensure bottom is exactly at floorZ
            },
            plane: { normal: { x: 0, y: 0, z: 1 }, dist: floorZ, type: 0, signbits: 0 },
            ent: world,
            allsolid: false,
            startsolid: false,
            surfaceFlags: 0,
            contents: 0 // CONTENTS_SOLID
         };
      }
    }

    // If starting below floor (already embedded)
    if (startBottomZ < floorZ) {
        return {
            fraction: 0,
            endpos: start,
            plane: { normal: { x: 0, y: 0, z: 1 }, dist: floorZ, type: 0, signbits: 0 },
            ent: world,
            allsolid: true,
            startsolid: true,
            surfaceFlags: 0,
            contents: 0
        };
    }

    // No collision
    return {
      fraction: 1.0,
      endpos: end,
      plane: { normal: { x: 0, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 },
      ent: null,
      allsolid: false,
      startsolid: false,
      surfaceFlags: 0,
      contents: 0
    };
  };

  (context.entities as any).trace = traceFn;

  return {
    entities,
    world,
    traceResults: new Map()
  };
}
