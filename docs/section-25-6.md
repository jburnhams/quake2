# Section 25-6: BSP Tree Construction

## Overview

Build the Binary Space Partition tree from brush fragments. The BSP tree enables efficient spatial queries and rendering.

**Estimated Tasks**: 20
**Dependencies**: Section 25-5 (CSG)
**Can Parallelize With**: Nothing (blocking for 25-7, 25-8)

---

## 1. BSP Tree Concepts

### 1.1 Tree Structure

```
             Node (split plane)
            /                  \
    Node (plane)            Leaf (empty/solid)
    /          \
Leaf           Leaf
```

- **Nodes**: Interior nodes with a split plane and two children
- **Leafs**: Terminal nodes representing convex regions (empty or solid)
- **Faces**: Renderable surfaces attached to nodes

### 1.2 Key Goals

1. Minimize tree depth (balanced splits)
2. Minimize face splits (fewer fragments)
3. Ensure convex leaf regions
4. Maintain collision accuracy

**Reference**: `q2tools/src/brushbsp.c` (entire file)

---

## 2. Split Plane Selection

### 2.1 Selection Criteria

- [x] Create `src/compiler/tree.ts`
- [x] Implement split plane selection

**File: `src/compiler/tree.ts`**
```typescript
export interface SplitCandidate {
  planeNum: number;
  score: number;
  frontCount: number;
  backCount: number;
  splitCount: number;
}

/**
 * Choose the best split plane for a set of brushes
 */
export function selectSplitPlane(
  brushes: BspBrush[],
  planes: CompilePlane[]
): SplitCandidate | null;
```

**Algorithm** (from `q2tools/src/brushbsp.c:200-350`):
1. Collect candidate planes from brush sides
2. For each candidate, count:
   - Brushes entirely in front
   - Brushes entirely behind
   - Brushes that would be split
3. Score = balance factor - split penalty
4. Prefer axial planes (faster runtime queries)
5. Return best scoring plane

**Scoring Formula:**
```typescript
const SPLIT_PENALTY = 4;  // Cost per split brush
const IMBALANCE_PENALTY = 2;  // Cost per imbalance

const balance = Math.abs(frontCount - backCount);
const score = -(splitCount * SPLIT_PENALTY) - (balance * IMBALANCE_PENALTY);

// Prefer axial planes
if (plane.type < 3) score += 5;
```

**Reference**: `q2tools/src/brushbsp.c` lines 200-350 (`SelectSplitSide`)

### 2.2 Tests

- [x] Test: Single brush → no split needed
- [x] Test: Two separate brushes → splits between them
- [x] Test: Prefers axial planes when equivalent
- [x] Test: Minimizes splits when possible

---

## 3. Tree Building

### 3.1 Recursive Tree Construction

- [x] Implement recursive tree builder

```typescript
export interface TreeNode {
  planeNum: number;
  children: [TreeNode | TreeLeaf, TreeNode | TreeLeaf];
  bounds: Bounds3;
}

export interface TreeLeaf {
  contents: number;
  brushes: BspBrush[];
  bounds: Bounds3;
}

export type TreeElement = TreeNode | TreeLeaf;

export function isLeaf(element: TreeElement): element is TreeLeaf;

/**
 * Build BSP tree recursively
 */
export function buildTree(
  brushes: BspBrush[],
  planes: CompilePlane[],
  depth?: number
): TreeElement;
```

**Algorithm** (from `q2tools/src/brushbsp.c:400-550`):
```
buildTree(brushes):
  if brushes is empty:
    return leaf(CONTENTS_EMPTY)

  if all brushes in same convex region:
    return leaf(combinedContents, brushes)

  splitPlane = selectSplitPlane(brushes)
  if no valid split:
    return leaf(combinedContents, brushes)

  frontBrushes, backBrushes = partitionBrushes(brushes, splitPlane)

  return node(
    splitPlane,
    buildTree(frontBrushes),
    buildTree(backBrushes)
  )
```

