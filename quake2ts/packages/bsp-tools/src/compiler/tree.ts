import {
  type Bounds3,
  createEmptyBounds3,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import { ON_EPSILON } from '../types/index.js';
import type { CompileBrush, CompilePlane } from '../types/compile.js';
import type { PlaneSet } from './planes.js';
import {
  splitBrush,
  combineContents
} from './csg.js';

// Tree structures
export interface TreeNode {
  planeNum: number;
  children: [TreeElement, TreeElement];
  bounds: Bounds3;
}

export interface TreeLeaf {
  contents: number;
  brushes: CompileBrush[];
  bounds: Bounds3;
}

export type TreeElement = TreeNode | TreeLeaf;

export function isLeaf(element: TreeElement): element is TreeLeaf {
  return (element as any).children === undefined;
}

export interface PartitionResult {
  front: CompileBrush[];
  back: CompileBrush[];
}

export interface SplitCandidate {
  planeNum: number;
  score: number;
  frontCount: number;
  backCount: number;
  splitCount: number;
}

enum BrushPlaneRelation {
  Front,
  Back,
  Spanning,
  OnPlane
}

function classifyBrushAgainstPlane(brush: CompileBrush, plane: CompilePlane): BrushPlaneRelation {
  let front = false;
  let back = false;

  for (const s of brush.sides) {
    if (!s.winding) continue;
    for (const p of s.winding.points) {
      const d = (p.x * plane.normal.x) + (p.y * plane.normal.y) + (p.z * plane.normal.z) - plane.dist;
      if (d > ON_EPSILON) front = true;
      if (d < -ON_EPSILON) back = true;
    }
  }

  if (front && back) return BrushPlaneRelation.Spanning;
  if (front) return BrushPlaneRelation.Front;
  if (back) return BrushPlaneRelation.Back;
  return BrushPlaneRelation.OnPlane;
}

/**
 * Selects the best split plane from the set of planes used by the brushes.
 * Prioritizes axial planes and balanced splits.
 */
export function selectSplitPlane(
  brushes: CompileBrush[],
  planeSet: PlaneSet
): SplitCandidate | null {
  const planes = planeSet.getPlanes();
  let bestCandidate: SplitCandidate | null = null;
  const testedPlanes = new Set<number>();

  for (const brush of brushes) {
    for (const side of brush.sides) {
      if (!side.winding || side.bevel) continue;

      const planeNum = side.planeNum;
      if (testedPlanes.has(planeNum)) continue;
      testedPlanes.add(planeNum);

      const plane = planes[planeNum];

      let frontCount = 0;
      let backCount = 0;
      let splitCount = 0;

      for (const b of brushes) {
        const relation = classifyBrushAgainstPlane(b, plane);
        if (relation === BrushPlaneRelation.Spanning) splitCount++;
        else if (relation === BrushPlaneRelation.Front) frontCount++;
        else if (relation === BrushPlaneRelation.Back) backCount++;
        else {
          // OnPlane -> Front
          frontCount++;
        }
      }

      // Scoring
      // q2tools: score = 5*axial + (front - back) (?? no, balance)
      // q2tools: score = -(splitCount * 4) - (balance * 2) (approx)

      // Calculate total items on each side (including splits)
      const totalFront = frontCount + splitCount;
      const totalBack = backCount + splitCount;

      // If plane puts everything on one side, it's not a useful splitter
      if (totalFront === 0 || totalBack === 0) continue;

      const balance = Math.abs(totalFront - totalBack);
      let score = -(splitCount * 4) - (balance * 1); // Reduced balance penalty slightly

      if (plane.type < 3) { // Axial planes
        score += 100; // Strong preference for axial
      }

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          planeNum,
          score,
          frontCount: totalFront,
          backCount: totalBack,
          splitCount
        };
      }
    }
  }

  return bestCandidate;
}

/**
 * Partition brushes into front and back lists by a splitting plane.
 * Brushes that span the plane are split.
 */
