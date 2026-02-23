import {
  type Winding,
  type Vec3,
  createWinding,
  windingPlane,
  crossVec3,
  dotVec3,
  subtractVec3,
  copyVec3,
  distance,
  removeColinearPoints,
  splitWinding,
  windingOnPlaneSide,
  SIDE_ON,
  SIDE_FRONT,
  SIDE_BACK,
  SIDE_CROSS,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import type { CompileBrush, CompileFace, CompilePlane } from '../types/compile.js';
import { isLeaf, type TreeElement, type TreeNode } from './tree.js';
import type { PlaneSet } from './planes.js';

// If CONTENTS_SOLID is not exported from '../types/index.js', we might need to fix import.
// For now, I'll assume it is available or I should import from shared/bsp/contents if possible.
// But usually bsp-tools/src/types/index.ts re-exports everything relevant.
// Let's rely on that.

/**
 * Extract renderable faces from BSP tree by clipping brush sides.
 */
export function extractFaces(
  brushes: CompileBrush[],
  tree: TreeElement,
  planeSet: PlaneSet
): CompileFace[] {
  const faces: CompileFace[] = [];

  for (const brush of brushes) {
    for (const side of brush.sides) {
      // Only extract structural, visible faces (not bevels)
      if (!side.winding || side.bevel) continue;

      // Also check if side was already marked invisible/merged?
      // q2tools checks side->winding and side->visible.
      // We assume side.visible is true if winding exists unless explicitly disabled.
      // But side structure has 'visible' boolean.
      if (!side.visible && side.visible !== undefined) continue;

      const fragments = clipWindingToTree(side.winding, tree, planeSet, side.planeNum);

      for (const w of fragments) {
        faces.push({
          planeNum: side.planeNum,
          side: 0, // Default front? Or depends on plane usage? q2tools uses side=0 usually for front.
          texInfo: side.texInfo,
          winding: w,
          contents: brush.original.contents,
          original: side,
          next: null,
          merged: false
        });
      }
    }
  }

  return faces;
}

function clipWindingToTree(
  w: Winding,
  node: TreeElement,
  planeSet: PlaneSet,
  brushPlaneNum: number
): Winding[] {
  if (isLeaf(node)) {
    // If leaf is solid, the face is hidden inside solid volume.
    // If leaf is empty (or water/mist etc), the face is visible boundary.
    // We assume CONTENTS_SOLID means opaque solid.
    if (node.contents === CONTENTS_SOLID) {
      return [];
    }
    return [w];
  }

  // Interior node
  const plane = planeSet.getPlanes()[node.planeNum];

  // Split winding by node plane
  // Note: We use geometric split.
  // Optimization: check if brushPlaneNum is same as node.planeNum?
  // But strict geometry is safer to handle all cases including coplanar.

  const split = splitWinding(w, plane.normal, plane.dist);

  let fragments: Winding[] = [];

  if (split.front) {
    fragments = fragments.concat(clipWindingToTree(split.front, node.children[0], planeSet, brushPlaneNum));
  }
  if (split.back) {
    fragments = fragments.concat(clipWindingToTree(split.back, node.children[1], planeSet, brushPlaneNum));
  }

  return fragments;
}

/**
 * Assign extracted faces to nodes in the BSP tree for rendering.
 */
export function assignFacesToNodes(
  faces: CompileFace[],
  tree: TreeElement,
  planeSet: PlaneSet
): Map<TreeNode, CompileFace[]> {
  const map = new Map<TreeNode, CompileFace[]>();

  for (const face of faces) {
    assignFace(face, tree, planeSet, map);
  }
  return map;
}

function assignFace(
  face: CompileFace,
  node: TreeElement,
  planeSet: PlaneSet,
  map: Map<TreeNode, CompileFace[]>
) {
  if (isLeaf(node)) {
    // Face reached leaf? This implies it wasn't captured by any node plane.
    // This can happen for faces that are coplanar with a leaf boundary but not on a split plane?
    // Or due to precision errors.
    // In Quake BSP, renderable faces are attached to nodes.
    // We discard faces that fall into leaves (they are likely detail or redundant).
    return;
  }

  const plane = planeSet.getPlanes()[node.planeNum];

  // Classify winding against node plane
  const relation = windingOnPlaneSide(face.winding, plane.normal, plane.dist);

  if (relation === SIDE_ON) {
    // Face is on this node's plane. Assign it here.
    let list = map.get(node);
    if (!list) {
      list = [];
      map.set(node, list);
    }
    list.push(face);

    // Determine 'side' flag (0 = same dir as plane, 1 = opposite)
    // We check normal dot product.
    const facePlane = windingPlane(face.winding);
    const dot = dotVec3(facePlane.normal, plane.normal);
    face.side = dot < 0 ? 1 : 0;

    return;
  }

  if (relation === SIDE_FRONT) {
    assignFace(face, node.children[0], planeSet, map);
  } else if (relation === SIDE_BACK) {
    assignFace(face, node.children[1], planeSet, map);
  } else {
    // SIDE_CROSS: Face spans plane.
    // This shouldn't happen ideally if extractFaces worked perfectly with same planes.
    // But if it does, split it again to ensure proper assignment.
    const split = splitWinding(face.winding, plane.normal, plane.dist);
    if (split.front) {
      const f = { ...face, winding: split.front };
      assignFace(f, node.children[0], planeSet, map);
    }
    if (split.back) {
      const f = { ...face, winding: split.back };
      assignFace(f, node.children[1], planeSet, map);
    }
  }
}

/**
 * Merges adjacent coplanar faces with same texture and contents.
 *
 * @param faces The list of faces to merge.
 * @returns A new list of merged faces.
 */
export function mergeCoplanarFaces(faces: CompileFace[]): CompileFace[] {
  if (faces.length < 2) return faces;

  // Group faces by properties (plane, texture, contents)
  // Key: planeNum_texInfo_contents
  const groups = new Map<string, CompileFace[]>();

  for (const face of faces) {
    const key = `${face.planeNum}_${face.texInfo}_${face.contents}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(face);
  }

  const mergedFaces: CompileFace[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      mergedFaces.push(group[0]);
      continue;
    }

    // Iteratively try to merge faces in this group
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < group.length; i++) {
        if (group[i].merged) continue;

        for (let j = i + 1; j < group.length; j++) {
          if (group[j].merged) continue;

          const f1 = group[i];
          const f2 = group[j];

          const plane = windingPlane(f1.winding);

          const newWinding = tryMergeWinding(f1.winding, f2.winding, plane.normal);

          if (newWinding) {
            // Success! Replace f1 with new face, mark f2 as merged
            group[i] = {
              ...f1,
              winding: newWinding,
              merged: false
            };
            group[j].merged = true;
            changed = true;
            break;
          }
        }
        if (changed) break;
      }

      if (changed) {
        // Remove merged faces from active set
        const active: CompileFace[] = [];
        for (const f of group) {
            if (!f.merged) active.push(f);
        }
        group.length = 0;
        for (const f of active) group.push(f);
      }
    }

    for (const face of group) {
      if (!face.merged) {
        mergedFaces.push(face);
      }
    }
  }

  return mergedFaces;
}

/**
 * Tries to merge two windings.
 * Returns the merged winding if they share an edge and the result is convex.
 * Returns null otherwise.
 */
export function tryMergeWinding(
  w1: Winding,
  w2: Winding,
  normal: Vec3
): Winding | null {
  let start1 = -1; // Index of start of shared edge in w1 (p1)
  let start2 = -1; // Index of start of shared edge in w2 (p2)

  // Find shared edge (p1->p2 in w1 matches p2->p1 in w2)
  for (let i = 0; i < w1.numPoints; i++) {
    const p1 = w1.points[i];
    const p2 = w1.points[(i + 1) % w1.numPoints];

    for (let j = 0; j < w2.numPoints; j++) {
      const p3 = w2.points[j];
      const p4 = w2.points[(j + 1) % w2.numPoints];

      // Check if edge (p1, p2) == (p4, p3) (reversed)
      if (pointsMatch(p1, p4) && pointsMatch(p2, p3)) {
        start1 = i;
        start2 = j;
        break;
      }
    }
    if (start1 !== -1) break;
  }

  if (start1 === -1) {
    return null; // No shared edge
  }

  // Construct new point list
  const newPoints: Vec3[] = [];

  // 1. Add points from w1, starting AFTER the shared edge (p2), going around to p1
  // Indices: (start1 + 1) ... start1
  const p2_idx = (start1 + 1) % w1.numPoints;
  for (let k = 0; k < w1.numPoints; k++) {
    newPoints.push(copyVec3(w1.points[(p2_idx + k) % w1.numPoints]));
  }
  // List starts with p2 (B), ends with p1 (A).

  // 2. Add points from w2, EXCLUDING the shared edge points (p1 and p2)
  // Shared edge in w2 is p2(start2) -> p1(start2+1).
  // We want points starting AFTER p1, going around to BEFORE p2.
  // Indices: (start2 + 2) ... (start2 - 1)
  const w2_start_idx = (start2 + 2) % w2.numPoints;
  const w2_count = w2.numPoints - 2;

  for (let k = 0; k < w2_count; k++) {
    newPoints.push(copyVec3(w2.points[(w2_start_idx + k) % w2.numPoints]));
  }

  // Check convexity before creating winding
  // Use a temporary winding or just check points
  // Wait, isConvex expects points, but removeColinearPoints expects winding.
  // We should simplify first? No, simplify removes collinear points which helps convexity check (avoids false concavity on straight lines).
  // But standard convexity check handles collinear (dot product ~0).

  // Create temporary winding
  const tempW = createWinding(newPoints.length);
  tempW.points = newPoints;

  // Simplify
  const simplifiedW = removeColinearPoints(tempW);

  if (!isConvex(simplifiedW.points, normal)) {
    return null;
  }

  return simplifiedW;
}

function pointsMatch(p1: Vec3, p2: Vec3): boolean {
  return distance(p1, p2) < 0.01;
}

function isConvex(points: Vec3[], normal: Vec3): boolean {
  if (points.length < 3) return false;

  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const p2 = points[(i + 2) % points.length];

    const e1 = subtractVec3(p1, p0);
    const e2 = subtractVec3(p2, p1);

    const c = crossVec3(e2, e1); // Quake CW: e2 x e1 points IN (opposite to normal) ?

    // In Quake coordinates (Z up):
    // Standard winding is CW?
    // Let's rely on standard: if dot product with normal is negative, it's a reflex angle (concave).
    // Actually, strictly speaking for CW winding, (p1-p0)x(p2-p0) aligns with normal?
    // Shared windingPlane uses (p2-p0) x (p1-p0).
    // So (p2-p1) x (p1-p0) -> e2 x e1.
    // This should align with normal.
    // So dot > 0 is convex.

    const dot = dotVec3(c, normal);

    // Allow small negative for epsilon errors
    if (dot < -0.01) return false;
  }

  return true;
}
