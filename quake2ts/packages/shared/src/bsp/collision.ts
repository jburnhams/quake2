import { CONTENTS_TRIGGER } from './contents.js';
import type { Vec3 } from '../math/vec3.js';
import { ZERO_VEC3, addVec3, scaleVec3, subtractVec3 } from '../math/vec3.js';

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
  visibility?: CollisionVisibility;
}

export interface CollisionVisibilityCluster {
  pvs: Uint8Array;
  phs: Uint8Array;
}

export interface CollisionVisibility {
  numClusters: number;
  clusters: readonly CollisionVisibilityCluster[];
}

export interface CollisionLumpData {
  planes: Array<{ normal: Vec3; dist: number; type: number }>;
  nodes: Array<{ planenum: number; children: [number, number] }>;
  leaves: Array<{ contents: number; cluster: number; area: number; firstLeafBrush: number; numLeafBrushes: number }>;
  brushes: Array<{ firstSide: number; numSides: number; contents: number }>;
  brushSides: Array<{ planenum: number; surfaceFlags: number }>;
  leafBrushes: number[];
  bmodels: Array<{ mins: Vec3; maxs: Vec3; origin: Vec3; headnode: number }>;
  visibility?: CollisionVisibility;
}

export interface TraceResult {
  fraction: number;
  plane: CollisionPlane | null;
  contents: number;
  surfaceFlags: number;
  startsolid: boolean;
  allsolid: boolean;
}

export interface CollisionTraceResult {
  fraction: number;
  endpos: Vec3;
  plane: CollisionPlane | null;
  planeNormal?: Vec3;
  contents?: number;
  surfaceFlags?: number;
  startsolid: boolean;
  allsolid: boolean;
}

export enum PlaneSide {
  FRONT = 1,
  BACK = 2,
  CROSS = 3,
}

export const DIST_EPSILON = 0.03125;

const MAX_CHECKCOUNT = Number.MAX_SAFE_INTEGER - 1;
let globalBrushCheckCount = 1;

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
    visibility: lumps.visibility,
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

function findLeafIndex(point: Vec3, model: CollisionModel, headnode: number): number {
  let nodeIndex = headnode;

  while (nodeIndex >= 0) {
    const node = model.nodes[nodeIndex];
    const dist = planeDistanceToPoint(node.plane, point);
    nodeIndex = dist >= 0 ? node.children[0] : node.children[1];
  }

  return -1 - nodeIndex;
}

function computeLeafContents(model: CollisionModel, leafIndex: number, point: Vec3): number {
  const leaf = model.leaves[leafIndex];
  let contents = leaf.contents;

  const brushCheckCount = nextBrushCheckCount();
  const start = leaf.firstLeafBrush;
  const end = start + leaf.numLeafBrushes;

  for (let i = start; i < end; i += 1) {
    const brushIndex = model.leafBrushes[i];
    const brush = model.brushes[brushIndex];

    if (brush.checkcount === brushCheckCount) continue;
    brush.checkcount = brushCheckCount;

    if (brush.sides.length === 0) continue;
    if (pointInsideBrush(point, brush)) {
      contents |= brush.contents;
    }
  }

  return contents;
}

function nextBrushCheckCount(): number {
  const count = globalBrushCheckCount;
  globalBrushCheckCount += 1;
  if (globalBrushCheckCount >= MAX_CHECKCOUNT) {
    globalBrushCheckCount = 1;
  }
  return count;
}

function isPointBounds(mins: Vec3, maxs: Vec3): boolean {
  return mins.x === 0 && mins.y === 0 && mins.z === 0 && maxs.x === 0 && maxs.y === 0 && maxs.z === 0;
}

function planeOffsetForBounds(plane: CollisionPlane, mins: Vec3, maxs: Vec3): number {
  if (isPointBounds(mins, maxs)) return 0;

  const offset =
    plane.normal.x * (plane.normal.x < 0 ? maxs.x : mins.x) +
    plane.normal.y * (plane.normal.y < 0 ? maxs.y : mins.y) +
    plane.normal.z * (plane.normal.z < 0 ? maxs.z : mins.z);

  return offset;
}

function planeOffsetMagnitude(plane: CollisionPlane, mins: Vec3, maxs: Vec3): number {
  return Math.abs(planeOffsetForBounds(plane, mins, maxs));
}

function lerpPoint(start: Vec3, end: Vec3, t: number): Vec3 {
  return addVec3(start, scaleVec3(subtractVec3(end, start), t));
}

function finalizeTrace(trace: TraceResult, start: Vec3, end: Vec3): CollisionTraceResult {
  const clampedFraction = trace.allsolid ? 0 : trace.fraction;
  const endpos = lerpPoint(start, end, clampedFraction);

  return {
    fraction: clampedFraction,
    endpos,
    plane: trace.plane,
    planeNormal: trace.startsolid ? undefined : trace.plane?.normal,
    contents: trace.contents,
    surfaceFlags: trace.surfaceFlags,
    startsolid: trace.startsolid,
    allsolid: trace.allsolid,
  };
}

