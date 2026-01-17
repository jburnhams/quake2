import type { PmoveTraceFn, PmoveTraceResult } from './pmove/types.js';
import { type Vec3 } from './math/vec3.js';
import { CONTENTS_LADDER, CONTENTS_SOLID } from './bsp/contents.js';
import { type CollisionBrush, type CollisionModel, type CollisionPlane, type CollisionNode, type CollisionLeaf, traceBox, computePlaneSignBits } from './bsp/collision.js';

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

/**
 * Creates a collision plane with the specified normal and distance.
 * Automatically calculates the plane type and signbits.
 */
export function makePlane(normal: Vec3, dist: number): CollisionPlane {
  return {
    normal,
    dist,
    type: Math.abs(normal.x) === 1 ? 0 : Math.abs(normal.y) === 1 ? 1 : Math.abs(normal.z) === 1 ? 2 : 3,
    signbits: computePlaneSignBits(normal),
  };
}

/**
 * Creates a simple axis-aligned cubic brush for testing.
 */
export function makeAxisBrush(size: number, contents = CONTENTS_SOLID): CollisionBrush {
  const half = size / 2;
  const planes = [
    makePlane({ x: 1, y: 0, z: 0 }, half),
    makePlane({ x: -1, y: 0, z: 0 }, half),
    makePlane({ x: 0, y: 1, z: 0 }, half),
    makePlane({ x: 0, y: -1, z: 0 }, half),
    makePlane({ x: 0, y: 0, z: 1 }, half),
    makePlane({ x: 0, y: 0, z: -1 }, half),
  ];

  return {
    contents,
    sides: planes.map((plane) => ({ plane, surfaceFlags: 0 })),
  };
}

/**
 * Creates a BSP node.
 */
export function makeNode(plane: CollisionPlane, children: [number, number]): CollisionNode {
  return { plane, children };
}

/**
 * Constructs a full CollisionModel from components.
 */
export function makeBspModel(
  planes: CollisionPlane[],
  nodes: CollisionNode[],
  leaves: CollisionLeaf[],
  brushes: CollisionBrush[],
  leafBrushes: number[]
): CollisionModel {
  return {
    planes,
    nodes,
    leaves,
    brushes,
    leafBrushes,
    bmodels: [],
  };
}

/**
 * Creates a BSP leaf.
 */
export function makeLeaf(contents: number, firstLeafBrush: number, numLeafBrushes: number): CollisionLeaf {
  return { contents, cluster: 0, area: 0, firstLeafBrush, numLeafBrushes };
}

/**
 * Creates a simplified CollisionModel consisting of a single leaf containing the provided brushes.
 */
export function makeLeafModel(brushes: CollisionBrush[]): CollisionModel {
  const planes = brushes.flatMap((brush) => brush.sides.map((side) => side.plane));

  return {
    planes,
    nodes: [],
    leaves: [makeLeaf(0, 0, brushes.length)],
    brushes,
    leafBrushes: brushes.map((_, i) => i),
    bmodels: [],
  };
}

/**
 * Creates a brush defined by min and max bounds.
 */
export function makeBrushFromMinsMaxs(mins: Vec3, maxs: Vec3, contents = CONTENTS_SOLID): CollisionBrush {
  const planes = [
    makePlane({ x: 1, y: 0, z: 0 }, maxs.x),
    makePlane({ x: -1, y: 0, z: 0 }, -mins.x),
    makePlane({ x: 0, y: 1, z: 0 }, maxs.y),
    makePlane({ x: 0, y: -1, z: 0 }, -mins.y),
    makePlane({ x: 0, y: 0, z: 1 }, maxs.z),
    makePlane({ x: 0, y: 0, z: -1 }, -mins.z),
  ];

  return {
    contents,
    sides: planes.map((plane) => ({ plane, surfaceFlags: 0 })),
  };
}

/**
 * Creates a trace function that runs against a given collision model.
 * Useful for integration tests using simple brush models.
 */
export function createTraceRunner(model: CollisionModel, headnode: number = -1) {
    return (start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3) => {
        return traceBox({ model, start, end, mins, maxs, headnode });
    };
}