export function partitionBrushes(
  brushes: CompileBrush[],
  planeNum: number,
  planeSet: PlaneSet
): PartitionResult {
  const front: CompileBrush[] = [];
  const back: CompileBrush[] = [];
  const plane = planeSet.getPlanes()[planeNum];

  for (const brush of brushes) {
    const relation = classifyBrushAgainstPlane(brush, plane);

    if (relation === BrushPlaneRelation.Spanning) {
      // Split
      const split = splitBrush(brush, planeNum, plane, planeSet);
      if (split.front) front.push(split.front);
      if (split.back) back.push(split.back);
    } else if (relation === BrushPlaneRelation.Front) {
      front.push(brush);
    } else if (relation === BrushPlaneRelation.Back) {
      back.push(brush);
    } else {
      // On plane. Usually put on front side.
      front.push(brush);
    }
  }

  return { front, back };
}

/**
 * Recursively builds the BSP tree.
 */
const MAX_TREE_DEPTH = 1000;

export function buildTree(
  brushes: CompileBrush[],
  planeSet: PlaneSet,
  depth: number = 0
): TreeElement {
  if (brushes.length === 0) {
    return {
      contents: 0, // Empty
      brushes: [],
      bounds: createEmptyBounds3()
    };
  }

  // Check recursion depth to prevent stack overflow
  if (depth >= MAX_TREE_DEPTH) {
    let combinedContents = 0;
    for (const b of brushes) combinedContents = combineContents(combinedContents, b.original.contents);

    return {
      contents: combinedContents,
      brushes: brushes,
      bounds: calculateBoundsBrushes(brushes)
    };
  }

  // Calculate bounds for this node
  const bounds = calculateBoundsBrushes(brushes);

  // Check if we should stop splitting (e.g. all brushes are solid and convex?)
  // For now, naive recursive build until no useful split found.

  // If we only have 1 brush, can we just make it a leaf?
  // Only if it's convex (which individual CompileBrushes are) and we are happy with 1 brush per leaf.
  // Standard BSP tries to group brushes if they form a convex volume.
  // But here we'll just try to split.

  // Optimization: If all brushes have same content and form a convex hull...
  // checking that is expensive.

  const split = selectSplitPlane(brushes, planeSet);

  // If no split is good (e.g. all splits are terrible, or we can't find a plane that separates anything)
  // We might just make a leaf.
  // q2tools allows splitting until no planes left.

  if (!split || (split.frontCount === 0 && split.backCount === 0)) {
     // No valid split found or plane doesn't divide anything?
     // If splitCount > 0 but front/back are 0, it means EVERYTHING splits?
     // That shouldn't happen with axial planes usually unless very weird.

     // Fallback: Create leaf
     const contents = brushes.length > 0 ? (brushes[0].original.contents) : 0;
     // Note: mixed contents in a leaf is generally bad, but CSG should have separated them?
     // Or we just OR them.

     let combinedContents = 0;
     for (const b of brushes) combinedContents = combineContents(combinedContents, b.original.contents);

     return {
       contents: combinedContents,
       brushes: brushes,
       bounds
     };
  }

  const { front, back } = partitionBrushes(brushes, split.planeNum, planeSet);

  const frontNode = buildTree(front, planeSet, depth + 1);
  const backNode = buildTree(back, planeSet, depth + 1);

  return {
    planeNum: split.planeNum,
    children: [frontNode, backNode],
    bounds
  };
}

function calculateBoundsBrushes(brushes: CompileBrush[]): Bounds3 {
  let bounds = createEmptyBounds3();
  for (const b of brushes) {
    const bb = b.bounds;
    bounds = {
        mins: {
          x: Math.min(bounds.mins.x, bb.mins.x),
          y: Math.min(bounds.mins.y, bb.mins.y),
          z: Math.min(bounds.mins.z, bb.mins.z)
        },
        maxs: {
          x: Math.max(bounds.maxs.x, bb.maxs.x),
          y: Math.max(bounds.maxs.y, bb.maxs.y),
          z: Math.max(bounds.maxs.z, bb.maxs.z)
        }
    };
  }
  return bounds;
}
