import {
  type Winding,
  type Vec3,
  createWinding,
  copyWinding,
  windingPlane,
  crossVec3,
  dotVec3,
  subtractVec3,
  copyVec3,
  distance,
  removeColinearPoints,
  splitWinding,
  windingOnPlaneSide,
  SIDE_FRONT,
  SIDE_BACK,
  SIDE_ON,
  SIDE_CROSS,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import type { CompileFace, CompileBrush } from '../types/compile.js';
import type { TreeElement, TreeNode, TreeLeaf } from './tree.js';
import { isLeaf } from './tree.js';
import type { PlaneSet } from './planes.js';

/**
 * Extracts all visible faces from the brush list by clipping them against the BSP tree.
 * Faces that end up in solid leaves are discarded.
 * Faces in empty leaves are kept.
 */
export function extractFaces(
  tree: TreeElement,
  brushes: CompileBrush[],
  planeSet: PlaneSet
): CompileFace[] {
  const faces: CompileFace[] = [];

  for (const brush of brushes) {
    for (const side of brush.sides) {
      // Skip if side has no winding or is not marked visible (e.g. bevel)
      if (!side.winding || !side.visible) continue;

      // Skip special contents like ORIGIN (usually handled earlier but good to check)
      // Actually contents are on the brush.

      // Create initial face from the brush side
      const face: CompileFace = {
        planeNum: side.planeNum,
        side: 0, // Initial side is front of its own plane
        texInfo: side.texInfo,
        winding: copyWinding(side.winding),
        contents: brush.original.contents,
        original: side,
        next: null
      };

      // Clip face into the tree
      // We start with the face on the "front" of its plane.
      // But we need to make sure we handle the side correctly.
      // Brush sides point OUTWARDS (normals point away from solid).
      // So the face is the boundary between Solid (back) and Empty (front).
      // We want to keep the part that faces Empty space.

      const fragments = clipFaceToTree(face, tree, planeSet);
      faces.push(...fragments);
    }
  }

  return faces;
}

/**
 * Clips a face against the BSP tree.
 * Returns a list of face fragments that survived (landed in empty leaves).
 */
function clipFaceToTree(
  face: CompileFace,
  node: TreeElement,
  planeSet: PlaneSet
): CompileFace[] {
  if (isLeaf(node)) {
    // If leaf is solid, the face is "inside" a solid volume, so it is hidden (culled).
    // EXCEPT if the face ITSELF is the surface of that solid volume?
    // No, standard BSP face extraction (CSG-ish):
    // We take the original brush faces. These faces define the boundary of the solid brush.
    // If a fragment of such a face ends up inside ANOTHER solid brush (represented by a solid leaf), it is hidden.
    // If it ends up in an EMPTY leaf, it is visible (surface of the brush facing empty space).

    // Note: If the leaf is the SAME brush's content...
    // The BSP tree represents the union of all brushes.
    // A solid leaf means "inside the union of solids".
    // An empty leaf means "outside".
    // A face is on the boundary.
    // If we are strictly INSIDE a solid leaf, we are hidden.

    if (node.contents & CONTENTS_SOLID) {
      return [];
    }

    // Empty leaf -> visible fragment
    return [face];
  }

  // Interior node
  const plane = planeSet.getPlanes()[node.planeNum];

  // Classify face winding against split plane
  // Note: We use a small epsilon to handle coplanar faces robustly.
  // q2tools uses generic SplitWinding which handles epsilon.

  // Optimization: If face plane is the same as node plane, we don't need to split?
  // But we need to know which side to go down.
  // If planes are identical (same normal/dist), face is ON plane.
  // If planes are opposite, face is ON plane (but flipped).

  const split = splitWinding(face.winding, plane.normal, plane.dist);
  const fragments: CompileFace[] = [];

  // Special handling for faces coplanar with the split plane
  // splitWinding returns copies for both front and back if the face is ON the plane.
  // We need to direct it to only one side based on normal alignment to avoid duplicating
  // geometry or keeping faces that should be culled/hidden behind the plane.

  const facePlane = planeSet.getPlanes()[face.planeNum];
  const dot = dotVec3(facePlane.normal, plane.normal);

  // Check if strictly on plane (split returns both)
  if (split.front && split.back && split.front.numPoints === face.winding.numPoints) {
      // It's on the plane. Use normal to decide direction.
      if (dot > 0) {
          // Face normal aligns with split plane normal -> Front
          const frontFace = { ...face, winding: split.front };
          fragments.push(...clipFaceToTree(frontFace, node.children[0], planeSet));
      } else {
          // Face normal opposes split plane normal -> Back
          const backFace = { ...face, winding: split.back };
          fragments.push(...clipFaceToTree(backFace, node.children[1], planeSet));
      }
      return fragments;
  }

  if (split.front) {
    const frontFace = { ...face, winding: split.front };
    fragments.push(...clipFaceToTree(frontFace, node.children[0], planeSet));
  }
  if (split.back) {
    const backFace = { ...face, winding: split.back };
    fragments.push(...clipFaceToTree(backFace, node.children[1], planeSet));
  }

  return fragments;
}

/**
 * Assigns extracted faces to the appropriate nodes in the BSP tree.
 * Faces are assigned to the node where they lie on the splitting plane.
 */
export function assignFacesToNodes(
  faces: CompileFace[],
  tree: TreeElement,
  planeSet: PlaneSet
): Map<TreeNode, CompileFace[]> {
  const assignment = new Map<TreeNode, CompileFace[]>();

  for (const face of faces) {
    filterFaceIntoTree(face, tree, planeSet, assignment);
  }

  return assignment;
}

function filterFaceIntoTree(
  face: CompileFace,
  node: TreeElement,
  planeSet: PlaneSet,
  assignment: Map<TreeNode, CompileFace[]>
): void {
  if (isLeaf(node)) {
    // Should not happen for visible faces ideally, as they should be caught by a node plane?
    // BUT, a face might lie on a plane that was never used as a splitter in the tree
    // (e.g. if the brush was entirely inside a leaf region formed by other splits).
    // In that case, the face is "floating" in a leaf.
    // Wait, if it's in an empty leaf, it's visible. But who renders it?
    // Standard BSP renders faces attached to nodes.
    // Does Quake 2 have leaf faces? Yes, 'leaffaces' lump.
    // So faces can be referenced by leaves.
    // However, for correct sorting, they are usually on nodes.

    // If a face reaches a leaf, it means it was never coplanar with a split plane encountered so far.
    // We can't attach it to a node.
    // We leave it unassigned here? Or attach to the leaf?
    // The function signature returns Map<TreeNode, CompileFace[]>.
    // Maybe we should just log this or handle it.

    // In q2tools, faces are partitioned down. If they are on the node plane, they stay.
    // If they go down both sides, they split.
    // If they reach a leaf... wait.
    // `MakeFaces` clips to leaves.
    // Then `FixTJunctions`, `MergeFaces`.
    // Then... `WriteBSP` -> `RecursiveWriteNode`
    // Faces are written from the node's face list.
    // Where are they added to the node?
    // Ah, `MakeFaces` calls `RecursiveMakeFaces(node, ...)`.
    // Inside `RecursiveMakeFaces`:
    //   Calculate side of face vs node plane.
    //   If SIDE_ON: Add to node->faces. Return.
    //   If SIDE_FRONT: Recurse front child.
    //   If SIDE_BACK: Recurse back child.
    //   If SIDE_CROSS: Split, recurse both.

    // So my `extractFaces` was essentially just finding *surviving fragments*.
    // But `assignFacesToNodes` needs to *place* them.

    // So `assignFacesToNodes` should walk the tree again with the *surviving* faces.
    // And if a face reaches a leaf... it means it wasn't captured by any node plane.
    // This implies the face is coplanar with a plane that wasn't used as a splitter?
    // But the BSP tree is built from brush planes.
    // If a face exists, its plane SHOULD exist in the tree path... unless that plane was skipped
    // (e.g. because it didn't split anything better than others?).
    // If a brush is in a leaf, its faces are in that leaf.
    // If we want to render it, we should attach it to the leaf?
    // But `assignFacesToNodes` returns map to TreeNode.

    // Ideally, we force every face to be on a node?
    // No, standard Quake 2 engine uses `dleafs` which index into `dleaffaces`.
    // `dnodes` also index faces?
    // Let's check `dnode_t`: `firstface`, `numfaces`.
    // Let's check `dleaf_t`: `firstleafface`, `numleaffaces`.

    // So faces can be on nodes OR leaves?
    // Actually, `RecursiveWriteNode` writes faces from `node->faces`.
    // Does it write leaf faces?
    // `WriteLeaf` writes the `leaffaces` index.

    // It seems faces are stored in a global list. Nodes and leaves just reference them.
    // BUT, for the compilation process (CSG/Merge), we usually group them by node.

    // For now, I'll follow the pattern:
    // If OnPlane, add to Node.
    // If Front/Back/Cross, recurse.
    // If Leaf, it stays there (assigned to no node).
    return;
  }

  const plane = planeSet.getPlanes()[node.planeNum];

  // Determine relationship
  // We use `windingOnPlaneSide`
  const side = windingOnPlaneSide(face.winding, plane.normal, plane.dist);

  if (side === SIDE_ON) {
    // Face is coplanar with node plane.
    // Add to assignment.
    if (!assignment.has(node)) {
      assignment.set(node, []);
    }
    assignment.get(node)!.push(face);
    return;
  }

  if (side === SIDE_FRONT) {
    filterFaceIntoTree(face, node.children[0], planeSet, assignment);
    return;
  }

  if (side === SIDE_BACK) {
    filterFaceIntoTree(face, node.children[1], planeSet, assignment);
    return;
  }

  // SIDE_CROSS
  // Split face and recurse
  const split = splitWinding(face.winding, plane.normal, plane.dist);
  if (split.front) {
    const f = { ...face, winding: split.front };
    filterFaceIntoTree(f, node.children[0], planeSet, assignment);
  }
  if (split.back) {
    const b = { ...face, winding: split.back };
    filterFaceIntoTree(b, node.children[1], planeSet, assignment);
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

    if (dot < -0.01) return false;
  }

  return true;
}
