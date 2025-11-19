import {
  addVec3,
  lengthSquaredVec3,
  scaleVec3,
  subtractVec3,
  type Vec3,
} from '../math/vec3.js';
import type { PmoveTraceResult } from './types.js';

const AXES = ['x', 'y', 'z'] as const;
type Axis = (typeof AXES)[number];

type AxisTuple = readonly [number, number, number];
type SideBoundCode = -1 | 0 | 1;

interface SideCheck {
  readonly normal: AxisTuple;
  readonly mins: readonly [SideBoundCode, SideBoundCode, SideBoundCode];
  readonly maxs: readonly [SideBoundCode, SideBoundCode, SideBoundCode];
}

const SIDE_CHECKS: readonly SideCheck[] = [
  { normal: [0, 0, 1], mins: [-1, -1, 0], maxs: [1, 1, 0] },
  { normal: [0, 0, -1], mins: [-1, -1, 0], maxs: [1, 1, 0] },
  { normal: [1, 0, 0], mins: [0, -1, -1], maxs: [0, 1, 1] },
  { normal: [-1, 0, 0], mins: [0, -1, -1], maxs: [0, 1, 1] },
  { normal: [0, 1, 0], mins: [-1, 0, -1], maxs: [1, 0, 1] },
  { normal: [0, -1, 0], mins: [-1, 0, -1], maxs: [1, 0, 1] },
];

export interface FixStuckParams {
  readonly origin: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly trace: FixStuckTraceFn;
}

export type FixStuckResult = 'good-position' | 'fixed' | 'no-good-position';

export interface FixStuckOutcome {
  readonly result: FixStuckResult;
  readonly origin: Vec3;
}

export type FixStuckTraceFn = (
  start: Vec3,
  mins: Vec3,
  maxs: Vec3,
  end: Vec3,
) => PmoveTraceResult;

interface CandidatePosition {
  readonly distance: number;
  readonly origin: Vec3;
}

const ZERO_VEC: Vec3 = { x: 0, y: 0, z: 0 };

type MutableVec3 = { x: number; y: number; z: number };

function cloneMutable(vec: Vec3): MutableVec3 {
  return { x: vec.x, y: vec.y, z: vec.z };
}

function tupleToVec3(tuple: AxisTuple): Vec3 {
  return { x: tuple[0], y: tuple[1], z: tuple[2] };
}

function adjustAxis(vec: MutableVec3, axis: Axis, delta: number): void {
  if (delta === 0) return;
  switch (axis) {
    case 'x':
      vec.x += delta;
      break;
    case 'y':
      vec.y += delta;
      break;
    case 'z':
      vec.z += delta;
      break;
  }
}

function setAxis(vec: MutableVec3, axis: Axis, value: number): void {
  switch (axis) {
    case 'x':
      vec.x = value;
      break;
    case 'y':
      vec.y = value;
      break;
    case 'z':
      vec.z = value;
      break;
  }
}

function axisValue(vec: Vec3, axis: Axis): number {
  switch (axis) {
    case 'x':
      return vec.x;
    case 'y':
      return vec.y;
    case 'z':
    default:
      return vec.z;
  }
}

function boundValue(code: SideBoundCode, axis: Axis, mins: Vec3, maxs: Vec3): number {
  if (code === -1) {
    return axisValue(mins, axis);
  }
  if (code === 1) {
    return axisValue(maxs, axis);
  }
  return 0;
}

function applySideOffset(base: Vec3, side: SideCheck, mins: Vec3, maxs: Vec3): MutableVec3 {
  const result = cloneMutable(base);
  for (let i = 0; i < AXES.length; i++) {
    const axis = AXES[i];
    const normal = side.normal[i];
    if (normal < 0) {
      adjustAxis(result, axis, axisValue(mins, axis));
    } else if (normal > 0) {
      adjustAxis(result, axis, axisValue(maxs, axis));
    }
  }
  return result;
}

