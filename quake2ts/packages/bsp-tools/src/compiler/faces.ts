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
  copyWinding,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import type { CompileFace, CompilePlane, MapBrush } from '../types/compile.js';
import { type TreeElement, type TreeNode, isLeaf } from './tree.js';
import { ON_EPSILON } from '../types/index.js';

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

/**
 * Extract renderable faces from BSP tree.
 * Traverses the tree to find all original brushes, then clips their sides
 * into the tree to find visible fragments (those landing in empty leaves).
 */
export function extractFaces(
  tree: TreeElement,
  planes: CompilePlane[]
): CompileFace[] {
  const faces: CompileFace[] = [];
  const brushes = collectBrushes(tree);

  for (const brush of brushes) {
    for (const side of brush.sides) {
      if (!side.winding || !side.visible || side.bevel) continue;

      // Clip face into tree
      clipFaceToTree(
        side.winding,
        tree,
        planes,
        side.planeNum,
        side.texInfo,
        brush.contents,
        faces
      );
    }
  }

  return faces;
}

function collectBrushes(tree: TreeElement): Set<MapBrush> {
  const brushes = new Set<MapBrush>();
  function traverse(node: TreeElement) {
    if (isLeaf(node)) {
      for (const b of node.brushes) {
        brushes.add(b.original);
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
  planes: CompilePlane[],
  planeNum: number,
  texInfo: number,
  contents: number,
  outFaces: CompileFace[]
) {
  // console.log(`Clipping face plane ${planeNum} against node ${isLeaf(node) ? 'LEAF' : 'NODE ' + node.planeNum}`);
  if (isLeaf(node)) {
    // If leaf is empty (not solid), face is visible
    // console.log(`Leaf reached. Contents: ${node.contents}. Face visible? ${(node.contents & CONTENTS_SOLID) === 0}`);
    if ((node.contents & CONTENTS_SOLID) === 0) {
      outFaces.push({
        planeNum,
        side: 0, // Will be set correctly in assignFacesToNodes or here?
                 // Usually means front side of plane.
                 // Brush sides face OUT. If brush side plane points OUT, it's side 0.
        texInfo,
        winding: copyWinding(w),
        contents,
        next: null
      });
    }
    return;
  }

  const nodePlane = planes[node.planeNum];

  // Optimization: if face plane is the same as node plane
  if (planeNum === node.planeNum) {
    // Determine which side of the face is "front".
    // For brush sides, the normal points OUT.
    // The node plane splits space.
    // If the brush side aligns with the node plane, the "front" of the face looks into the Front child.
    // The "back" of the face is inside the brush (Solid).
    // So we only need to check the Front child for visibility.
    clipFaceToTree(w, node.children[0], planes, planeNum, texInfo, contents, outFaces);
    return;
  }

  // If face plane is opposite to node plane (same geometry, flipped normal)?
  // We don't easily know this without checking normals or having opposite plane mapping.
  // But generally unique planes are used.

  const split = splitWinding(w, nodePlane.normal, nodePlane.dist, ON_EPSILON);

  if (split.front) {
    clipFaceToTree(split.front, node.children[0], planes, planeNum, texInfo, contents, outFaces);
  }
  if (split.back) {
    clipFaceToTree(split.back, node.children[1], planes, planeNum, texInfo, contents, outFaces);
  }
}

/**
 * Assign faces to nodes for front-to-back rendering.
 * Faces are assigned to the node that splits the plane the face lies on.
 */
export function assignFacesToNodes(
  faces: CompileFace[],
  tree: TreeElement,
  planes: CompilePlane[]
): Map<TreeNode, CompileFace[]> {
  const map = new Map<TreeNode, CompileFace[]>();

  function distribute(node: TreeElement, nodeFaces: CompileFace[]) {
    if (isLeaf(node)) return;

    const onFaces: CompileFace[] = [];
    const frontFaces: CompileFace[] = [];
    const backFaces: CompileFace[] = [];
    const plane = planes[node.planeNum];

    for (const f of nodeFaces) {
      if (f.planeNum === node.planeNum) {
        f.side = 0;
        onFaces.push(f);
      } else {
        // Check side
        let isFront = false;
        let isBack = false;
        for (const p of f.winding.points) {
            const val = dotVec3(p, plane.normal) - plane.dist;
            if (val > ON_EPSILON) isFront = true;
            if (val < -ON_EPSILON) isBack = true;
        }

        if (isBack && !isFront) {
            backFaces.push(f);
        } else if (isFront && !isBack) {
            frontFaces.push(f);
        } else {
             // Spanning or OnPlane.
             // If spanning, we should probably split, but faces are assumed clipped.
             // If OnPlane (ambiguous), default to front.
             // If spanning (epsilon issues), default to front.
             frontFaces.push(f);
        }
      }
    }

    if (onFaces.length > 0) {
      map.set(node, onFaces);
    }

    distribute(node.children[0], frontFaces);
    distribute(node.children[1], backFaces);
  }

  distribute(tree, faces);
  return map;
}
