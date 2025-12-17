import { vi } from 'vitest';
import { Entity, SpawnRegistry, type SpawnContext, type EntitySystem } from '@quake2ts/game';
import { createRandomGenerator, type PmoveTraceFn, type PmoveTraceResult, type Vec3, CONTENTS_LADDER } from '@quake2ts/shared';

// -- Shared Helpers --

export const intersects = (end: Vec3, maxs: Vec3, mins: Vec3, boxMins: Vec3, boxMaxs: Vec3): boolean => {
  return (
    end.x + maxs.x > boxMins.x &&
    end.x + mins.x < boxMaxs.x &&
    end.y + maxs.y > boxMins.y &&
    end.y + mins.y < boxMaxs.y &&
    end.z + maxs.z > boxMins.z &&
    end.z + mins.z < boxMaxs.z
  );
};

export const stairTrace: PmoveTraceFn = (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3): PmoveTraceResult => {
  // Default bbox if not provided
  const useMins = mins ?? { x: -16, y: -16, z: -24 };
  const useMaxs = maxs ?? { x: 16, y: 16, z: 32 };

  // Step: x from 0 forward, z from 0 to 8
  const STEP_HEIGHT = 8;
  const STEP_X_START = 0;

  const isHorizontal = Math.abs(end.z - start.z) < 1;
  const isMovingDown = end.z < start.z;

  // Check if trying to go below the floor
  const endMinZ = end.z + useMins.z;
  const startMinZ = start.z + useMins.z;
  const endMaxX = end.x + useMaxs.x;

  // If moving horizontally, check if we'd hit the vertical face of the step
  // The step only blocks if the player's origin is below the step height
  if (isHorizontal && end.z < STEP_HEIGHT && endMaxX > STEP_X_START) {
    // Check if we're crossing into the step area
    const startMaxX = start.x + useMaxs.x;
    if (startMaxX <= STEP_X_START) {
      // We're moving from before the step to past it, block
      return {
        allsolid: false,
        startsolid: false,
        fraction: 0,
        endpos: start,
        planeNormal: { x: -1, y: 0, z: 0 },
        contents: 1,
      };
    }
  }

  // If moving down and over the step area, land on the step surface
  if (isMovingDown && end.x >= STEP_X_START) {
    // The step surface is at z=STEP_HEIGHT in world space
    // The player's bbox bottom reaches this plane when origin.z + mins.z = STEP_HEIGHT
    // So the player's origin should be at z = STEP_HEIGHT - mins.z
    const landZ = STEP_HEIGHT - useMins.z;

    // Check if we'd pass through the step surface
    // We cross the plane if start is above it and end would be below it
    if (startMinZ > STEP_HEIGHT && endMinZ < STEP_HEIGHT) {
      // Calculate the fraction along the ray where we intersect the plane
      // The bbox bottom is at: start.z + useMins.z + t * (end.z - start.z + 0) = STEP_HEIGHT
      // Solving for t: t = (STEP_HEIGHT - (start.z + useMins.z)) / ((end.z + useMins.z) - (start.z + useMins.z))
      const fraction = (STEP_HEIGHT - startMinZ) / (endMinZ - startMinZ);

      // Clamp to valid range [0, 1]
      const clampedFraction = Math.max(0, Math.min(1, fraction));

      // Calculate the endpos along the ray at this fraction
      const finalX = start.x + clampedFraction * (end.x - start.x);
      const finalY = start.y + clampedFraction * (end.y - start.y);
      const finalZ = start.z + clampedFraction * (end.z - start.z);

      return {
        allsolid: false,
        startsolid: false,
        fraction: clampedFraction,
        endpos: { x: finalX, y: finalY, z: finalZ },
        planeNormal: { x: 0, y: 0, z: 1 },
        contents: 1,
      };
    }
  }

  // If moving down and would go below floor level, block at floor
  if (isMovingDown && endMinZ < 0) {
    // Floor is at z=0, so player origin should be at z = -mins.z when landing
    const landZ = -useMins.z;

    // Only apply if we're crossing the floor plane
    if (startMinZ >= 0) {
      // Calculate fraction where bbox bottom hits z=0
      const fraction = (0 - startMinZ) / (endMinZ - startMinZ);
      const clampedFraction = Math.max(0, Math.min(1, fraction));

      const finalX = start.x + clampedFraction * (end.x - start.x);
      const finalY = start.y + clampedFraction * (end.y - start.y);
      const finalZ = start.z + clampedFraction * (end.z - start.z);

      return {
        allsolid: false,
        startsolid: false,
        fraction: clampedFraction,
        endpos: { x: finalX, y: finalY, z: finalZ },
        planeNormal: { x: 0, y: 0, z: 1 },
        contents: 1,
      };
    }

    // Already below floor, block immediately
    return {
      allsolid: false,
      startsolid: false,
      fraction: 0,
      endpos: start,
      planeNormal: { x: 0, y: 0, z: 1 },
      contents: 1,
    };
  }

  // Free movement
  return {
    allsolid: false,
    startsolid: false,
    fraction: 1.0,
    endpos: end,
    contents: 0,
  };
};

