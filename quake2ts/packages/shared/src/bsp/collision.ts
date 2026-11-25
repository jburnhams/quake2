import { CONTENTS_TRIGGER } from './contents.js';
import type { Vec3 } from '../math/vec3.js';
import { ZERO_VEC3, addVec3, scaleVec3, subtractVec3 } from '../math/vec3.js';
import { createSpatialTree, linkEntityToSpatialTree, querySpatialTree, SpatialNode } from './spatial.js';

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

export interface TraceDebugInfo {
  nodesTraversed: number;
  leafsReached: number;
  brushesTested: number;
}

export let traceDebugInfo: TraceDebugInfo | null = null;

export function enableTraceDebug(): void {
  traceDebugInfo = { nodesTraversed: 0, leafsReached: 0, brushesTested: 0 };
  // console.log('DEBUG: Trace debug enabled');
}

export function disableTraceDebug(): void {
  traceDebugInfo = null;
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

/**
 * Clips a movement box against a brush using the Liang-Barsky algorithm.
 *
 * This function determines if and where the swept box (from start to end) intersects the brush.
 * It works by clipping the movement line segment against the infinite planes defined by the brush sides.
 *
 * Algorithm Overview (Liang-Barsky):
 * The movement is treated as a parameterized line P(t) = Start + t * (End - Start), for t in [0, 1].
 * We maintain an interval [enterfrac, leavefrac] (initially [-1, 1]) representing the portion of the
 * line that is potentially inside the brush.
 * For each plane:
 * 1. We determine the distance of Start (d1) and End (d2) from the plane.
 *    - For box traces, planes are expanded by the box extents, effectively treating the box as a point.
 * 2. If both points are in front (outside), the line is outside the brush.
 * 3. If the line crosses the plane:
 *    - If entering (d1 > d2), we update `enterfrac` (max of entry times).
 *    - If leaving (d1 < d2), we update `leavefrac` (min of exit times).
 * 4. If at any point enterfrac > leavefrac, the line misses the brush.
 *
 * @see CM_ClipBoxToBrush in qcommon/cm_trace.c:145-220
 *
 * @param params ClipBoxParams containing start/end vectors, box mins/maxs, target brush, and trace result to update.
 */
export function clipBoxToBrush({ start, end, mins, maxs, brush, trace }: ClipBoxParams): void {
  if (brush.sides.length === 0) return;

  const isPoint = mins.x === 0 && mins.y === 0 && mins.z === 0 && maxs.x === 0 && maxs.y === 0 && maxs.z === 0;

  // enterfrac: The fraction of movement where the box FIRST fully enters the brush volume (intersection start).
  // leavefrac: The fraction of movement where the box STARTS to leave the brush volume (intersection end).
  // Initialized to -1 and 1 to cover the full potential range + buffers.
  let enterfrac = -1;
  let leavefrac = 1;
  let clipplane: CollisionPlane | null = null;
  let leadside: CollisionBrushSide | null = null;

  let getout = false; // True if the end point is outside at least one plane (not trapped in brush)
  let startout = false; // True if the start point is outside at least one plane (not starting stuck)

  for (const side of brush.sides) {
    const { plane } = side;
    let dist = plane.dist;

    // Expand the plane by the box extents to perform a point-plane test.
    // This reduces the AABB sweep vs convex brush problem to a line segment vs expanded planes problem.
    if (!isPoint) {
      const ofsX = plane.normal.x < 0 ? maxs.x : mins.x;
      const ofsY = plane.normal.y < 0 ? maxs.y : mins.y;
      const ofsZ = plane.normal.z < 0 ? maxs.z : mins.z;
      dist -= plane.normal.x * ofsX + plane.normal.y * ofsY + plane.normal.z * ofsZ;
    }

    // d1: Distance of start point from the (expanded) plane. Positive = in front (outside).
    // d2: Distance of end point from the (expanded) plane.
    const d1 = start.x * plane.normal.x + start.y * plane.normal.y + start.z * plane.normal.z - dist;
    const d2 = end.x * plane.normal.x + end.y * plane.normal.y + end.z * plane.normal.z - dist;

    if (d2 > 0) getout = true;
    if (d1 > 0) startout = true;

    // Case 1: Entirely outside this plane.
    // Since brushes are convex intersections of half-spaces (defined by planes pointing OUT),
    // being in front of ANY plane means being outside the brush.
    // The d2 >= d1 check handles the case where the line is parallel or moving away from the plane.
    if (d1 > 0 && d2 >= d1) {
      return;
    }

    // Case 2: Entirely inside this plane (back side).
    // Does not restrict the entry/exit interval further than other planes might.
    if (d1 <= 0 && d2 <= 0) {
      continue;
    }

    // Case 3: Line intersects the plane.
    // d1 > d2 means we are moving from Front (outside) to Back (inside) -> Entering.
    if (d1 > d2) {
      // Calculate intersection fraction f.
      // DIST_EPSILON is subtracted to ensure we stop slightly *before* the plane,
      // preventing the object from getting stuck in the next frame due to float precision.
      const f = (d1 - DIST_EPSILON) / (d1 - d2);
      if (f > enterfrac) {
        enterfrac = f;
        clipplane = plane;
        leadside = side;
      }
    } else {
      // Moving from Back (inside) to Front (outside) -> Leaving.
      // DIST_EPSILON is added to push the exit point slightly further out (or in depending on perspective),
      // effectively narrowing the "inside" interval.
      const f = (d1 + DIST_EPSILON) / (d1 - d2);
      if (f < leavefrac) leavefrac = f;
    }
  }

  // If we never started outside any plane, we started inside the brush.
  if (!startout) {
    trace.startsolid = true;
    // If we also never got out of any plane (meaning we stayed behind all planes),
    // then the entire movement is inside the brush (allsolid).
    if (!getout) {
      trace.allsolid = true;
    }
    // cmodel.c leaves the fraction alone here; only CM_TestBoxInBrush zeroes it.
    return;
  }

  // If the entry fraction is less than the exit fraction, we have a valid intersection interval.
  if (enterfrac < leavefrac && enterfrac > -1 && enterfrac < trace.fraction) {
    if (enterfrac < 0) enterfrac = 0;
    trace.fraction = enterfrac;
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

function lerpPoint(start: Vec3, end: Vec3, t: number): Vec3 {
  return addVec3(start, scaleVec3(subtractVec3(end, start), t));
}

function finalizeTrace(trace: TraceResult, start: Vec3, end: Vec3): CollisionTraceResult {
  // CM_BoxTrace: endpos is the end point when nothing was hit, else start + fraction * (end - start).
  // The fraction is not clamped for allsolid; callers check allsolid/startsolid themselves.
  const endpos = trace.fraction === 1 ? { x: end.x, y: end.y, z: end.z } : lerpPoint(start, end, trace.fraction);

  return {
    fraction: trace.fraction,
    endpos,
    plane: trace.plane,
    planeNormal: trace.plane?.normal,
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

interface HullTraceState {
  readonly model: CollisionModel;
  readonly traceStart: Vec3;
  readonly traceEnd: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly contentMask: number;
  readonly trace: TraceResult;
  readonly brushCheckCount: number;
  readonly isPoint: boolean;
  /** Per-axis half-size of the box, the larger of -mins and maxs (trace_extents in cmodel.c). */
  readonly extents: Vec3;
}

/** CM_TraceToLeaf: clips the swept box against every brush in one leaf. */
function traceToLeaf(state: HullTraceState, leafIndex: number): void {
  const { model, trace, contentMask, brushCheckCount } = state;
  const leaf = model.leaves[leafIndex];
  // cmodel.c also skips the leaf when (leaf.contents & mask) is 0. On compiled maps that never
  // changes the answer (checked by the oracle on demo1), and hand-built test models leave leaf
  // contents at 0, so the check is left out here and in testInLeaf.

  const end = leaf.firstLeafBrush + leaf.numLeafBrushes;
  for (let i = leaf.firstLeafBrush; i < end; i += 1) {
    const brush = model.brushes[model.leafBrushes[i]];
    if (brush.checkcount === brushCheckCount) continue; // already checked in another leaf
    brush.checkcount = brushCheckCount;
    if ((brush.contents & contentMask) === 0) continue;

    if (traceDebugInfo) traceDebugInfo.brushesTested++;
    clipBoxToBrush({ start: state.traceStart, end: state.traceEnd, mins: state.mins, maxs: state.maxs, brush, trace });
    if (trace.fraction === 0) return;
  }
}

/** CM_TestInLeaf: position test of the box against every brush in one leaf. */
function testInLeaf(state: HullTraceState, leafIndex: number): void {
  const { model, trace, contentMask, brushCheckCount } = state;
  const leaf = model.leaves[leafIndex];

  const end = leaf.firstLeafBrush + leaf.numLeafBrushes;
  for (let i = leaf.firstLeafBrush; i < end; i += 1) {
    const brush = model.brushes[model.leafBrushes[i]];
    if (brush.checkcount === brushCheckCount) continue;
    brush.checkcount = brushCheckCount;
    if ((brush.contents & contentMask) === 0) continue;
    if (brush.sides.length === 0) continue;

    const result = testBoxInBrush(state.traceStart, state.mins, state.maxs, brush);
    if (result.startsolid) {
      trace.startsolid = true;
      trace.allsolid = true;
      trace.fraction = 0;
      trace.contents = brush.contents;
      return;
    }
  }
}

/**
 * BOX_ON_PLANE_SIDE from q_shared.h: 1 = in front, 2 = behind, 3 = crossing.
 * Kept separate from boxOnPlaneSide because cmodel.c's comparisons are strict in one direction.
 */
function boxOnPlaneSideC(mins: Vec3, maxs: Vec3, plane: CollisionPlane): number {
  if (plane.type < 3) {
    const lo = plane.type === 0 ? mins.x : plane.type === 1 ? mins.y : mins.z;
    const hi = plane.type === 0 ? maxs.x : plane.type === 1 ? maxs.y : maxs.z;
    if (plane.dist <= lo) return 1;
    if (plane.dist >= hi) return 2;
    return 3;
  }
  const n = plane.normal;
  const dist1 = n.x * (n.x < 0 ? mins.x : maxs.x) + n.y * (n.y < 0 ? mins.y : maxs.y) + n.z * (n.z < 0 ? mins.z : maxs.z);
  const dist2 = n.x * (n.x < 0 ? maxs.x : mins.x) + n.y * (n.y < 0 ? maxs.y : mins.y) + n.z * (n.z < 0 ? maxs.z : mins.z);
  let sides = 0;
  if (dist1 >= plane.dist) sides = 1;
  if (dist2 < plane.dist) sides |= 2;
  return sides;
}

/** CM_BoxLeafnums_headnode: every leaf the box touches, below headnode. */
export function boxLeafnums(model: CollisionModel, mins: Vec3, maxs: Vec3, headnode = 0, maxCount = 1024): number[] {
  const leaves: number[] = [];
  const walk = (nodeIndex: number): void => {
    let num = nodeIndex;
    for (;;) {
      if (num < 0) {
        if (leaves.length < maxCount) leaves.push(-1 - num);
        return;
      }
      const node = model.nodes[num];
      const side = boxOnPlaneSideC(mins, maxs, node.plane);
      if (side === 1) num = node.children[0];
      else if (side === 2) num = node.children[1];
      else {
        walk(node.children[0]);
        num = node.children[1];
      }
    }
  };
  walk(headnode);
  return leaves;
}

/**
 * CM_RecursiveHullCheck from full/qcommon/cmodel.c, line for line: walks the segment
 * p1..p2 (fractions p1f..p2f of the whole move) down the BSP and clips against the
 * brushes in every leaf it reaches.
 */
function recursiveHullCheck(state: HullTraceState, num: number, p1f: number, p2f: number, p1: Vec3, p2: Vec3): void {
  const { trace } = state;
  if (trace.fraction <= p1f) return; // already hit something nearer

  if (num < 0) {
    if (traceDebugInfo) traceDebugInfo.leafsReached++;
    traceToLeaf(state, -1 - num);
    return;
  }
  if (traceDebugInfo) traceDebugInfo.nodesTraversed++;

  const plane = state.model.nodes[num].plane;
  const children = state.model.nodes[num].children;
  let t1: number;
  let t2: number;
  let offset: number;

  if (plane.type < 3) {
    const axis = plane.type === 0 ? 'x' : plane.type === 1 ? 'y' : 'z';
    t1 = p1[axis] - plane.dist;
    t2 = p2[axis] - plane.dist;
    offset = state.extents[axis];
  } else {
    t1 = plane.normal.x * p1.x + plane.normal.y * p1.y + plane.normal.z * p1.z - plane.dist;
    t2 = plane.normal.x * p2.x + plane.normal.y * p2.y + plane.normal.z * p2.z - plane.dist;
    offset = state.isPoint
      ? 0
      : Math.abs(state.extents.x * plane.normal.x) +
        Math.abs(state.extents.y * plane.normal.y) +
        Math.abs(state.extents.z * plane.normal.z);
  }

  // see which sides we need to consider
  if (t1 >= offset && t2 >= offset) {
    recursiveHullCheck(state, children[0], p1f, p2f, p1, p2);
    return;
  }
  if (t1 < -offset && t2 < -offset) {
    recursiveHullCheck(state, children[1], p1f, p2f, p1, p2);
    return;
  }

  // put the crosspoint DIST_EPSILON pixels on the near side
  let side: 0 | 1;
  let frac: number;
  let frac2: number;
  if (t1 < t2) {
    const idist = 1 / (t1 - t2);
    side = 1;
    frac2 = (t1 + offset + DIST_EPSILON) * idist;
    frac = (t1 - offset + DIST_EPSILON) * idist;
  } else if (t1 > t2) {
    const idist = 1 / (t1 - t2);
    side = 0;
    frac2 = (t1 - offset - DIST_EPSILON) * idist;
    frac = (t1 + offset + DIST_EPSILON) * idist;
  } else {
    side = 0;
    frac = 1;
    frac2 = 0;
  }

  // move up to the node
  if (frac < 0) frac = 0;
  if (frac > 1) frac = 1;
  let midf = p1f + (p2f - p1f) * frac;
  let mid = lerpPoint(p1, p2, frac);
  recursiveHullCheck(state, children[side], p1f, midf, p1, mid);

  // go past the node
  if (frac2 < 0) frac2 = 0;
  if (frac2 > 1) frac2 = 1;
  midf = p1f + (p2f - p1f) * frac2;
  mid = lerpPoint(p1, p2, frac2);
  recursiveHullCheck(state, children[side ^ 1], midf, p2f, mid, p2);
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

/** CM_BoxTrace: sweeps a box from start to end through the BSP below headnode. */
export function traceBox(params: CollisionTraceParams): CollisionTraceResult {
  const { model, start, end } = params;
  const mins = params.mins ?? ZERO_VEC3;
  const maxs = params.maxs ?? ZERO_VEC3;
  const contentMask = params.contentMask ?? 0xffffffff;
  const headnode = params.headnode ?? 0;

  const trace = createDefaultTrace();
  if (model.leaves.length === 0) return finalizeTrace(trace, start, end); // map not loaded

  const isPoint = isPointBounds(mins, maxs);
  const state: HullTraceState = {
    model,
    traceStart: start,
    traceEnd: end,
    mins,
    maxs,
    contentMask,
    trace,
    brushCheckCount: nextBrushCheckCount(),
    isPoint,
    extents: isPoint
      ? ZERO_VEC3
      : {
          x: -mins.x > maxs.x ? -mins.x : maxs.x,
          y: -mins.y > maxs.y ? -mins.y : maxs.y,
          z: -mins.z > maxs.z ? -mins.z : maxs.z,
        },
  };

  // position test special case
  if (start.x === end.x && start.y === end.y && start.z === end.z) {
    const c1 = { x: start.x + mins.x - 1, y: start.y + mins.y - 1, z: start.z + mins.z - 1 };
    const c2 = { x: start.x + maxs.x + 1, y: start.y + maxs.y + 1, z: start.z + maxs.z + 1 };
    for (const leaf of boxLeafnums(model, c1, c2, headnode)) {
      testInLeaf(state, leaf);
      if (trace.allsolid) break;
    }
    return { ...finalizeTrace(trace, start, end), endpos: { x: start.x, y: start.y, z: start.z } };
  }

  recursiveHullCheck(state, headnode, 0, 1, start, end);
  return finalizeTrace(trace, start, end);
}

/** CM_PointContents: the contents of the leaf the point is in (brush contents are already folded into leaves by the compiler). */
export function pointContents(point: Vec3, model: CollisionModel, headnode = 0): number {
  if (model.leaves.length === 0) return 0;
  return model.leaves[findLeafIndex(point, model, headnode)].contents;
}

export function pointContentsMany(points: readonly Vec3[], model: CollisionModel, headnode = 0): number[] {
  return points.map((point) => pointContents(point, model, headnode));
}

export function boxContents(origin: Vec3, mins: Vec3, maxs: Vec3, model: CollisionModel, headnode = 0): number {
  const brushCheckCount = nextBrushCheckCount();
  let contents = 0;

  function traverse(nodeIndex: number) {
    if (nodeIndex < 0) {
    if (traceDebugInfo) {
      traceDebugInfo.leafsReached++;
    }
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
    // Symmetric box extents, as cmodel.c uses for its hull checks.
    const offset =
      Math.abs(Math.max(-mins.x, maxs.x) * plane.normal.x) +
      Math.abs(Math.max(-mins.y, maxs.y) * plane.normal.y) +
      Math.abs(Math.max(-mins.z, maxs.z) * plane.normal.z);
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
  private readonly entityNodes = new Map<number, SpatialNode>();
  private readonly rootNode = createSpatialTree();

  link(entity: CollisionEntityLink): void {
    const state = makeEntityState(entity);
    this.entities.set(entity.id, state);

    // Update spatial index
    const existingNode = this.entityNodes.get(entity.id);
    if (existingNode) {
      existingNode.items.delete(entity.id);
    }

    const newNode = linkEntityToSpatialTree(
      this.rootNode,
      entity.id,
      state.bounds.mins,
      state.bounds.maxs
    );
    this.entityNodes.set(entity.id, newNode);
  }

  unlink(entityId: number): void {
    this.entities.delete(entityId);

    const node = this.entityNodes.get(entityId);
    if (node) {
      node.items.delete(entityId);
      this.entityNodes.delete(entityId);
    }
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

    // Determine query bounds for spatial lookup
    const traceAbsMin = {
      x: Math.min(params.start.x, params.end.x) + mins.x,
      y: Math.min(params.start.y, params.end.y) + mins.y,
      z: Math.min(params.start.z, params.end.z) + mins.z,
    };
    const traceAbsMax = {
      x: Math.max(params.start.x, params.end.x) + maxs.x,
      y: Math.max(params.start.y, params.end.y) + maxs.y,
      z: Math.max(params.start.z, params.end.z) + maxs.z,
    };

    const candidates = new Set<number>();
    querySpatialTree(this.rootNode, traceAbsMin, traceAbsMax, candidates);

    for (const entityId of candidates) {
      if (entityId === passId) continue;

      const entity = this.entities.get(entityId);
      if (!entity) continue;
      if ((entity.contents & contentMask) === 0) continue;

      const trace = createDefaultTrace();
      clipBoxToBrush({ start: params.start, end: params.end, mins, maxs, brush: entity.brush, trace });

      if (trace.contents === 0) {
        trace.contents = entity.contents;
      }

      if (trace.startsolid || trace.allsolid || trace.fraction < bestTrace.fraction) {
         const candidate = finalizeTrace(trace, params.start, params.end);
         if (pickBetterTrace(bestTrace, candidate)) {
           bestTrace = candidate;
           bestEntity = entity.id;
         }
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

    const candidates = new Set<number>();
    querySpatialTree(this.rootNode, queryBounds.mins, queryBounds.maxs, candidates);

    for (const entityId of candidates) {
      const entity = this.entities.get(entityId);
      if (!entity) continue;

      if ((entity.contents & mask) === 0) continue;
      if (boundsIntersect(queryBounds, entity.bounds)) {
        results.push(entity.id);
      }
    }

    return results;
  }
}
