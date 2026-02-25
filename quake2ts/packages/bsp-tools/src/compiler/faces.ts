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
  windingCenter,
  windingOnPlaneSide,
  SIDE_FRONT,
  SIDE_BACK,
  SIDE_ON,
  SIDE_CROSS
} from '@quake2ts/shared';
import { MASK_OPAQUE, hasAnyContents } from '@quake2ts/shared';
import type { CompileFace, CompileBrush, CompilePlane } from '../types/compile.js';
import { type TreeElement, type TreeNode, type TreeLeaf, isLeaf } from './tree.js';

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
    const dot = dotVec3(c, normal);

    // Allow small negative for epsilon errors
    if (dot < -0.01) return false;
  }

  return true;
}

/**
 * Extracts visible faces from the BSP tree by clipping brush sides against the tree.
 */
export function extractFaces(tree: TreeElement, planes: CompilePlane[]): CompileFace[] {
  const faces: CompileFace[] = [];
  const brushes = collectBrushes(tree);

  for (const brush of brushes) {
    for (const side of brush.sides) {
      if (!side.winding) continue;
      // Skip bevels? Maybe not, bevels are for collision, not rendering usually.
      if (side.bevel) continue;
      // Skip if texinfo is -1 (invisible/skip)
      // Check validation logic for skipped faces?
      // Assuming valid faces have valid winding and texinfo.

      const plane = planes[side.planeNum];
      const visibleWindings = clipFaceToTree(side.winding, tree, planes, plane.normal);

      for (const w of visibleWindings) {
        if (w.numPoints < 3) continue;
        faces.push({
          planeNum: side.planeNum,
          texInfo: side.texInfo,
          winding: w,
          contents: brush.original.contents,
          next: null,
          original: side
        });
      }
    }
  }

  return mergeCoplanarFaces(faces);
}

function collectBrushes(node: TreeElement): CompileBrush[] {
  if (isLeaf(node)) return node.brushes;
  return [...collectBrushes(node.children[0]), ...collectBrushes(node.children[1])];
}

function clipFaceToTree(
  w: Winding,
  node: TreeElement,
  planes: CompilePlane[],
  normal: Vec3
): Winding[] {
  if (isLeaf(node)) {
    // If leaf is opaque (SOLID/LAVA/SLIME), face is hidden.
    // If leaf is transparent (EMPTY/MIST/WATER), face is visible.
    // Note: WATER is transparent but has content?
    // MASK_OPAQUE = SOLID | SLIME | LAVA.
    // So WATER is !OPAQUE, so it is visible.
    // This allows seeing into water from outside, and out of water.
    if (hasAnyContents(node.contents, MASK_OPAQUE)) {
      return [];
    }
    return [w];
  }

  const plane = planes[node.planeNum];
  const side = windingOnPlaneSide(w, plane.normal, plane.dist);

  if (side === SIDE_FRONT) {
    return clipFaceToTree(w, node.children[0], planes, normal);
  }
  if (side === SIDE_BACK) {
    return clipFaceToTree(w, node.children[1], planes, normal);
  }
  if (side === SIDE_ON) {
    // Face is coplanar with split plane.
    // Send to side that matches normal direction.
    const dot = dotVec3(normal, plane.normal);
    if (dot > 0) {
      return clipFaceToTree(w, node.children[0], planes, normal);
    } else {
      return clipFaceToTree(w, node.children[1], planes, normal);
    }
  }

  // SIDE_CROSS: Split
  const split = splitWinding(w, plane.normal, plane.dist);
  let result: Winding[] = [];

  if (split.front) {
    result = result.concat(clipFaceToTree(split.front, node.children[0], planes, normal));
  }
  if (split.back) {
    result = result.concat(clipFaceToTree(split.back, node.children[1], planes, normal));
  }

  return result;
}

/**
 * Assigns faces to the tree elements (nodes/leaves) they belong to.
 * This is primarily used to populate leaf faces.
 */
export function assignFacesToNodes(
  faces: CompileFace[],
  tree: TreeElement,
  planes: CompilePlane[]
): Map<TreeElement, CompileFace[]> {
  const map = new Map<TreeElement, CompileFace[]>();

  for (const face of faces) {
    assignFaceRecursive(face, tree, planes, map);
  }

  return map;
}

