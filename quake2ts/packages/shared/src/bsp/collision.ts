import type { Vec3 } from '../math/vec3.js';

export interface CollisionPlane {
  normal: Vec3;
  dist: number;
  type: number;
  signbits: number;
}

export interface CollisionBrushSide {
  plane: CollisionPlane;
  surfaceFlags: number;
}

export interface CollisionBrush {
  contents: number;
  sides: CollisionBrushSide[];
  checkcount?: number;
}

export interface CollisionLeaf {
  contents: number;
  cluster: number;
  area: number;
  firstLeafBrush: number;
  numLeafBrushes: number;
}

export interface CollisionNode {
  plane: CollisionPlane;
  children: [number, number];
}

export interface CollisionBmodel {
  mins: Vec3;
  maxs: Vec3;
  origin: Vec3;
  headnode: number;
}

export interface CollisionModel {
  planes: CollisionPlane[];
  nodes: CollisionNode[];
  leaves: CollisionLeaf[];
  brushes: CollisionBrush[];
  leafBrushes: number[];
  bmodels: CollisionBmodel[];
}

export interface CollisionLumpData {
  planes: Array<{ normal: Vec3; dist: number; type: number }>;
  nodes: Array<{ planenum: number; children: [number, number] }>;
  leaves: Array<{ contents: number; cluster: number; area: number; firstLeafBrush: number; numLeafBrushes: number }>;
  brushes: Array<{ firstSide: number; numSides: number; contents: number }>;
  brushSides: Array<{ planenum: number; surfaceFlags: number }>;
  leafBrushes: number[];
  bmodels: Array<{ mins: Vec3; maxs: Vec3; origin: Vec3; headnode: number }>;
}

export interface TraceResult {
  fraction: number;
  plane: CollisionPlane | null;
  contents: number;
  surfaceFlags: number;
  startsolid: boolean;
  allsolid: boolean;
}

export enum PlaneSide {
  FRONT = 1,
  BACK = 2,
  CROSS = 3,
}

export const DIST_EPSILON = 0.03125;

export function buildCollisionModel(lumps: CollisionLumpData): CollisionModel {
  const planes: CollisionPlane[] = lumps.planes.map((plane) => ({
    ...plane,
    signbits: computePlaneSignBits(plane.normal),
  }));

  const nodes: CollisionNode[] = lumps.nodes.map((node) => ({
    plane: planes[node.planenum],
    children: node.children,
  }));

  const brushes: CollisionBrush[] = lumps.brushes.map((brush) => {
    const sides = lumps.brushSides.slice(brush.firstSide, brush.firstSide + brush.numSides).map((side) => ({
      plane: planes[side.planenum],
      surfaceFlags: side.surfaceFlags,
    }));

    return {
      contents: brush.contents,
      sides,
      checkcount: 0,
    };
  });

  const leaves: CollisionLeaf[] = lumps.leaves.map((leaf) => ({
    contents: leaf.contents,
    cluster: leaf.cluster,
    area: leaf.area,
    firstLeafBrush: leaf.firstLeafBrush,
    numLeafBrushes: leaf.numLeafBrushes,
  }));

  const bmodels: CollisionBmodel[] = lumps.bmodels.map((model) => ({
    mins: model.mins,
    maxs: model.maxs,
    origin: model.origin,
    headnode: model.headnode,
  }));

  return {
    planes,
    nodes,
    leaves,
    brushes,
    leafBrushes: lumps.leafBrushes,
    bmodels,
  };
}

export function computePlaneSignBits(normal: Vec3): number {
  let bits = 0;
  if (normal.x < 0) bits |= 1;
  if (normal.y < 0) bits |= 2;
  if (normal.z < 0) bits |= 4;
  return bits;
}

export function planeDistanceToPoint(plane: CollisionPlane, point: Vec3): number {
  return plane.normal.x * point.x + plane.normal.y * point.y + plane.normal.z * point.z - plane.dist;
}

export function pointOnPlaneSide(plane: CollisionPlane, point: Vec3, epsilon = 0): PlaneSide.FRONT | PlaneSide.BACK | PlaneSide.CROSS {
  const dist = planeDistanceToPoint(plane, point);
  if (dist > epsilon) {
    return PlaneSide.FRONT;
  }
  if (dist < -epsilon) {
    return PlaneSide.BACK;
  }
  return PlaneSide.CROSS;
}

