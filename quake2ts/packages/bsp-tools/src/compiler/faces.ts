import {
  type Winding,
  type Vec3,
  createWinding,
  windingPlane,
  crossVec3,
  dotVec3,
  subtractVec3,
  copyVec3,
  copyWinding,
  distance,
  removeColinearPoints,
  MASK_OPAQUE,
  hasAnyContents,
  splitWinding,
  SIDE_FRONT,
  SIDE_BACK,
  SIDE_ON,
  windingOnPlaneSide,
  normalizeVec3
} from '@quake2ts/shared';
import type { CompileFace, CompilePlane, MapBrush } from '../types/compile.js';
import { type TreeElement, type TreeNode, type TreeLeaf, isLeaf } from './tree.js';

/**
 * Extract renderable faces from BSP tree
 */
export function extractFaces(
  tree: TreeElement,
  planes: CompilePlane[]
): CompileFace[] {
  const faces: CompileFace[] = [];
  const uniqueBrushes = new Set<MapBrush>();

  // 1. Collect all unique MapBrushes from the tree leaves
  collectBrushes(tree, uniqueBrushes);

  // 2. For each brush side, clip against tree to find visible fragments
  for (const brush of uniqueBrushes) {
    for (const side of brush.sides) {
      if (!side.winding || !side.visible) continue;

      // Filter this winding into the tree
      const fragments = filterFaceIntoTree(side.winding, tree, planes);

      for (const w of fragments) {
        faces.push({
          planeNum: side.planeNum,
          texInfo: side.texInfo,
          winding: w,
          contents: brush.contents,
          original: side,
          next: null
        });
      }
    }
  }

  return faces;
}

function collectBrushes(root: TreeElement, result: Set<MapBrush>) {
  const stack: TreeElement[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;

    if (isLeaf(node)) {
      for (const b of node.brushes) {
        if (b.original) {
          result.add(b.original);
        }
      }
    } else {
      stack.push(node.children[0]);
      stack.push(node.children[1]);
    }
  }
}

function filterFaceIntoTree(
  w: Winding,
  node: TreeElement,
  planes: CompilePlane[]
): Winding[] {
  if (isLeaf(node)) {
    // Reached a leaf. Check if it's "transparent" (e.g. air, water)
    // If NOT opaque, then the face is visible (bordering void/water).
    if (!hasAnyContents(node.contents, MASK_OPAQUE)) {
      return [copyWinding(w)];
    }
    // Solid/Opaque leaf -> face is hidden
    return [];
  }

  // Node
  const plane = planes[node.planeNum];
  const side = windingOnPlaneSide(w, plane.normal, plane.dist);

  if (side === SIDE_FRONT) {
    return filterFaceIntoTree(w, node.children[0], planes);
  } else if (side === SIDE_BACK) {
    return filterFaceIntoTree(w, node.children[1], planes);
  } else if (side === SIDE_ON) {
    // Face is coplanar with split plane.
    // Check alignment to decide which side to traverse.
    const wp = windingPlane(w);
    const dot = dotVec3(wp.normal, plane.normal);

    if (dot > 0) {
      // Aligned. Front of face is Node Front.
      return filterFaceIntoTree(w, node.children[0], planes);
    } else {
      // Opposed. Front of face is Node Back.
      return filterFaceIntoTree(w, node.children[1], planes);
    }
  } else {
    // SIDE_CROSS -> Split
    const split = splitWinding(w, plane.normal, plane.dist);
    let result: Winding[] = [];
    if (split.front) {
      result = result.concat(filterFaceIntoTree(split.front, node.children[0], planes));
    }
    if (split.back) {
      result = result.concat(filterFaceIntoTree(split.back, node.children[1], planes));
    }
    return result;
  }
}

/**
 * Assign faces to nodes for front-to-back rendering
 */
export function assignFacesToNodes(
  faces: CompileFace[],
  tree: TreeElement,
  planes: CompilePlane[]
): Map<TreeNode, CompileFace[]> {
  const map = new Map<TreeNode, CompileFace[]>();

  for (const face of faces) {
    assignFace(face, tree, planes, map);
  }

  return map;
}