function clusterForPoint(point: Vec3, model: CollisionModel, headnode: number): number {
  const leafIndex = findLeafIndex(point, model, headnode);
  return model.leaves[leafIndex]?.cluster ?? -1;
}

function clusterVisible(
  visibility: CollisionVisibility,
  from: number,
  to: number,
  usePhs: boolean,
): boolean {
  if (!visibility || visibility.numClusters === 0) return true;
  if (from < 0 || to < 0) return false;
  if (from >= visibility.clusters.length || to >= visibility.numClusters) return false;

  const cluster = visibility.clusters[from];
  const set = usePhs ? cluster.phs : cluster.pvs;
  const byte = set[to >> 3];
  if (byte === undefined) return false;

  return (byte & (1 << (to & 7))) !== 0;
}

function recursiveHullCheck(params: {
  readonly model: CollisionModel;
  readonly nodeIndex: number;
  readonly startFraction: number;
  readonly endFraction: number;
  readonly start: Vec3;
  readonly end: Vec3;
  readonly traceStart: Vec3;
  readonly traceEnd: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly contentMask: number;
  readonly trace: TraceResult;
  readonly brushCheckCount: number;
}): void {
  const {
    model,
    nodeIndex,
    startFraction,
    endFraction,
    start,
    end,
    traceStart,
    traceEnd,
    mins,
    maxs,
    contentMask,
    trace,
    brushCheckCount,
  } = params;

  if (trace.fraction <= startFraction) {
    return;
  }

  if (nodeIndex < 0) {
    const leafIndex = -1 - nodeIndex;
    const leaf = model.leaves[leafIndex];

    const brushStart = leaf.firstLeafBrush;
    const brushEnd = brushStart + leaf.numLeafBrushes;

    for (let i = brushStart; i < brushEnd; i += 1) {
      const brushIndex = model.leafBrushes[i];
      const brush = model.brushes[brushIndex];

      if ((brush.contents & contentMask) === 0) continue;
      if (!brush.sides.length) continue;
      if (brush.checkcount === brushCheckCount) continue;

      brush.checkcount = brushCheckCount;

      clipBoxToBrush({ start: traceStart, end: traceEnd, mins, maxs, brush, trace });
      if (trace.allsolid) {
        return;
      }
    }
    return;
  }

  const node = model.nodes[nodeIndex];
  const plane = node.plane;
  const offset = planeOffsetForBounds(plane, mins, maxs);

  const startDist = planeDistanceToPoint(plane, start) + offset;
  const endDist = planeDistanceToPoint(plane, end) + offset;

  if (startDist >= 0 && endDist >= 0) {
    recursiveHullCheck({
      model,
      nodeIndex: node.children[0],
      startFraction,
      endFraction,
      start,
      end,
      traceStart,
      traceEnd,
      mins,
      maxs,
      contentMask,
      trace,
      brushCheckCount,
    });
    return;
  }

  if (startDist < 0 && endDist < 0) {
    recursiveHullCheck({
      model,
      nodeIndex: node.children[1],
      startFraction,
      endFraction,
      start,
      end,
      traceStart,
      traceEnd,
      mins,
      maxs,
      contentMask,
      trace,
      brushCheckCount,
    });
    return;
  }

  let side = 0;
  let idist = 1 / (startDist - endDist);
  let fraction1 = (startDist - DIST_EPSILON) * idist;
  let fraction2 = (startDist + DIST_EPSILON) * idist;

  if (startDist < endDist) {
    side = 1;
    fraction1 = (startDist + DIST_EPSILON) * idist;
    fraction2 = (startDist - DIST_EPSILON) * idist;
  }

  if (fraction1 < 0) fraction1 = 0;
  else if (fraction1 > 1) fraction1 = 1;

  if (fraction2 < 0) fraction2 = 0;
  else if (fraction2 > 1) fraction2 = 1;

  const midFraction = startFraction + (endFraction - startFraction) * fraction1;
  const midPoint = lerpPoint(start, end, fraction1);

  recursiveHullCheck({
    model,
    nodeIndex: node.children[side],
    startFraction,
    endFraction: midFraction,
    start,
    end: midPoint,
    traceStart,
    traceEnd,
    mins,
    maxs,
    contentMask,
    trace,
    brushCheckCount,
  });

  const updatedFraction = trace.fraction;

  if (updatedFraction <= midFraction) {
    return;
  }

  const midFraction2 = startFraction + (endFraction - startFraction) * fraction2;
  const midPoint2 = lerpPoint(start, end, fraction2);

  recursiveHullCheck({
    model,
    nodeIndex: node.children[1 - side],
    startFraction: midFraction2,
    endFraction,
    start: midPoint2,
    end,
    traceStart,
    traceEnd,
    mins,
    maxs,
    contentMask,
    trace,
    brushCheckCount,
  });
}