export const ladderTrace: PmoveTraceFn = (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3): PmoveTraceResult => {
  // Default bbox if not provided
  const useMins = mins ?? { x: -16, y: -16, z: -24 };
  const useMaxs = maxs ?? { x: 16, y: 16, z: 32 };

  // Define the ladder volume (x=0 to x=8, y=-16 to y=16, z=0 to z=100)
  const LADDER_X_MIN = 0;
  const LADDER_X_MAX = 8;
  const LADDER_Y_MIN = -16;
  const LADDER_Y_MAX = 16;
  const LADDER_Z_MIN = 0;
  const LADDER_Z_MAX = 100;

  // Check if end position is within the ladder volume
  const endInLadder =
    end.x + useMins.x < LADDER_X_MAX &&
    end.x + useMaxs.x > LADDER_X_MIN &&
    end.y + useMins.y < LADDER_Y_MAX &&
    end.y + useMaxs.y > LADDER_Y_MIN &&
    end.z + useMins.z < LADDER_Z_MAX &&
    end.z + useMaxs.z > LADDER_Z_MIN;

  // If moving into the ladder from outside (moving forward into it)
  const movingIntoLadder = start.x < LADDER_X_MIN && end.x >= LADDER_X_MIN;

  // If moving horizontally into the ladder front face, block with ladder surface
  if (movingIntoLadder && Math.abs(end.z - start.z) < 0.1) {
    return {
      allsolid: false,
      startsolid: false,
      fraction: 0,
      endpos: start,
      planeNormal: { x: -1, y: 0, z: 0 },
      contents: CONTENTS_LADDER,
    };
  }

  // If we're in the ladder volume, return success but with CONTENTS_LADDER
  // This allows the player to detect they're on a ladder without blocking movement
  if (endInLadder) {
    return {
      allsolid: false,
      startsolid: false,
      fraction: 1.0,
      endpos: end,
      contents: CONTENTS_LADDER,
    };
  }

  // Floor at z=0
  if (end.z + useMins.z <= 0) {
    return {
      allsolid: false,
      startsolid: false,
      fraction: 0,
      endpos: start,
      planeNormal: { x: 0, y: 0, z: 1 },
      contents: 1,
    };
  }

  // No collision - free movement
  return {
    allsolid: false,
    startsolid: false,
    fraction: 1.0,
    endpos: end,
    contents: 0,
  };
};

// -- Game Helpers --