function assignFace(
  face: CompileFace,
  node: TreeElement,
  planes: CompilePlane[],
  map: Map<TreeNode, CompileFace[]>
) {
  if (isLeaf(node)) {
    return;
  }

  const plane = planes[node.planeNum];
  const side = windingOnPlaneSide(face.winding, plane.normal, plane.dist);

  if (side === SIDE_ON) {
    // Found the node!
    if (!map.has(node)) {
      map.set(node, []);
    }
    map.get(node)!.push(face);
  } else if (side === SIDE_FRONT) {
    assignFace(face, node.children[0], planes, map);
  } else if (side === SIDE_BACK) {
    assignFace(face, node.children[1], planes, map);
  } else {
    // Split
    const split = splitWinding(face.winding, plane.normal, plane.dist);
    if (split.front) {
      const fFront = { ...face, winding: split.front };
      assignFace(fFront, node.children[0], planes, map);
    }
    if (split.back) {
      const fBack = { ...face, winding: split.back };
      assignFace(fBack, node.children[1], planes, map);
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

/**
 * Fixes T-Junctions by ensuring all faces sharing an edge also share the vertices on that edge.
 * If a vertex from one face lies on the edge of another face, split the edge to include it.
 *
 * @param faces The list of faces to process.
 * @param epsilon Tolerance for vertex colinearity checking.
 * @returns The modified list of faces (faces are modified in-place, but returned for chaining).
 */
export function fixTJunctions(
  faces: CompileFace[],
  epsilon: number = 0.1
): CompileFace[] {
  // Collect all unique vertices from all faces
  // Actually, we need to check every edge of every face against all vertices of all other faces.
  // Optimization: Only check faces that might be adjacent or overlapping?
  // Naive approach: O(F^2 * V) or O(E * V_total).
  // Given current constraints, naive is okay.

  for (const face of faces) {
    if (!face.winding) continue;

    let modified = false;
    let w = face.winding;

    // We keep looping until no more splits occur on this face
    // Because adding a point creates a new edge which might need checking?
    // Usually one pass against all OTHER vertices is enough if we collect all split points first.

    // Better approach:
    // For each edge of 'face':
    //   Find all vertices from OTHER faces that lie ON this edge (between endpoints).
    //   Sort them by distance from start.
    //   Insert them.

    // Iterate edges
    // Since we are modifying the winding (inserting points), indices change.
    // We should build a new point list.

    const newPoints: Vec3[] = [];
    let faceChanged = false;

    for (let i = 0; i < w.numPoints; i++) {
      const p1 = w.points[i];
      const p2 = w.points[(i + 1) % w.numPoints];

      newPoints.push(copyVec3(p1));

      // Candidate points to insert on edge p1->p2
      const inserts: { t: number, p: Vec3 }[] = [];
      const edgeVec = subtractVec3(p2, p1);
      const edgeLen = distance(p1, p2);

      if (edgeLen < epsilon) continue; // Degenerate edge

      const edgeDir = normalizeVec3(edgeVec);

      // Check all other faces
      for (const otherFace of faces) {
        if (otherFace === face) continue;
        // Optimization: Check bounding boxes first?
        // Optimization: Check plane equation? T-junctions usually happen on coplanar or touching faces.
        // But T-junctions can be between perpendicular faces too?
        // Usually it's strictly about shared edges in the mesh.
        // Vertices must be ON the edge.

        for (const v of otherFace.winding.points) {
          // Check if v is on segment p1-p2
          // It must be collinear and between p1 and p2.

          // 1. Collinear check: Distance to line
          // Vector p1->v
          const vVec = subtractVec3(v, p1);
          // Project vVec onto edgeDir
          const t = dotVec3(vVec, edgeDir); // distance along line

          // Must be strictly between 0 and length (don't insert if it's already an endpoint)
          if (t > epsilon && t < edgeLen - epsilon) {
             // Check perpendicular distance
             // projected point = p1 + t * edgeDir
             // dist = |v - projected|
             // or cross product area
             const projected = {
               x: p1.x + t * edgeDir.x,
               y: p1.y + t * edgeDir.y,
               z: p1.z + t * edgeDir.z
             };
             if (distance(v, projected) < epsilon) {
               // Verify uniqueness in inserts
               let known = false;
               for (const cand of inserts) {
                 if (Math.abs(cand.t - t) < epsilon) {
                   known = true;
                   break;
                 }
               }
               if (!known) {
                 inserts.push({ t, p: v });
               }
             }
          }
        }
      }

      if (inserts.length > 0) {
        // Sort by t to insert in order
        inserts.sort((a, b) => a.t - b.t);
        for (const ins of inserts) {
          newPoints.push(copyVec3(ins.p));
        }
        faceChanged = true;
      }
    }

    if (faceChanged) {
      face.winding = createWinding(newPoints.length);
      face.winding.points = newPoints;
      // Recurse or repeat? The inserted points are existing vertices from other faces.
      // They shouldn't generate NEW T-junctions themselves usually.
    }
  }

  return faces;
}