function buildSideBounds(side: SideCheck, mins: Vec3, maxs: Vec3): { mins: MutableVec3; maxs: MutableVec3 } {
  const localMins = cloneMutable(ZERO_VEC);
  const localMaxs = cloneMutable(ZERO_VEC);
  for (let i = 0; i < AXES.length; i++) {
    const axis = AXES[i];
    setAxis(localMins, axis, boundValue(side.mins[i], axis, mins, maxs));
    setAxis(localMaxs, axis, boundValue(side.maxs[i], axis, mins, maxs));
  }
  return { mins: localMins, maxs: localMaxs };
}

function addEpsilon(
  source: MutableVec3,
  axis: Axis | undefined,
  direction: number,
): MutableVec3 {
  if (!axis || direction === 0) {
    return source;
  }
  const clone = cloneMutable(source);
  adjustAxis(clone, axis, direction);
  return clone;
}

function addEpsilonImmutable(vec: Vec3, axis: Axis | undefined, direction: number): Vec3 {
  if (!axis || direction === 0) {
    return vec;
  }
  switch (axis) {
    case 'x':
      return { ...vec, x: vec.x + direction };
    case 'y':
      return { ...vec, y: vec.y + direction };
    case 'z':
    default:
      return { ...vec, z: vec.z + direction };
  }
}

/**
 * TypeScript port of G_FixStuckObject_Generic from rerelease p_move.cpp. Attempts to
 * nudge a stuck bounding box out of solid space by probing the faces of the box and
 * moving towards the opposite side, keeping the smallest successful displacement.
 */
export function fixStuckObjectGeneric(params: FixStuckParams): FixStuckOutcome {
  const { origin, mins, maxs, trace } = params;

  const initial = trace(origin, mins, maxs, origin);
  if (!initial.startsolid) {
    return { result: 'good-position', origin: { ...origin } };
  }

  const candidates: CandidatePosition[] = [];

  for (let i = 0; i < SIDE_CHECKS.length; i++) {
    const side = SIDE_CHECKS[i];
    const { mins: localMins, maxs: localMaxs } = buildSideBounds(side, mins, maxs);

    let start = applySideOffset(origin, side, mins, maxs);
    let tr = trace(start, localMins, localMaxs, start);

    let epsilonAxis: Axis | undefined;
    let epsilonDir = 0;

    if (tr.startsolid) {
      for (let axisIndex = 0; axisIndex < AXES.length; axisIndex++) {
        if (side.normal[axisIndex] !== 0) {
          continue;
        }
        const axis = AXES[axisIndex];
        let epsilonStart = cloneMutable(start);
        adjustAxis(epsilonStart, axis, 1);
        tr = trace(epsilonStart, localMins, localMaxs, epsilonStart);
        if (!tr.startsolid) {
          start = epsilonStart;
          epsilonAxis = axis;
          epsilonDir = 1;
          break;
        }
        epsilonStart = cloneMutable(start);
        adjustAxis(epsilonStart, axis, -1);
        tr = trace(epsilonStart, localMins, localMaxs, epsilonStart);
        if (!tr.startsolid) {
          start = epsilonStart;
          epsilonAxis = axis;
          epsilonDir = -1;
          break;
        }
      }
    }

    if (tr.startsolid) {
      continue;
    }

    const otherSide = SIDE_CHECKS[i ^ 1];
    let oppositeStart = applySideOffset(origin, otherSide, mins, maxs);
    oppositeStart = addEpsilon(oppositeStart, epsilonAxis, epsilonDir);

    tr = trace(start, localMins, localMaxs, oppositeStart);
    if (tr.startsolid) {
      continue;
    }

    const normal = tupleToVec3(side.normal);
    const end = addVec3(tr.endpos ?? oppositeStart, scaleVec3(normal, 0.125));
    const delta = subtractVec3(end, oppositeStart);
    let newOrigin = addVec3(origin, delta);
    newOrigin = addEpsilonImmutable(newOrigin, epsilonAxis, epsilonDir);

    const validation = trace(newOrigin, mins, maxs, newOrigin);
    if (validation.startsolid) {
      continue;
    }

    candidates.push({ origin: newOrigin, distance: lengthSquaredVec3(delta) });
  }

  if (candidates.length === 0) {
    return { result: 'no-good-position', origin: { ...origin } };
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return { result: 'fixed', origin: { ...candidates[0].origin } };
}
