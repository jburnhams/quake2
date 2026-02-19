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
  copyWinding
} from '@quake2ts/shared';
import type { CompileFace, CompilePlane } from '../types/compile.js';
import type { TreeElement, TreeNode, TreeLeaf } from './tree.js';
import { isLeaf } from './tree.js';

/**
 * Merges adjacent coplanar faces with same texture and contents.
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

export function tryMergeWinding(
  w1: Winding,
  w2: Winding,
  normal: Vec3
): Winding | null {
  let start1 = -1;
  let start2 = -1;

  for (let i = 0; i < w1.numPoints; i++) {
    const p1 = w1.points[i];
    const p2 = w1.points[(i + 1) % w1.numPoints];

    for (let j = 0; j < w2.numPoints; j++) {
      const p3 = w2.points[j];
      const p4 = w2.points[(j + 1) % w2.numPoints];

      if (pointsMatch(p1, p4) && pointsMatch(p2, p3)) {
        start1 = i;
        start2 = j;
        break;
      }
    }
    if (start1 !== -1) break;
  }

  if (start1 === -1) {
    return null;
  }

  const newPoints: Vec3[] = [];
  const p2_idx = (start1 + 1) % w1.numPoints;
  for (let k = 0; k < w1.numPoints; k++) {
    newPoints.push(copyVec3(w1.points[(p2_idx + k) % w1.numPoints]));
  }
  const w2_start_idx = (start2 + 2) % w2.numPoints;
  const w2_count = w2.numPoints - 2;

  for (let k = 0; k < w2_count; k++) {
    newPoints.push(copyVec3(w2.points[(w2_start_idx + k) % w2.numPoints]));
  }

  const tempW = createWinding(newPoints.length);
  tempW.points = newPoints;
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

/**
 * Extract visible faces from the BSP tree.
 */
export function extractFaces(
  tree: TreeElement,
  planes: CompilePlane[]
): CompileFace[] {
  const faces: CompileFace[] = [];
  const allBrushes = new Set<any>();
  collectBrushes(tree, allBrushes);

  for (const brush of allBrushes) {
    for (const side of brush.sides) {
      if (!side.winding || !side.visible) continue;
      if (side.bevel) continue;

      clipSideIntoTree(side.winding, side, tree, planes, faces);
    }
  }

  return faces;
}

function collectBrushes(node: TreeElement, set: Set<any>) {
  if (isLeaf(node)) {
    for (const b of node.brushes) set.add(b);
  } else {
    collectBrushes(node.children[0], set);
    collectBrushes(node.children[1], set);
  }
}

function clipSideIntoTree(
  w: Winding,
  side: any,
  node: TreeElement,
  planes: CompilePlane[],
  outFaces: CompileFace[]
) {
  if (isLeaf(node)) {
    if (node.contents === 0) { // Empty leaf
         const face: CompileFace = {
           planeNum: side.planeNum,
           side: 0,
           texInfo: side.texInfo,
           winding: copyWinding(w),
           contents: side.contents ?? 0,
           next: null
         };
         outFaces.push(face);
    }
    return;
  }

  const plane = planes[node.planeNum];
  const split = splitWinding(w, plane.normal, plane.dist);

  if (split.front) {
    clipSideIntoTree(split.front, side, node.children[0], planes, outFaces);
  }
  if (split.back) {
    clipSideIntoTree(split.back, side, node.children[1], planes, outFaces);
  }
}

/**
 * Assigns faces to the BSP nodes that they lie upon.
 */
export function assignFacesToNodes(
  faces: CompileFace[],
  tree: TreeElement,
  planes: CompilePlane[]
): Map<TreeNode, CompileFace[]> {
  const map = new Map<TreeNode, CompileFace[]>();

  // Recursively distribute faces
  distributeFaces(faces, tree, planes, map);

  return map;
}

function distributeFaces(
  faces: CompileFace[],
  node: TreeElement,
  planes: CompilePlane[],
  map: Map<TreeNode, CompileFace[]>
) {
  if (isLeaf(node)) {
    // Leaves don't store faces in the map (they are stored in leaf.faces usually, but here we return map for nodes)
    return;
  }

  const plane = planes[node.planeNum];
  const onNode: CompileFace[] = [];
  const front: CompileFace[] = [];
  const back: CompileFace[] = [];

  for (const f of faces) {
    // Check if face is on plane
    // We can check all points
    let isFront = false;
    let isBack = false;

    for (const p of f.winding.points) {
      const d = dotVec3(p, plane.normal) - plane.dist;
      if (d > 0.01) isFront = true;
      if (d < -0.01) isBack = true;
    }

    if (!isFront && !isBack) {
      // On plane
      onNode.push(f);
    } else if (isFront && !isBack) {
      front.push(f);
    } else if (!isFront && isBack) {
      back.push(f);
    } else {
      // Spanning?
      // Should not happen if faces were extracted from this tree!
      // But if it does, split it.
      const split = splitWinding(f.winding, plane.normal, plane.dist);
      if (split.front) {
          const ff = { ...f, winding: split.front };
          front.push(ff);
      }
      if (split.back) {
          const bf = { ...f, winding: split.back };
          back.push(bf);
      }
    }
  }

  if (onNode.length > 0) {
    map.set(node, onNode);
  }

  distributeFaces(front, node.children[0], planes, map);
  distributeFaces(back, node.children[1], planes, map);
}

export function fixTJunctions(
  faces: CompileFace[]
): void {
  // Collect all vertices
  const vertices: Vec3[] = [];
  for (const f of faces) {
    for (const p of f.winding.points) {
      vertices.push(p);
    }
  }

  for (const f of faces) {
    const w = f.winding;
    let modified = false;
    const newPoints: Vec3[] = [];

    for (let i = 0; i < w.numPoints; i++) {
      const p1 = w.points[i];
      const p2 = w.points[(i + 1) % w.numPoints];

      newPoints.push(p1);

      // Check for vertices on this edge
      const splits: { t: number, v: Vec3 }[] = [];

      for (const v of vertices) {
         if (isPointOnEdge(v, p1, p2)) {
           const t = distance(p1, v) / distance(p1, p2);
           splits.push({ t, v });
         }
      }

      // Sort splits by distance from p1
      splits.sort((a, b) => a.t - b.t);

      for (const split of splits) {
         // Avoid duplicates
         const last = newPoints[newPoints.length - 1];
         if (distance(last, split.v) > 0.01) {
             newPoints.push(split.v);
         }
      }
    }

    // Update winding if points added
    if (newPoints.length > w.numPoints) {
       // Filter close points (loop closing)
       const uniquePoints: Vec3[] = [];
       for(let k=0; k<newPoints.length; k++) {
           const p = newPoints[k];
           const prev = uniquePoints.length > 0 ? uniquePoints[uniquePoints.length-1] : newPoints[newPoints.length-1];
           if (distance(p, prev) > 0.01) {
               uniquePoints.push(p);
           }
       }

       if (uniquePoints.length >= 3) {
           f.winding = createWinding(uniquePoints.length);
           f.winding.points = uniquePoints;
       }
    }
  }
}

function isPointOnEdge(v: Vec3, e1: Vec3, e2: Vec3): boolean {
  const epsilon = 0.1;
  const d1 = distance(v, e1);
  const d2 = distance(v, e2);
  const len = distance(e1, e2);

  if (d1 < epsilon || d2 < epsilon) return false;
  return Math.abs(d1 + d2 - len) < epsilon;
}