**Reference**: `q2tools/src/brushbsp.c` lines 400-550 (`BuildTree_r`)

### 3.2 Brush Partitioning

- [x] Implement brush partitioning by plane

```typescript
export interface PartitionResult {
  front: BspBrush[];
  back: BspBrush[];
}

/**
 * Partition brushes by a split plane
 * Brushes may be split into fragments
 */
export function partitionBrushes(
  brushes: BspBrush[],
  plane: CompilePlane,
  planeNum: number
): PartitionResult;
```

### 3.3 Tests

- [x] Test: Empty input → empty leaf
- [x] Test: Single brush → leaf with brush
- [x] Test: Two brushes → tree with two leaves
- [x] Test: Recursion depth limited
- [x] Test: All brushes reachable from tree

---

## 4. Face Extraction

### 4.1 Extract Visible Faces

- [x] Create `src/compiler/faces.ts`
- [x] Implement face extraction from tree

**File: `src/compiler/faces.ts`**
```typescript
export interface CompileFace {
  planeNum: number;
  side: number;  // 0 = front, 1 = back
  texInfo: number;
  winding: Winding;
  lightmapOffset?: number;
  lightmapSize?: [number, number];
}

/**
 * Extract renderable faces from BSP tree
 */
export function extractFaces(
  tree: TreeElement,
  planes: CompilePlane[]
): CompileFace[];
```

**Algorithm** (from `q2tools/src/faces.c:200-400`):
1. For each brush side with a valid winding:
   - Classify against tree to find visible portion
   - If any visible, create face
2. Clip face winding against other brushes
3. Split faces that cross node planes

**Reference**: `q2tools/src/faces.c` lines 200-400 (`MakeFaces_r`)

### 4.2 Face Assignment to Nodes

- [x] Implement face-to-node assignment

```typescript
/**
 * Assign faces to nodes for front-to-back rendering
 */
export function assignFacesToNodes(
  faces: CompileFace[],
  tree: TreeElement,
  planes: CompilePlane[]
): Map<TreeNode, CompileFace[]>;
```

**Reference**: `q2tools/src/faces.c` lines 450-500

### 4.3 Tests

- [x] Test: Box produces 6 faces (Covered by unit tests)
- [x] Test: Interior faces removed (Covered by unit tests)
- [x] Test: Faces on correct side of planes (Covered by unit tests)

---

## 5. T-Junction Fixing

### 5.1 What Are T-Junctions?

When edges meet at points not shared by adjacent faces, rendering artifacts (cracks) appear.

```
    ┌───────┐
    │       │     Bad: T-junction creates crack
    │   ┌───┤
    │   │   │
```

### 5.2 Fix T-Junctions

- [ ] Implement T-junction fixing

```typescript
/**
 * Fix T-junctions by adding vertices at edge intersections
 */
export function fixTJunctions(
  faces: CompileFace[],
  epsilon?: number
): CompileFace[];
```

**Algorithm** (from `q2tools/src/faces.c:600-750`):
1. Collect all unique edge endpoints
2. For each face edge:
   - Find points from other faces that lie on this edge
   - Insert those points into the face winding
3. Rebuild face windings

**Reference**: `q2tools/src/faces.c` lines 600-750 (`FixTJuncs`)

### 5.3 Tests

- [ ] Test: Adjacent faces share edge vertices
- [ ] Test: No T-junctions after fix
- [ ] Test: Face windings still valid

---

## 6. Node/Leaf Numbering

### 6.1 Flatten Tree to Arrays

- [ ] Implement tree flattening

```typescript
export interface FlattenedTree {
  nodes: BspNode[];
  leafs: BspLeaf[];
  leafBrushes: number[];
  leafFaces: number[];
}

/**
 * Convert tree structure to indexed arrays
 */
export function flattenTree(tree: TreeElement): FlattenedTree;
```

**Child Index Convention:**
- Positive: node index
- Negative: `-(leafIndex + 1)` (so leaf 0 = -1, leaf 1 = -2, etc.)

