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

      // Scoring
      // q2tools: score = 5*axial + (front - back) (?? no, balance)
      // q2tools: score = -(splitCount * 4) - (balance * 2) (approx)

      // Calculate total items on each side (including splits)
      const totalFront = frontCount + splitCount;
      const totalBack = backCount + splitCount;

      // HULL GENERATION FIX:
      // If one side is empty, it means this plane is a boundary.
      // We ALLOW it if we are carving space.
      // But we should prioritize splits that divide space.
      // If we don't divide space (front or back is 0), we might infinite loop IF we reuse the plane.
      // Since we check `usedPlanes`, we won't reuse it.
      // So allow front=0 or back=0.

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
  usedPlanes: Set<number> = new Set(), // Pass by value (new set for each recursion) or shared set?
  // Shared set is wrong because different branches can reuse planes?
  // No, if a plane is used as a splitter in a node, it splits the volume.
  // Children operate in subspaces.
  // Can a child reuse a parent's splitter?
  // If parent split by P. Children are Front(P) and Back(P).
  // Front(P) is strictly in front. So it can't cross P.
  // So picking P again would put everything in Front (or Back).
  // Which is redundant.
  // So yes, `usedPlanes` should be passed down.
  // BUT we need to clone it for branches if the decision is local?
  // No, the volume is defined by the PATH from root.
  // So `usedPlanes` accumulates down the recursion.
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

  const split = selectSplitPlane(brushes, planeSet, usedPlanes);

  // If no split is good (e.g. all splits are terrible, or we can't find a plane that separates anything)
  // We might just make a leaf.
  // q2tools allows splitting until no planes left.

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
  leafBrushes: number[]; // Flattened array of brush indices (standard BSP format is indirect via leafBrushes list)
  leafFaces: number[];   // Flattened array of face indices
  // The BSP format uses 'leafFaces' and 'leafBrushes' as look-up tables (indices into faces/brushes lumps).
  // In BspLeaf, firstLeafFace/numLeafFaces index into leafFaces lump.
  // We'll return arrays of arrays for easier lump construction, or just flattened with offsets.
  // Let's match BspLeafLists structure: number[][]
  leafFacesList: number[][];
  leafBrushesList: number[][];
}

/**
 * Flattens the recursive tree structure into linear arrays for BSP output.
 * Assigns node/leaf indices.
 *
 * @param tree The root of the tree.
 * @param faceMap A map of faces assigned to nodes.
 * @param faces The linear array of all faces (already serialized), used to look up indices.
 *              We assume faceMap values are references to objects that we can find indices for?
 *              Or better: faceMap values are INDICES into the faces array if we did that already.
 *              Wait, faces are usually serialized in depth-first order of the tree to optimize cache.
 *              So we should linearize faces HERE.
 * @returns Flattened tree data.
 */
export function flattenTree(
  tree: TreeElement,
  faceMap: Map<TreeNode, CompileFace[]>
): FlattenedTree & { serializedFaces: CompileFace[] } {
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

      // TODO: Populate leaf brushes list
      // We need a mapping from CompileBrush to final brush index.
      // Since we don't have that here, we'll store temporary indices or references?
      // For now, let's assume brush indices are stored in CompileBrush.original? No.
      // We'll just store 0 for now or implement brush indexing later.
      // Leaf brushes are mainly for collision.
      const brushes: number[] = [];
      // element.brushes.forEach(b => brushes.push(???));

      // Leaf faces are typically Portal-visible faces.
      // Since we assign faces to Nodes, leafs usually have 0 faces in Quake 2 BSP?
      // Actually Quake 2 stores faces in Nodes. Leafs reference brushes.
      // Some engines put faces in leafs too (e.g. for PVS rendering).
      // Quake 2: Faces are in Nodes. Leafs store visible faces for PVS?
      // "Faces are stored in nodes" is strictly true for splitting planes.
      // But for rendering, we walk the tree.
      // Wait, BspLeaf has 'firstLeafFace' and 'numLeafFaces'.
      // These are for faces *marked* as being in the leaf (e.g. for collision or detailed visibility).
      // Standard Q2 compiler might put faces in leafs.
      // But typically faces are on nodes.
      // Let's leave leaf faces empty for now unless we need them.
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
        firstLeafFace: 0, // Placeholder, implies empty
        numLeafFaces: 0,
        firstLeafBrush: 0, // Placeholder
        numLeafBrushes: 0
      };

      leafs.push(leaf);
      return -(leafIndex + 1);
    }

    // It's a Node
    // Flatten children first? No, Nodes array is usually depth-first order?
    // Actually recursive:
    // Index = nodes.length; nodes.push(placeholder);
    // front = walk(children[0]);
    // back = walk(children[1]);
    // update nodes[Index] with front/back.

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
    leafBrushes: [], // Legacy compat if needed
    leafFaces: [],   // Legacy compat if needed
    serializedFaces
  };
}