export function boxOnPlaneSide(mins: Vec3, maxs: Vec3, plane: CollisionPlane, epsilon = 0): PlaneSide {
  let dist1: number;
  let dist2: number;

  switch (plane.signbits) {
    case 0:
      dist1 = plane.normal.x * maxs.x + plane.normal.y * maxs.y + plane.normal.z * maxs.z;
      dist2 = plane.normal.x * mins.x + plane.normal.y * mins.y + plane.normal.z * mins.z;
      break;
    case 1:
      dist1 = plane.normal.x * mins.x + plane.normal.y * maxs.y + plane.normal.z * maxs.z;
      dist2 = plane.normal.x * maxs.x + plane.normal.y * mins.y + plane.normal.z * mins.z;
      break;
    case 2:
      dist1 = plane.normal.x * maxs.x + plane.normal.y * mins.y + plane.normal.z * maxs.z;
      dist2 = plane.normal.x * mins.x + plane.normal.y * maxs.y + plane.normal.z * mins.z;
      break;
    case 3:
      dist1 = plane.normal.x * mins.x + plane.normal.y * mins.y + plane.normal.z * maxs.z;
      dist2 = plane.normal.x * maxs.x + plane.normal.y * maxs.y + plane.normal.z * mins.z;
      break;
    case 4:
      dist1 = plane.normal.x * maxs.x + plane.normal.y * maxs.y + plane.normal.z * mins.z;
      dist2 = plane.normal.x * mins.x + plane.normal.y * mins.y + plane.normal.z * maxs.z;
      break;
    case 5:
      dist1 = plane.normal.x * mins.x + plane.normal.y * maxs.y + plane.normal.z * mins.z;
      dist2 = plane.normal.x * maxs.x + plane.normal.y * mins.y + plane.normal.z * maxs.z;
      break;
    case 6:
      dist1 = plane.normal.x * maxs.x + plane.normal.y * mins.y + plane.normal.z * mins.z;
      dist2 = plane.normal.x * mins.x + plane.normal.y * maxs.y + plane.normal.z * maxs.z;
      break;
    default:
      dist1 = plane.normal.x * mins.x + plane.normal.y * mins.y + plane.normal.z * mins.z;
      dist2 = plane.normal.x * maxs.x + plane.normal.y * maxs.y + plane.normal.z * maxs.z;
      break;
  }

  let sides = 0;
  if (dist1 - plane.dist >= -epsilon) sides = PlaneSide.FRONT;
  if (dist2 - plane.dist <= epsilon) sides |= PlaneSide.BACK;
  return sides as PlaneSide;
}

export function pointInsideBrush(point: Vec3, brush: CollisionBrush, epsilon = DIST_EPSILON): boolean {
  for (const side of brush.sides) {
    const dist = planeDistanceToPoint(side.plane, point);
    if (dist > epsilon) {
      return false;
    }
  }
  return true;
}

export interface BoxBrushTestResult {
  startsolid: boolean;
  allsolid: boolean;
  contents: number;
}

export function testBoxInBrush(origin: Vec3, mins: Vec3, maxs: Vec3, brush: CollisionBrush): BoxBrushTestResult {
  for (const side of brush.sides) {
    const offset = side.plane.normal.x * (side.plane.normal.x < 0 ? maxs.x : mins.x) +
      side.plane.normal.y * (side.plane.normal.y < 0 ? maxs.y : mins.y) +
      side.plane.normal.z * (side.plane.normal.z < 0 ? maxs.z : mins.z);

    const dist = side.plane.dist - offset;
    const d1 = origin.x * side.plane.normal.x + origin.y * side.plane.normal.y + origin.z * side.plane.normal.z - dist;

    if (d1 > 0) {
      return { startsolid: false, allsolid: false, contents: 0 };
    }
  }

  return { startsolid: true, allsolid: true, contents: brush.contents };
}

export interface ClipBoxParams {
  start: Vec3;
  end: Vec3;
  mins: Vec3;
  maxs: Vec3;
  brush: CollisionBrush;
  trace: TraceResult;
}

export function clipBoxToBrush({ start, end, mins, maxs, brush, trace }: ClipBoxParams): void {
  if (brush.sides.length === 0) return;

  const isPoint = mins.x === 0 && mins.y === 0 && mins.z === 0 && maxs.x === 0 && maxs.y === 0 && maxs.z === 0;

  let enterfrac = -1;
  let leavefrac = 1;
  let clipplane: CollisionPlane | null = null;
  let leadside: CollisionBrushSide | null = null;

  let getout = false;
  let startout = false;

  for (const side of brush.sides) {
    const { plane } = side;
    let dist = plane.dist;
    if (!isPoint) {
      const ofsX = plane.normal.x < 0 ? maxs.x : mins.x;
      const ofsY = plane.normal.y < 0 ? maxs.y : mins.y;
      const ofsZ = plane.normal.z < 0 ? maxs.z : mins.z;
      dist -= plane.normal.x * ofsX + plane.normal.y * ofsY + plane.normal.z * ofsZ;
    }

    const d1 = start.x * plane.normal.x + start.y * plane.normal.y + start.z * plane.normal.z - dist;
    const d2 = end.x * plane.normal.x + end.y * plane.normal.y + end.z * plane.normal.z - dist;

    if (d2 > 0) getout = true;
    if (d1 > 0) startout = true;

    if (d1 > 0 && d2 >= d1) {
      return;
    }

    if (d1 <= 0 && d2 <= 0) {
      continue;
    }

    if (d1 > d2) {
      const f = (d1 - DIST_EPSILON) / (d1 - d2);
      if (f > enterfrac) {
        enterfrac = f;
        clipplane = plane;
        leadside = side;
      }
    } else {
      const f = (d1 + DIST_EPSILON) / (d1 - d2);
      if (f < leavefrac) leavefrac = f;
    }
  }

  if (!startout) {
    trace.startsolid = true;
    if (!getout) trace.allsolid = true;
    return;
  }

  if (enterfrac < leavefrac && enterfrac > -1 && enterfrac < trace.fraction) {
    trace.fraction = enterfrac < 0 ? 0 : enterfrac;
    trace.plane = clipplane;
    trace.contents = brush.contents;
    trace.surfaceFlags = leadside?.surfaceFlags ?? 0;
  }
}

export function createDefaultTrace(): TraceResult {
  return {
    fraction: 1,
    plane: null,
    contents: 0,
    surfaceFlags: 0,
    startsolid: false,
    allsolid: false,
  };
}
