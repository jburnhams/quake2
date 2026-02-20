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
  CONTENTS_SOLID
} from '@quake2ts/shared';
import { ON_EPSILON } from '../types/index.js';
import { type TreeElement, isLeaf } from './tree.js';
import type { PlaneSet } from './planes.js';
import type { CompileBrush, CompileFace, CompilePlane } from '../types/compile.js';

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

/**
 * Extracts visible faces from the BSP tree brushes.
 * Clips all brush faces into the tree and keeps fragments that face empty space.
 */
export function extractFaces(
  tree: TreeElement,
  planeSet: PlaneSet
): CompileFace[] {
  const faces: CompileFace[] = [];
  const planes = planeSet.getPlanes();

  // 1. Collect all unique brushes from the tree
  const brushes = new Set<CompileBrush>();
  collectBrushes(tree, brushes);

  // 2. Process each brush
  for (const brush of brushes) {
    for (const side of brush.sides) {
      if (!side.winding) continue;

      const fragments = clipFaceToTree(
        side.winding,
        side,
        brush,
        tree,
        planes
      );

      faces.push(...fragments);
    }
  }

  return faces;
}

function collectBrushes(node: TreeElement, set: Set<CompileBrush>) {
  if (isLeaf(node)) {
    for (const b of node.brushes) {
      set.add(b);
    }
  } else {
    collectBrushes(node.children[0], set);
    collectBrushes(node.children[1], set);
  }
}

function clipFaceToTree(
  w: Winding,
  side: any,
  brush: CompileBrush,
  node: TreeElement,
  planes: CompilePlane[]
): CompileFace[] {
  if (isLeaf(node)) {
    // If the leaf is not solid (empty), the face is visible
    if ((node.contents & CONTENTS_SOLID) === 0) {
      return [{
        planeNum: side.planeNum,
        texInfo: side.texInfo,
        winding: w,
        contents: brush.original.contents,
        next: null
      }];
    }
    return [];
  }

  // Node
  const plane = planes[node.planeNum];

  // Classify winding against plane first to handle coplanar correctly
  const relation = classifyWinding(w, plane);
  const faces: CompileFace[] = [];

  if (relation === 2) { // On Plane
    const sidePlane = planes[side.planeNum];
    const dot = dotVec3(sidePlane.normal, plane.normal);
    if (dot > 0) {
      faces.push(...clipFaceToTree(w, side, brush, node.children[0], planes));
    } else {
      faces.push(...clipFaceToTree(w, side, brush, node.children[1], planes));
    }
  } else if (relation === 0) { // Front
    faces.push(...clipFaceToTree(w, side, brush, node.children[0], planes));
  } else if (relation === 1) { // Back
    faces.push(...clipFaceToTree(w, side, brush, node.children[1], planes));
  } else { // Split
    const split = splitWinding(w, plane.normal, plane.dist, ON_EPSILON);
    if (split.front) {
      faces.push(...clipFaceToTree(split.front, side, brush, node.children[0], planes));
    }
    if (split.back) {
      faces.push(...clipFaceToTree(split.back, side, brush, node.children[1], planes));
    }
  }

  return faces;
}

/**
 * Assigns faces to the leaves they reside in (or border).
 * This populates the `faces` array in TreeLeaf.
 */
export function assignFacesToLeaves(
  faces: CompileFace[],
  tree: TreeElement,
  planeSet: PlaneSet
): void {
  const planes = planeSet.getPlanes();

  for (const face of faces) {
    filterFaceIntoTree(face, tree, planes);
  }
}

function filterFaceIntoTree(
  face: CompileFace,
  node: TreeElement,
  planes: CompilePlane[]
): void {
  if (isLeaf(node)) {
    if (!node.faces) node.faces = [];
    node.faces.push(face);
    return;
  }

  const plane = planes[node.planeNum];
  const relation = classifyWinding(face.winding, plane);

  if (relation === 2) { // On Plane
    const facePlane = planes[face.planeNum];
    const dot = dotVec3(facePlane.normal, plane.normal);
    if (dot > 0) {
      filterFaceIntoTree(face, node.children[0], planes);
    } else {
      filterFaceIntoTree(face, node.children[1], planes);
    }
  } else if (relation === 0) { // Front
    filterFaceIntoTree(face, node.children[0], planes);
  } else if (relation === 1) { // Back
    filterFaceIntoTree(face, node.children[1], planes);
  } else { // Split
    const split = splitWinding(face.winding, plane.normal, plane.dist, ON_EPSILON);
    if (split.front) {
      // Create new face fragment? Or just reuse face?
      // filterFaceIntoTree modifies the leaf list, adding `face`.
      // If we reuse `face`, we add the SAME object to multiple leaves.
      // This is generally okay for references, but if we wanted distinct fragments, we should clone.
      // But `splitWinding` returns new windings.
      // If we just recurse with the original face, we are adding the original face.
      // But physically only a part of it is in the leaf.
      // `extractFaces` created fragments. `assignFacesToLeaves` distributes them.
      // If a face needs splitting AGAIN (shouldn't if tree hasn't changed), we might need new objects.
      // But normally `extractFaces` already split them against the tree.
      // So they should fit in leaves (or be on planes).
      // So they shouldn't split?
      // UNLESS we merged them.
      // If we merged them, they might split.
      // If they split, we should create new faces for the leaves.
      // But `CompileFace` object identity might be important?
      // For now, let's clone the face with new winding.

      const frontFace = { ...face, winding: split.front };
      filterFaceIntoTree(frontFace, node.children[0], planes);
    }
    if (split.back) {
      const backFace = { ...face, winding: split.back };
      filterFaceIntoTree(backFace, node.children[1], planes);
    }
  }
}

function classifyWinding(w: Winding, plane: CompilePlane): number {
  let front = false;
  let back = false;
  for (const p of w.points) {
    const d = dotVec3(p, plane.normal) - plane.dist;
    if (d > ON_EPSILON) front = true;
    if (d < -ON_EPSILON) back = true;
  }
  if (front && back) return 3; // Cross
  if (front) return 0; // Front
  if (back) return 1; // Back
  return 2; // On Plane
}