export interface CollisionTraceParams {
  readonly model: CollisionModel;
  readonly start: Vec3;
  readonly end: Vec3;
  readonly mins?: Vec3;
  readonly maxs?: Vec3;
  readonly headnode?: number;
  readonly contentMask?: number;
}

export function traceBox(params: CollisionTraceParams): CollisionTraceResult {
  const { model, start, end } = params;
  const mins = params.mins ?? ZERO_VEC3;
  const maxs = params.maxs ?? ZERO_VEC3;
  const contentMask = params.contentMask ?? 0xffffffff;
  const headnode = params.headnode ?? 0;

  const trace = createDefaultTrace();
  const brushCheckCount = nextBrushCheckCount();

  recursiveHullCheck({
    model,
    nodeIndex: headnode,
    startFraction: 0,
    endFraction: 1,
    start,
    end,
    traceStart: start,
    traceEnd: end,
    mins,
    maxs,
    contentMask,
    trace,
    brushCheckCount,
  });

  return finalizeTrace(trace, start, end);
}

export function pointContents(point: Vec3, model: CollisionModel, headnode = 0): number {
  const leafIndex = findLeafIndex(point, model, headnode);
  return computeLeafContents(model, leafIndex, point);
}

export function pointContentsMany(points: readonly Vec3[], model: CollisionModel, headnode = 0): number[] {
  const leafCache = new Map<number, number>();

  return points.map((point) => {
    const leafIndex = findLeafIndex(point, model, headnode);
    const leaf = model.leaves[leafIndex];

    if (leaf.numLeafBrushes === 0) {
      const cached = leafCache.get(leafIndex);
      if (cached !== undefined) {
        return cached;
      }

      leafCache.set(leafIndex, leaf.contents);
      return leaf.contents;
    }

    return computeLeafContents(model, leafIndex, point);
  });
}

export function boxContents(origin: Vec3, mins: Vec3, maxs: Vec3, model: CollisionModel, headnode = 0): number {
  const brushCheckCount = nextBrushCheckCount();
  let contents = 0;

  function traverse(nodeIndex: number) {
    if (nodeIndex < 0) {
      const leafIndex = -1 - nodeIndex;
      const leaf = model.leaves[leafIndex];

      contents |= leaf.contents;

      const brushStart = leaf.firstLeafBrush;
      const brushEnd = brushStart + leaf.numLeafBrushes;

      for (let i = brushStart; i < brushEnd; i += 1) {
        const brushIndex = model.leafBrushes[i];
        const brush = model.brushes[brushIndex];

        if (brush.checkcount === brushCheckCount) continue;
        brush.checkcount = brushCheckCount;

        if (brush.sides.length === 0) continue;

        const result = testBoxInBrush(origin, mins, maxs, brush);
        if (result.startsolid) {
          contents |= result.contents;
        }
      }
      return;
    }

    const node = model.nodes[nodeIndex];
    const plane = node.plane;
    const offset = planeOffsetMagnitude(plane, mins, maxs);
    const dist = planeDistanceToPoint(plane, origin);

    if (offset === 0) {
      traverse(dist >= 0 ? node.children[0] : node.children[1]);
      return;
    }

    if (dist > offset) {
      traverse(node.children[0]);
      return;
    }

    if (dist < -offset) {
      traverse(node.children[1]);
      return;
    }

    traverse(node.children[0]);
    traverse(node.children[1]);
  }

  traverse(headnode);

  return contents;
}

export function inPVS(p1: Vec3, p2: Vec3, model: CollisionModel, headnode = 0): boolean {
  const { visibility } = model;
  if (!visibility) return true;

  const cluster1 = clusterForPoint(p1, model, headnode);
  const cluster2 = clusterForPoint(p2, model, headnode);

  return clusterVisible(visibility, cluster1, cluster2, false);
}

export function inPHS(p1: Vec3, p2: Vec3, model: CollisionModel, headnode = 0): boolean {
  const { visibility } = model;
  if (!visibility) return true;

  const cluster1 = clusterForPoint(p1, model, headnode);
  const cluster2 = clusterForPoint(p2, model, headnode);

  return clusterVisible(visibility, cluster1, cluster2, true);
}

export interface CollisionEntityLink {
  readonly id: number;
  readonly origin: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly contents: number;
  readonly surfaceFlags?: number;
}

interface CollisionEntityState extends CollisionEntityLink {
  readonly brush: CollisionBrush;
  readonly bounds: { readonly mins: Vec3; readonly maxs: Vec3 };
}

