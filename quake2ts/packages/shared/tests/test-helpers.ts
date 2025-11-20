import { PmoveTraceFn, TraceResult } from '../src/pmove/types.js';
import { Vec3 } from '../src/math/vec3.js';
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

export const stairTrace: PmoveTraceFn = (start, end, mins, maxs, passent, contentmask): TraceResult => {
  // Define the floor and the step.
  const floor = { mins: { x: -1000, y: -1000, z: -1000 }, maxs: { x: 1000, y: 1000, z: 0 } };
  const step = { mins: { x: 0, y: -1000, z: 0 }, maxs: { x: 1000, y: 1000, z: 8 } };

  if (intersects(end, maxs, mins, floor.mins, floor.maxs) || intersects(end, maxs, mins, step.mins, step.maxs)) {
    return {
      allsolid: false,
      startsolid: false,
      fraction: 0,
      endpos: start,
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
      contents: 1,
    };
  }

  return {
    allsolid: false,
    startsolid: false,
    fraction: 1.0,
    endpos: end,
    plane: null,
    contents: 0,
  };
};

export const ladderTrace: PmoveTraceFn = (start, end, mins, maxs, passent, contentmask): TraceResult => {
  // Define the ladder.
  const ladder = { mins: { x: 0, y: -16, z: 0 }, maxs: { x: 8, y: 16, z: 100 } };

  if (intersects(end, maxs, mins, ladder.mins, ladder.maxs)) {
    return {
      allsolid: false,
      startsolid: false,
      fraction: 0,
      endpos: start,
      plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 },
      contents: CONTENTS_LADDER,
    };
  }

  return {
    allsolid: false,
    startsolid: false,
    fraction: 1.0,
    endpos: end,
    plane: null,
    contents: 0,
  };
};