**Reference**: `q2tools/src/writebsp.c` lines 150-250

### 6.2 Tests

- [ ] Test: Leaf indices are negative
- [ ] Test: Root is node 0
- [ ] Test: All nodes/leaves reachable

---

## 7. Cluster Assignment

### 7.1 Assign Clusters to Leaves

- [ ] Implement cluster assignment

```typescript
/**
 * Assign visibility clusters to leaves
 * Initially, each leaf gets its own cluster
 */
export function assignClusters(leafs: TreeLeaf[]): number[];
```

Clusters group leaves for visibility. Initially 1:1, portals can merge clusters.

### 7.2 Tests

- [ ] Test: Each empty leaf gets cluster
- [ ] Test: Solid leaves get cluster -1

---

## 8. Model Definition

### 8.1 Create Models

- [ ] Implement model creation

```typescript
export interface CompileModel {
  headNode: number;
  mins: Vec3;
  maxs: Vec3;
  origin: Vec3;
  firstFace: number;
  numFaces: number;
}

/**
 * Create models (world + brush entities)
 */
export function createModels(
  worldTree: TreeElement,
  brushEntities: EntityDef[]
): CompileModel[];
```

Model 0 is always worldspawn. Additional models for `func_*` entities.

**Reference**: `q2tools/src/writebsp.c` lines 300-400

### 8.2 Tests

- [ ] Test: Model 0 is worldspawn
- [ ] Test: func_door gets separate model
- [ ] Test: Model bounds correct

---

## 9. Edge Optimization

### 9.1 Edge Deduplication

- [ ] Implement edge list building

```typescript
export interface EdgeSet {
  edges: BspEdge[];
  surfEdges: number[];  // Positive = forward, negative = backward
}

/**
 * Build deduplicated edge list
 */
export function buildEdges(faces: CompileFace[]): EdgeSet;
```

**Reference**: `q2tools/src/writebsp.c` lines 100-150

### 9.2 Tests

- [ ] Test: Shared edges appear once
- [ ] Test: surfEdges sign indicates direction

---

## 10. Compiler Integration

### 10.1 Full BSP Compiler

- [ ] Create `src/compiler/BspCompiler.ts`

**File: `src/compiler/BspCompiler.ts`**
```typescript
export class BspCompiler {
  constructor(options?: CompilerOptions);

  /**
   * Compile parsed map to BSP data
   */
  compile(map: ParsedMap): CompileResult;

  /**
   * Compile from builder brushes
   */
  compileFromBrushes(
    brushes: BrushDef[],
    entities: EntityDef[]
  ): CompileResult;
}

export interface CompilerOptions {
  /** Use extended QBSP format */
  extended?: boolean;

  /** Skip VIS pass */
  noVis?: boolean;

  /** Skip lighting pass */
  noLighting?: boolean;

  /** Verbose output */
  verbose?: boolean;

  /** Progress callback */
  onProgress?: (stage: string, percent: number) => void;
}

export interface CompileResult {
  bsp: BspData;
  stats: CompileStats;
  warnings: string[];
}
```

### 10.2 Tests

- [ ] Test: Compile simple room
- [ ] Test: Compile multi-room map
- [ ] Test: Output loads in engine

---

## 11. WASM Verification

### 11.1 Structure Comparison

- [ ] Compare node/leaf counts
- [ ] Compare tree depth
- [ ] Compare face counts
- [ ] Compare edge counts

### 11.2 Semantic Comparison

- [ ] Point queries return same leaf
- [ ] Trace queries return same results

---

## Verification Checklist

- [x] Split plane selection produces balanced trees
- [x] Tree building handles all brush configurations
- [x] Face extraction produces correct faces
- [ ] T-junction fixing eliminates cracks
- [ ] Node/leaf numbering correct
- [ ] Cluster assignment correct
- [ ] Models created for brush entities
- [ ] Edges deduplicated correctly
- [ ] Full compiler produces valid BSP
- [ ] WASM comparison passes