function axisAlignedPlane(normal: Vec3, dist: number, type: number): CollisionPlane {
  return { normal, dist, type, signbits: computePlaneSignBits(normal) };
}

function makeEntityBrush(link: CollisionEntityLink): CollisionBrush {
  const sx = link.surfaceFlags ?? 0;
  const xMax = link.origin.x + link.maxs.x;
  const xMin = link.origin.x + link.mins.x;
  const yMax = link.origin.y + link.maxs.y;
  const yMin = link.origin.y + link.mins.y;
  const zMax = link.origin.z + link.maxs.z;
  const zMin = link.origin.z + link.mins.z;

  const planes: CollisionPlane[] = [
    axisAlignedPlane({ x: 1, y: 0, z: 0 }, xMax, 0),
    axisAlignedPlane({ x: -1, y: 0, z: 0 }, -xMin, 0),
    axisAlignedPlane({ x: 0, y: 1, z: 0 }, yMax, 1),
    axisAlignedPlane({ x: 0, y: -1, z: 0 }, -yMin, 1),
    axisAlignedPlane({ x: 0, y: 0, z: 1 }, zMax, 2),
    axisAlignedPlane({ x: 0, y: 0, z: -1 }, -zMin, 2),
  ];

  const sides: CollisionBrushSide[] = planes.map((plane) => ({ plane, surfaceFlags: sx }));

  return { contents: link.contents, sides, checkcount: 0 };
}

function makeEntityState(link: CollisionEntityLink): CollisionEntityState {
  const brush = makeEntityBrush(link);
  return {
    ...link,
    brush,
    bounds: {
      mins: {
        x: link.origin.x + link.mins.x,
        y: link.origin.y + link.mins.y,
        z: link.origin.z + link.mins.z,
      },
      maxs: {
        x: link.origin.x + link.maxs.x,
        y: link.origin.y + link.maxs.y,
        z: link.origin.z + link.maxs.z,
      },
    },
  };
}

function boundsIntersect(a: { mins: Vec3; maxs: Vec3 }, b: { mins: Vec3; maxs: Vec3 }): boolean {
  return !(
    a.mins.x > b.maxs.x ||
    a.maxs.x < b.mins.x ||
    a.mins.y > b.maxs.y ||
    a.maxs.y < b.mins.y ||
    a.mins.z > b.maxs.z ||
    a.maxs.z < b.mins.z
  );
}

function pickBetterTrace(
  best: CollisionTraceResult,
  candidate: CollisionTraceResult,
): boolean {
  if (candidate.allsolid && !best.allsolid) return true;
  if (candidate.startsolid && !best.startsolid) return true;
  return candidate.fraction < best.fraction;
}

export interface CollisionEntityTraceParams extends CollisionTraceParams {
  readonly passId?: number;
}

export interface CollisionEntityTraceResult extends CollisionTraceResult {
  readonly entityId: number | null;
}

export class CollisionEntityIndex {
  private readonly entities = new Map<number, CollisionEntityState>();

  link(entity: CollisionEntityLink): void {
    this.entities.set(entity.id, makeEntityState(entity));
  }

  unlink(entityId: number): void {
    this.entities.delete(entityId);
  }

  trace(params: CollisionEntityTraceParams): CollisionEntityTraceResult {
    const { passId } = params;
    const mins = params.mins ?? ZERO_VEC3;
    const maxs = params.maxs ?? ZERO_VEC3;
    const contentMask = params.contentMask ?? 0xffffffff;

    let bestTrace: CollisionTraceResult;
    let bestEntity: number | null = null;

    if (params.model) {
      bestTrace = traceBox(params);
    } else {
      bestTrace = finalizeTrace(createDefaultTrace(), params.start, params.end);
    }

    for (const entity of this.entities.values()) {
      if (entity.id === passId) continue;
      if ((entity.contents & contentMask) === 0) continue;

      const trace = createDefaultTrace();
      clipBoxToBrush({ start: params.start, end: params.end, mins, maxs, brush: entity.brush, trace });

      if (trace.contents === 0) {
        trace.contents = entity.contents;
      }

      const candidate = finalizeTrace(trace, params.start, params.end);
      if (pickBetterTrace(bestTrace, candidate)) {
        bestTrace = candidate;
        bestEntity = entity.id;
      }
    }

    return { ...bestTrace, entityId: bestEntity };
  }

  gatherTriggerTouches(origin: Vec3, mins: Vec3, maxs: Vec3, mask = CONTENTS_TRIGGER): number[] {
    const results: number[] = [];
    const queryBounds = {
      mins: addVec3(origin, mins),
      maxs: addVec3(origin, maxs),
    };

    for (const entity of this.entities.values()) {
      if ((entity.contents & mask) === 0) continue;
      if (boundsIntersect(queryBounds, entity.bounds)) {
        results.push(entity.id);
      }
    }

    return results;
  }
}
