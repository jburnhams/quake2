import { Entity, MoveType, Solid, EntitySystem } from '@quake2ts/game';
import { Vec3, copyVec3, TraceResult, addVec3, subtractVec3, scaleVec3, lengthVec3, normalizeVec3, dotVec3 } from '@quake2ts/shared';
import { TestContext } from '../helpers.js';
import { intersects, createTraceMock } from '../../shared/collision.js';

/**
 * Creates a physics test scenario with pre-configured geometry.
 * NOTE: Since real BSP loading is complex, this often uses block entities
 * or mocked trace functions unless a real BSP is loaded in the context.
 */
export interface PhysicsScenario {
  ground: Entity;
  walls: Entity[];
  setup: (context: TestContext) => void;
}

/**
 * Configures the test context with a specific physics scenario (e.g. stairs, ladder).
 * Spawns necessary static entities (walls, floors) to simulate the environment.
 *
 * @param scenarioType - The type of scenario to set up ('stairs', 'ladder', etc.).
 * @param context - The TestContext to spawn entities into.
 * @returns A PhysicsScenario object containing references to created entities.
 */
export function createPhysicsTestScenario(
  scenarioType: 'stairs' | 'ladder' | 'platform' | 'slope' | 'room',
  context: TestContext
): PhysicsScenario {
  const walls: Entity[] = [];
  const ground = context.entities.spawn();
  ground.classname = 'func_wall';
  ground.solid = Solid.Bsp;
  ground.movetype = MoveType.Push;
  ground.origin = { x: 0, y: 0, z: -10 };
  ground.mins = { x: -1000, y: -1000, z: -10 };
  ground.maxs = { x: 1000, y: 1000, z: 0 };
  context.entities.linkentity(ground);

  const setupStairs = () => {
    // Create steps
    for (let i = 0; i < 5; i++) {
      const step = context.entities.spawn();
      step.classname = 'func_wall';
      step.solid = Solid.Bsp;
      step.origin = { x: 100 + i * 32, y: 0, z: i * 16 };
      step.mins = { x: 0, y: -64, z: 0 };
      step.maxs = { x: 32, y: 64, z: 16 };
      context.entities.linkentity(step);
      walls.push(step);
    }
  };

  const setupLadder = () => {
    const ladder = context.entities.spawn();
    ladder.classname = 'func_wall'; // Or func_ladder if available
    ladder.solid = Solid.Bsp;
    ladder.origin = { x: 100, y: 0, z: 0 };
    ladder.mins = { x: 0, y: -32, z: 0 };
    ladder.maxs = { x: 10, y: 32, z: 200 };
    // surfaceFlags is typically on the collision trace result or the BSP model, not the entity directly
    // but tests might check for it manually on the mock entity.
    (ladder as unknown as { surfaceFlags: number }).surfaceFlags = 1; // SURF_LADDER
    context.entities.linkentity(ladder);
    walls.push(ladder);
  };

  const setupPlatform = () => {
    const plat = context.entities.spawn();
    plat.classname = 'func_plat';
    plat.solid = Solid.Bsp;
    plat.movetype = MoveType.Push;
    plat.origin = { x: 0, y: 0, z: 0 }; // Starts low
    plat.mins = { x: -64, y: -64, z: 0 };
    plat.maxs = { x: 64, y: 64, z: 10 };
    // Platform logic handles movement, but for physics collision it's just a solid box moving
    context.entities.linkentity(plat);
    walls.push(plat);
  };

  if (scenarioType === 'stairs') setupStairs();
  else if (scenarioType === 'ladder') setupLadder();
  else if (scenarioType === 'platform') setupPlatform();

  return {
    ground,
    walls,
    setup: (ctx) => {
        // Additional setup if needed
    }
  };
}


/**
 * Simulates a single physics step for an entity.
 * Uses the game's runPmove logic or manually invokes similar steps.
 * This is useful for testing specific movement mechanics in isolation.
 *
 * @param entity - The entity to move.
 * @param destination - The target location.
 * @param context - The TestContext providing the trace function.
 * @returns The TraceResult of the movement attempt.
 */
export function simulateMovement(entity: Entity, destination: Vec3, context: TestContext): TraceResult {
    // Calculate velocity needed to reach destination in one frame (assuming 0.1s tick)
    const dt = 0.1;
    const delta = subtractVec3(destination, entity.origin);
    const dist = lengthVec3(delta);

    if (dist < 0.001) {
        return createTraceMock({ fraction: 1.0, endpos: destination }) as unknown as TraceResult;
    }

    const dir = normalizeVec3(delta);
    entity.velocity = scaleVec3(dir, dist / dt);

    // Perform trace to check if movement is possible
    const start = { ...entity.origin };
    const end = destination;

    // Perform trace to check if movement is possible
    const clipmask = typeof (entity as unknown as { clipmask?: number }).clipmask === 'number'
        ? (entity as unknown as { clipmask: number }).clipmask
        : 0;

    const tr = context.entities.trace(start, entity.mins, entity.maxs, end, entity, clipmask);

    // Update origin if not stuck
    if (!tr.startsolid && !tr.allsolid && tr.endpos) {
        entity.origin = { ...tr.endpos };
        context.entities.linkentity(entity);
    }

    return tr;
}

/**
 * Simulates gravity application on an entity.
 * Updates velocity and ground status based on gravity trace.
 *
 * @param entity - The entity to apply gravity to.
 * @param deltaTime - The time step to advance.
 * @param context - The TestContext.
 */
export function simulateGravity(entity: Entity, deltaTime: number, context: TestContext): void {
    const cvars = (context.game as unknown as { cvars?: { gravity?: { value: number } } }).cvars;
    const gravity = cvars?.gravity?.value ?? 800; // MockGame might not have cvars yet
    if (entity.groundentity || !entity.movetype) return;

    // Simple Euler integration for gravity
    entity.velocity = {
        x: entity.velocity.x,
        y: entity.velocity.y,
        z: entity.velocity.z - gravity * deltaTime
    };

    // Check ground after applying gravity velocity
    // Simple check: trace down
    const start = { ...entity.origin };
    const end = { x: start.x, y: start.y, z: start.z - 0.25 };

    const clipmask = typeof (entity as unknown as { clipmask?: number }).clipmask === 'number'
        ? (entity as unknown as { clipmask: number }).clipmask
        : 0;

    const tr = context.entities.trace(start, entity.mins, entity.maxs, end, entity, clipmask);

    if (tr.fraction < 1.0) {
        entity.groundentity = tr.ent || context.entities.world;
        entity.velocity = { ...entity.velocity, z: 0 };
        // Snap to ground
        if (tr.endpos) {
             entity.origin = { ...entity.origin, z: tr.endpos.z };
        }
    } else {
        entity.groundentity = null; // Assigning null instead of undefined
    }
}

/**
 * Simulates a jump action.
 * Checks for ground contact and applies upward velocity.
 *
 * @param entity - The entity attempting to jump.
 * @param context - The TestContext.
 */
export function simulateJump(entity: Entity, context: TestContext): void {
    if (!entity.groundentity) return;

    entity.groundentity = null;
    entity.velocity = { ...entity.velocity, z: 270 }; // Standard jump velocity
}
