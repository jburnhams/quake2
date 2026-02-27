import {
  type Bounds3,
  createEmptyBounds3,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import { ON_EPSILON } from '../types/index.js';
import type { CompileBrush, CompileFace, CompilePlane } from '../types/compile.js';
import type { PlaneSet } from './planes.js';
import {
  splitBrush,
  combineContents
} from './csg.js';
import {
  type BspNode,
  type BspLeaf
} from '../types/bsp.js';

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
  // Filled during flattening
  cluster?: number;
  area?: number;
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
  planeSet: PlaneSet,
  usedPlanes: Set<number>
): SplitCandidate | null {
  const planes = planeSet.getPlanes();
  let bestCandidate: SplitCandidate | null = null;
  const testedPlanes = new Set<number>();

  for (const brush of brushes) {
    for (const side of brush.sides) {
      if (!side.winding || side.bevel) continue;

      const planeNum = side.planeNum;
      if (usedPlanes.has(planeNum)) continue;
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

      // Calculate total items on each side (including splits)
      const totalFront = frontCount + splitCount;
      const totalBack = backCount + splitCount;

      const balance = Math.abs(totalFront - totalBack);
      let score = -(splitCount * 4) - (balance * 1); // Reduced balance penalty slightly

      if (plane.type < 3) { // Axial planes
        score += 5; // Preference for axial
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
  usedPlanes: Set<number> = new Set(),
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

  const split = selectSplitPlane(brushes, planeSet, usedPlanes);

  if (!split) {
     // No valid split found.
     // Fallback: Create leaf
     let combinedContents = 0;
     for (const b of brushes) combinedContents = combineContents(combinedContents, b.original.contents);

     return {
       contents: combinedContents,
       brushes: brushes,
       bounds
     };
  }

  // Add split plane to used set for children
  const nextUsedPlanes = new Set(usedPlanes);
  nextUsedPlanes.add(split.planeNum);

  const { front, back } = partitionBrushes(brushes, split.planeNum, planeSet);

  const frontNode = buildTree(front, planeSet, nextUsedPlanes, depth + 1);
  const backNode = buildTree(back, planeSet, nextUsedPlanes, depth + 1);

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

export interface FlattenedTree {
  nodes: BspNode[];
  leafs: BspLeaf[];
  leafFacesList: number[][];
  leafBrushesList: number[][];
  serializedFaces: CompileFace[];
}

/**
 * Flattens the recursive tree structure into linear arrays for BSP output.
 * Assigns node/leaf indices.
 *
 * @param tree The root of the tree.
 * @param faceMap A map of faces assigned to nodes.
 * @returns Flattened tree data.
 */
export function flattenTree(
  tree: TreeElement,
  faceMap: Map<TreeNode, CompileFace[]>
): FlattenedTree {
  const nodes: BspNode[] = [];
  const leafs: BspLeaf[] = [];
  const leafFacesList: number[][] = [];
  const leafBrushesList: number[][] = [];
  const serializedFaces: CompileFace[] = []; // Output faces in tree traversal order

  // Helper to serialize faces for a node
  // Returns index in serializedFaces array
  function processNodeFaces(node: TreeNode): { first: number, count: number } {
    const nodeFaces = faceMap.get(node) || [];
    if (nodeFaces.length === 0) return { first: 0, count: 0 };

    const first = serializedFaces.length;
    for (const f of nodeFaces) {
      serializedFaces.push(f);
    }
    return { first, count: nodeFaces.length };
  }

  // Recursive flattening
  // Returns node index (positive) or -(leaf index + 1) (negative)
  function walk(element: TreeElement): number {
    if (isLeaf(element)) {
      const leafIndex = leafs.length;

      // Extract unique original brush indices for this leaf
      const brushes: number[] = [];
      const brushSet = new Set<number>();
      for (const b of element.brushes) {
        if (b.original && b.original.brushNum !== undefined) {
          const bNum = b.original.brushNum;
          if (!brushSet.has(bNum)) {
            brushSet.add(bNum);
            brushes.push(bNum);
          }
        }
      }

      // Leaves in standard BSP don't usually hold faces for rendering, nodes do.
      const faces: number[] = [];

      leafFacesList.push(faces);
      leafBrushesList.push(brushes);

      const leaf: BspLeaf = {
        contents: element.contents,
        cluster: -1, // Assigned later
        area: -1,    // Assigned later
        mins: [
          Math.floor(element.bounds.mins.x),
          Math.floor(element.bounds.mins.y),
          Math.floor(element.bounds.mins.z)
        ],
        maxs: [
          Math.ceil(element.bounds.maxs.x),
          Math.ceil(element.bounds.maxs.y),
          Math.ceil(element.bounds.maxs.z)
        ],
        firstLeafFace: 0, // Placeholder, updated later when creating lumps
        numLeafFaces: faces.length,
        firstLeafBrush: 0, // Placeholder, updated later
        numLeafBrushes: brushes.length
      };

      leafs.push(leaf);
      return -(leafIndex + 1);
    }

    const nodeIndex = nodes.length;
    // Push placeholder
    nodes.push({} as any);

    const { first, count } = processNodeFaces(element);

    const frontChild = walk(element.children[0]);
    const backChild = walk(element.children[1]);

    nodes[nodeIndex] = {
      planeIndex: element.planeNum,
      children: [frontChild, backChild],
      mins: [
        Math.floor(element.bounds.mins.x),
        Math.floor(element.bounds.mins.y),
        Math.floor(element.bounds.mins.z)
      ],
      maxs: [
        Math.ceil(element.bounds.maxs.x),
        Math.ceil(element.bounds.maxs.y),
        Math.ceil(element.bounds.maxs.z)
      ],
      firstFace: first,
      numFaces: count
    };

    return nodeIndex;
  }

  walk(tree);

  return {
    nodes,
    leafs,
    leafFacesList,
    leafBrushesList,
    serializedFaces
  };
}