export function createTestContext(options?: { seed?: number }): { entities: EntitySystem, game: any } & SpawnContext {
  const engine = {
    sound: vi.fn(),
    soundIndex: vi.fn((sound: string) => 0),
    modelIndex: vi.fn((model: string) => 0),
    centerprintf: vi.fn(),
  };

  const seed = options?.seed ?? 12345;
  const traceFn = vi.fn((start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3) => ({
        fraction: 1.0,
        ent: null,
        allsolid: false,
        startsolid: false,
        endpos: end, // Use end argument
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
        surfaceFlags: 0,
        contents: 0
    }));

  const spawnRegistry = new SpawnRegistry();

  const game = {
      random: createRandomGenerator({ seed }),
      registerEntitySpawn: vi.fn((classname: string, spawnFunc: (entity: Entity) => void) => {
          spawnRegistry.register(classname, (entity) => spawnFunc(entity));
      }),
      unregisterEntitySpawn: vi.fn((classname: string) => {
          spawnRegistry.unregister(classname);
      }),
      getCustomEntities: vi.fn(() => Array.from(spawnRegistry.keys()))
  };

  const entities = {
    spawn: vi.fn(() => new Entity(1)),
    free: vi.fn(),
    finalizeSpawn: vi.fn(),
    freeImmediate: vi.fn(),
    setSpawnRegistry: vi.fn(),
    timeSeconds: 10,
    deltaSeconds: 0.1, // Added deltaSeconds
    modelIndex: vi.fn(() => 0),
    scheduleThink: vi.fn((entity: Entity, time: number) => {
      entity.nextthink = time;
    }),
    linkentity: vi.fn(),
    trace: traceFn, // Directly provide the mock function property
    pointcontents: vi.fn(() => 0),
    multicast: vi.fn(),
    unicast: vi.fn(),
    engine, // Attach mocked engine
    game,
    sound: vi.fn((ent: Entity, chan: number, sound: string, vol: number, attn: number, timeofs: number) => {
      engine.sound(ent, chan, sound, vol, attn, timeofs);
    }),
    soundIndex: vi.fn((sound: string) => engine.soundIndex(sound)),
    useTargets: vi.fn((entity: Entity, activator: Entity | null) => {
    }),
    findByTargetName: vi.fn(() => []),
    pickTarget: vi.fn(() => null),
    killBox: vi.fn(),
    rng: createRandomGenerator({ seed }), // Use real RNG for determinism or easy mocking if we replace it
    imports: {
        configstring: vi.fn(),
        trace: traceFn, // Also in imports for good measure
        pointcontents: vi.fn(() => 0),
    },
    level: {
        intermission_angle: { x: 0, y: 0, z: 0 },
        intermission_origin: { x: 0, y: 0, z: 0 },
    },
    targetNameIndex: new Map(),
    forEachEntity: vi.fn((callback) => {
        // Implement simple iteration over a few mocked entities if needed,
        // or just rely on the fact that G_PickTarget iterates.
        // For testing G_PickTarget, we can look at the targetNameIndex we just added
        if ((entities as any).targetNameIndex) {
            for (const bucket of (entities as any).targetNameIndex.values()) {
                for (const ent of bucket) {
                    callback(ent);
                }
            }
        }
    }),
    find: vi.fn((predicate: (ent: Entity) => boolean) => {
        // Simple mock implementation of find
        if ((entities as any).targetNameIndex) {
             for (const bucket of (entities as any).targetNameIndex.values()) {
                for (const ent of bucket) {
                    if (predicate(ent)) return ent;
                }
            }
        }
        return undefined;
    }),
    beginFrame: vi.fn((timeSeconds: number) => {
        (entities as any).timeSeconds = timeSeconds;
    }),
    targetAwareness: {
      timeSeconds: 10,
      frameNumber: 1,
      sightEntity: null,
      soundEntity: null,
    }
  } as unknown as EntitySystem;

  return {
    keyValues: {},
    entities,
    game: game,
    health_multiplier: 1,
    warn: vi.fn(),
    free: vi.fn(),
    // Legacy support for tests that might check precache
    precacheModel: vi.fn(),
    precacheSound: vi.fn(),
    precacheImage: vi.fn(),
  } as unknown as SpawnContext & { entities: EntitySystem, game: any };
}

export function createSpawnContext(): SpawnContext {
    return createTestContext();
}

export function createEntity(): Entity {
    return new Entity(1);
}
