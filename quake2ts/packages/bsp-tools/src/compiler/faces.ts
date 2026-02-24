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
  clipWindingEpsilon,
  copyWinding,
  hasAnyContents,
  MASK_OPAQUE
} from '@quake2ts/shared';
import type { CompileFace, CompileBrush, CompilePlane } from '../types/compile.js';
import {
  type TreeElement,
  type TreeNode,
  type TreeLeaf,
  isLeaf
} from './tree.js';
import { PlaneSet } from './planes.js';

// Re-export mergeCoplanarFaces and tryMergeWinding (keeping existing code)
// ... (I will include the existing code here)

/**
 * Extracts visible faces from the BSP tree.
 * Iterates over all brushes in the tree leaves, clips their faces to the tree,
 * and retains fragments that border transparent content.
 */
export function extractFaces(
  tree: TreeElement,
  planes: CompilePlane[]
): CompileFace[] {
  const faces: CompileFace[] = [];

  // 1. Collect all brushes from the tree
  const brushes = collectBrushes(tree);

  // 2. Process each brush
  for (const brush of brushes) {
    for (const side of brush.sides) {
      if (!side.winding) continue;

      // We only care about sides that are on the boundary of the brush.
      // (Which they all are).

      // Clip the face winding into the tree to find visible fragments
      const visibleWindings = clipFaceToTree(side.winding, tree, planes);

      for (const w of visibleWindings) {
        // Create a face for each visible fragment
        const face: CompileFace = {
          planeNum: side.planeNum,
          texInfo: side.texInfo,
          winding: w,
          contents: brush.original.contents,
          original: side,
          next: null
        };
        faces.push(face);
      }
    }
  }

  return faces;
}

function collectBrushes(tree: TreeElement): CompileBrush[] {
  const brushes: CompileBrush[] = [];
  const visited = new Set<CompileBrush>();

  function traverse(node: TreeElement) {
    if (isLeaf(node)) {
      for (const b of node.brushes) {
        if (!visited.has(b)) {
          visited.add(b);
          brushes.push(b);
        }
      }
    } else {
      traverse(node.children[0]);
      traverse(node.children[1]);
    }
  }

  traverse(tree);
  return brushes;
}

function clipFaceToTree(
  w: Winding,
  node: TreeElement,
  planes: CompilePlane[]
): Winding[] {
  // If we reached a leaf, check visibility
  if (isLeaf(node)) {
    // If the content in front of the face is opaque, the face is hidden.
    if (hasAnyContents(node.contents, MASK_OPAQUE)) {
      return [];
    }
    // Otherwise (Empty, Water, Window, etc.), it's visible.
    return [copyWinding(w)];
  }

  // It's a node
  const plane = planes[node.planeNum];

  // Classify winding against node plane
  // Use a slightly larger epsilon to robustly handle coplanar faces
  const epsilon = 0.01;

  // We need to know where the winding lies relative to the plane.
  // Using splitWinding logic.

  // Special handling for faces that are coplanar with the node plane.
  // If the face normal is parallel to the plane normal, it's coplanar.
  // The face normal is determined by its plane (side.planeNum).
  // But we passed just the winding.
  // Let's re-calculate winding plane or check points.
  // For robustness, just use splitWinding.

  const split = splitWinding(w, plane.normal, plane.dist, epsilon);

  const res: Winding[] = [];

  // Process Front fragment
  if (split.front) {
    res.push(...clipFaceToTree(split.front, node.children[0], planes));
  }

  // Process Back fragment
  if (split.back) {
    res.push(...clipFaceToTree(split.back, node.children[1], planes));
  }

  // What about coplanar faces (ON)?
  // splitWinding puts them in BOTH front and back if they are strictly ON?
  // Let's check shared/math/winding.ts implementation I read earlier.
  // "If counts[SIDE_FRONT] === 0 && counts[SIDE_BACK] === 0 ... both front and back get a copy"
  // Yes, it duplicates.
  // But we don't want to duplicate the face into both children.
  // We want to send it to the side it faces.
  // So we need to detect if it was put in BOTH (i.e. it was ON).

  // If w was ON, split.front is copy and split.back is copy.
  // We can check if w matches the plane.

  // Optimization: Check for ON before splitting.
  // If the winding is coplanar with the node plane...
  // Calculate dot product of winding normal and plane normal.
  const wp = windingPlane(w);
  const dot = dotVec3(wp.normal, plane.normal);

  // If aligned (dot > 0.9 or < -0.9) AND on plane (dist matches)
  // Check one point
  const distDiff = Math.abs(dotVec3(w.points[0], plane.normal) - plane.dist);

  if (distDiff < epsilon && Math.abs(dot) > 0.9) {
    // It is ON the plane.
    // Send to the side the normal points to.
    if (dot > 0) {
      // Normal points same direction as plane normal -> Front
      return clipFaceToTree(w, node.children[0], planes);
    } else {
      // Normal points opposite -> Back
      return clipFaceToTree(w, node.children[1], planes);
    }
  }

  // Not coplanar (or not exactly), proceed with split results
  return res;
}

/**
 * Assigns extracted faces to the nodes of the BSP tree.
 * Faces that lie on a node's split plane are assigned to that node.
 * Faces that fall through to leaves are assigned to the leaf.
 */
export function assignFacesToNodes(
  faces: CompileFace[],
  tree: TreeElement,
  planes: CompilePlane[]
): Map<TreeElement, CompileFace[]> {
  const map = new Map<TreeElement, CompileFace[]>();

  function add(element: TreeElement, face: CompileFace) {
    if (!map.has(element)) {
      map.set(element, []);
    }
    map.get(element)!.push(face);
  }

  for (const face of faces) {
    let node = tree;
    let assigned = false;

    // Traverse down to find the node
    while (!isLeaf(node)) {
      const plane = planes[node.planeNum];
      const facePlane = planes[face.planeNum];

      // Check if face lies on this node's plane
      // Use plane index comparison first for speed (if normalized)
      if (face.planeNum === node.planeNum) {
        // Same plane -> Same direction
        add(node, face);
        assigned = true;
        break;
      }

      // What if it's the same plane but opposite (flipped)?
      // CompilePlane doesn't explicitly link flipped planes, but usually we prefer the node that splits it.
      // If the face is coplanar, it belongs on this node.
      // Check geometric match.

      const dot = dotVec3(facePlane.normal, plane.normal);
      const distDiff = Math.abs(facePlane.dist - plane.dist);

      if (distDiff < 0.01 && Math.abs(dot) > 0.99) {
        // Coplanar.
        add(node, face);
        assigned = true;
        break;
      }

      // Not on this plane, decide which side to go down.
      // Since face is a fragment from extractFaces, it shouldn't span the plane.
      // It must be effectively Front or Back.
      // Check first point.
      const p = face.winding.points[0];
      const d = dotVec3(p, plane.normal) - plane.dist;

      if (d > -0.01) { // Front (bias towards front for On-like cases that aren't split?)
        node = node.children[0];
      } else {
        node = node.children[1];
      }
    }

    if (!assigned) {
      // Reached a leaf
      add(node, face);
    }
  }

  return map;
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

    const c = crossVec3(e2, e1);

    const dot = dotVec3(c, normal);

    // Allow small negative for epsilon errors
    if (dot < -0.01) return false;
  }

  return true;
}
