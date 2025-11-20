import type { PmoveTraceFn, PmoveTraceResult } from '../src/pmove/types.js';
import type { Vec3 } from '../src/math/vec3.js';
import { CONTENTS_LADDER } from '../src/bsp/contents.js';

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
    // Check if we'd pass through the step surface (z=STEP_HEIGHT)
    if (start.z > STEP_HEIGHT && end.z + useMins.z < STEP_HEIGHT) {
      // Land on the step surface
      const landZ = STEP_HEIGHT - useMins.z;
      return {
        allsolid: false,
        startsolid: false,
        fraction: (start.z - landZ) / (start.z - end.z),
        endpos: { x: end.x, y: end.y, z: landZ },
        planeNormal: { x: 0, y: 0, z: 1 },
        contents: 1,
      };
    }
  }

  // If moving down and would go below floor level, block at floor
  if (isMovingDown && endMinZ < 0) {
    // Land on the floor
    const landZ = -useMins.z;
    return {
      allsolid: false,
      startsolid: false,
      fraction: startMinZ >= 0 ? (start.z - landZ) / (start.z - end.z) : 0,
      endpos: { x: end.x, y: end.y, z: landZ },
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