function assignFaceRecursive(
  face: CompileFace,
  node: TreeElement,
  planes: CompilePlane[],
  map: Map<TreeElement, CompileFace[]>
) {
  if (isLeaf(node)) {
    if (!map.has(node)) {
      map.set(node, []);
    }
    map.get(node)!.push(face);
    return;
  }

  const plane = planes[node.planeNum];
  const side = windingOnPlaneSide(face.winding, plane.normal, plane.dist);

  if (side === SIDE_FRONT) {
    assignFaceRecursive(face, node.children[0], planes, map);
  } else if (side === SIDE_BACK) {
    assignFaceRecursive(face, node.children[1], planes, map);
  } else {
    // ON or CROSS
    // Since faces are extracted *from* the tree, they shouldn't cross planes (they were split).
    // So CROSS shouldn't happen theoretically if precision is perfect.
    // If ON, it's on the plane.
    // Standard Q2 practice: face on node plane goes down both sides?
    // No, faces are surfaces.
    // If it's ON the plane, it usually means it forms the boundary.
    // The face itself is "visible" so it must border an empty leaf.
    // We should send it down the side where it is visible?
    // But `extractFaces` already verified visibility.
    // So if it's ON the plane, it effectively belongs to the leaves touching that plane?

    // Actually, `extractFaces` split the faces. So a face passed here is a fragment that fits in a leaf.
    // So it should NOT cross.
    // If it says CROSS, it's a precision issue.
    // If it says ON, we need to decide which side.
    // But a face on the plane borders both front and back children.
    // Which leaf does it belong to?
    // It belongs to the leaf that is NOT opaque?
    // We don't check contents here.

    // Let's use the center point to guide.
    const center = windingCenter(face.winding);
    const dist = dotVec3(center, plane.normal) - plane.dist;

    if (dist > 0) assignFaceRecursive(face, node.children[0], planes, map);
    else if (dist < 0) assignFaceRecursive(face, node.children[1], planes, map);
    else {
       // Exact center on plane.
       // Use face normal to decide?
       // If face normal is same as plane normal, it faces Front.
       // So it is "part of" the Back child's boundary?
       // Or Front child's boundary?
       // A face at Z=0 facing Z+ (Up) is the floor of the upper room (Front) and ceiling of lower room (Back).
       // In Q2, faces are linked to leaves.
       // If I am in the upper room, I see the floor. So it belongs to Upper Leaf (Front)?
       // Yes.
       const faceNormal = planes[face.planeNum].normal; // Assuming face.planeNum refers to global planes
       // Be careful: face.planeNum is the plane it lies on.
       // Is it the same as node.planeNum?
       // If side is ON, yes (or opposite).

       const dot = dotVec3(faceNormal, plane.normal);
       if (dot > 0) {
          // Face aligns with plane. It faces Front.
          // It should be visible from Front.
          assignFaceRecursive(face, node.children[0], planes, map);
       } else {
          // Face opposes plane. It faces Back.
          // Visible from Back.
          assignFaceRecursive(face, node.children[1], planes, map);
       }
    }
  }
}

/**
 * Resolves T-junctions by adding vertices to face windings where they share edges with other faces.
 *
 * @param faces The list of faces to process.
 * @param epsilon The tolerance for point-on-edge checks.
 * @returns A new list of faces with T-junctions fixed.
 */
export function fixTJunctions(faces: CompileFace[], epsilon: number = 0.1): CompileFace[] {
  // Collect all unique vertices from all faces
  // Use a hash map or spatial structure? For O(N^2) naive check, a simple array is fine if N is small.
  // Actually, we iterate edges and check against other faces' vertices.

  // To avoid modifying faces while reading, we can compute new windings first.

  // 1. Collect all vertices to avoid re-extracting them constantly.
  // Actually, iterating faces is enough.

  const newFaces = faces.map(f => ({ ...f })); // Shallow copy to update windings

  for (let i = 0; i < newFaces.length; i++) {
    const face = newFaces[i];
    const w = face.winding;
    let modified = false;

    // We need to insert points into edges.
    // Since inserting points changes indices, we should collect split points for each edge first.

    // Edges are (p[j], p[j+1])
    const edgeSplits: Map<number, Vec3[]> = new Map(); // edgeIndex -> points

    for (let j = 0; j < w.numPoints; j++) {
      const p1 = w.points[j];
      const p2 = w.points[(j + 1) % w.numPoints];

      const splits: Vec3[] = [];

      // Check against all other faces
      for (let k = 0; k < newFaces.length; k++) {
        if (i === k) continue;
        const otherFace = newFaces[k];

        // Optimization: Check bounds overlap?
        // Or check if faces are adjacent (share a plane or edge)?
        // T-junctions happen when an edge of Face A contains a vertex of Face B.

        for (const v of otherFace.winding.points) {
           if (pointOnSegment(v, p1, p2, epsilon)) {
             // Avoid adding p1 or p2 themselves
             if (!pointsMatch(v, p1) && !pointsMatch(v, p2)) {
               // Check if already added
               if (!splits.some(s => pointsMatch(s, v))) {
                 splits.push(v);
               }
             }
           }
        }
      }

      if (splits.length > 0) {
        // Sort splits by distance from p1
        splits.sort((a, b) => distance(p1, a) - distance(p1, b));
        edgeSplits.set(j, splits);
        modified = true;
      }
    }

    if (modified) {
      // Rebuild winding
      const newPoints: Vec3[] = [];
      for (let j = 0; j < w.numPoints; j++) {
        newPoints.push(w.points[j]);
        if (edgeSplits.has(j)) {
          newPoints.push(...edgeSplits.get(j)!);
        }
      }

      const newW = createWinding(newPoints.length);
      newW.points = newPoints;
      face.winding = newW;
    }
  }

  return newFaces;
}

function pointOnSegment(p: Vec3, a: Vec3, b: Vec3, epsilon: number): boolean {
  // Check if p is close to line segment ab
  // 1. Check if p is collinear
  // Cross product of (p-a) and (b-a) should be 0 (len < epsilon)

  const ap = subtractVec3(p, a);
  const ab = subtractVec3(b, a);

  const c = crossVec3(ap, ab);
  const lenSq = c.x*c.x + c.y*c.y + c.z*c.z;

  // If lenSq is small, they are collinear.
  // Normalized cross product length = sin(theta).
  // len(c) = len(ap) * len(ab) * sin(theta).
  // If len(c) is small, it's close to line.

  // Using a tolerance related to segment length?
  // Or absolute tolerance?
  // Quake uses simple epsilon checks usually.

  if (lenSq > epsilon * epsilon) return false;

  // 2. Check if p is between a and b
  // dot(ap, ab) should be between 0 and dot(ab, ab)
  const dot = dotVec3(ap, ab);
  const lenAbSq = dotVec3(ab, ab);

  if (dot < -epsilon) return false;
  if (dot > lenAbSq + epsilon) return false;

  return true;
}
