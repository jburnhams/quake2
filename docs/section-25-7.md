# Section 25-7: Portals & Visibility

## Overview

Generate portals between BSP leaves and compute the Potentially Visible Set (PVS) for efficient runtime rendering.

**Estimated Tasks**: 16
**Dependencies**: Section 25-6 (BSP Tree)
**Can Parallelize With**: Section 25-8 (Lighting)

---

## 1. Portal Concepts

### 1.1 What Are Portals?

Portals are polygons (windings) on leaf boundaries that represent "windows" between adjacent empty spaces.

```
   ┌─────────────┐
   │  Leaf A     │
   │     ┌───────┤  ← Portal between A and B
   │     │ Leaf B│
   └─────┴───────┘
```

### 1.2 Purpose

1. **Visibility**: Determine which leaves can see each other
2. **Sound**: Determine which leaves can hear each other (PHS)
3. **Optimization**: Skip rendering unseen geometry

**Reference**: `q2tools/src/portals.c` (entire file)

---

## 2. Portal Generation

### 2.1 Create Initial Portals

- [ ] Create `src/compiler/portals.ts`
- [ ] Implement portal generation from tree

**File: `src/compiler/portals.ts`**
```typescript
export interface Portal {
  winding: Winding;
  planeNum: number;
  onNode: TreeNode;
  leafs: [number, number];  // Leaf indices on each side
  hint: boolean;  // User-placed hint portal
}

/**
 * Generate portals from BSP tree
 */
export function generatePortals(
  tree: TreeElement,
  planes: CompilePlane[]
): Portal[];
```

**Algorithm** (from `q2tools/src/portals.c:200-350`):
```
makeTreePortals(node):
  if node is leaf:
    return

  // Create portal on this node's split plane
  portal = createBasePortal(node.plane)

  // Clip portal to parent bounds
  portal = clipToParents(portal, node)

  // Assign to leaves
  assignPortalToLeaves(portal, node.front, node.back)

  // Recurse
  makeTreePortals(node.front)
  makeTreePortals(node.back)
```

**Reference**: `q2tools/src/portals.c` lines 200-350 (`MakeTreePortals_r`)

### 2.2 Clip Portal to Tree

- [ ] Implement portal clipping through tree

```typescript
/**
 * Clip a portal winding through the BSP tree
 * to find the leaf it ends up in
 */
export function clipPortalToTree(
  winding: Winding,
  node: TreeElement,
  planes: CompilePlane[]
): { leaf: TreeLeaf; winding: Winding } | null;
```

**Reference**: `q2tools/src/portals.c` lines 100-180 (`Portal_Passable`)

### 2.3 Tests

- [ ] Test: Two-room map produces portal between them
- [ ] Test: Portal winding is valid polygon
- [ ] Test: Portal references correct leaves
- [ ] Test: No portals to solid leaves

---

## 3. Portal Flow

### 3.1 Portal Flow Structure

- [ ] Define flow structures

```typescript
export interface PortalFlow {
  portal: Portal;
  frontCluster: number;
  backCluster: number;
  mightSee: BitSet;  // Clusters this portal might see
  canSee: BitSet;    // Clusters this portal definitely sees
  status: 'pending' | 'working' | 'done';
}

export interface VisibilityState {
  numClusters: number;
  numPortals: number;
  portals: PortalFlow[];
  clusterPortals: Map<number, Portal[]>;  // Portals per cluster
}
```

### 3.2 Initialize Flow

- [ ] Implement flow initialization

```typescript
/**
 * Initialize portal flow structures for visibility computation
 */
export function initializePortalFlow(
  portals: Portal[],
  leafs: TreeLeaf[]
): VisibilityState;
```

**Reference**: `q2tools/src/vis.c` lines 100-200

---

## 4. Base Visibility

### 4.1 Trivial Visibility Check

- [ ] Implement simple flood-fill visibility

```typescript
/**
 * Compute which clusters are reachable from a given cluster
 * through portal chains (ignoring actual visibility)
 */
export function floodFillVisibility(
  state: VisibilityState,
  startCluster: number
): BitSet;
```

### 4.2 Simple Portal Test

- [ ] Implement basic "might see" test

```typescript
/**
 * Test if target cluster might be visible from source
 * through a chain of portals
 */
export function mightSeeCluster(
  state: VisibilityState,
  source: number,
  target: number
): boolean;
```

---

## 5. Full Visibility (PVS)

### 5.1 Recursive Portal Flow

- [ ] Implement full PVS computation

```typescript
/**
 * Compute full Potentially Visible Set for a cluster
 */
export function computeClusterPvs(
  state: VisibilityState,
  cluster: number
): BitSet;
```

**Algorithm** (from `q2tools/src/vis.c:400-600`):
```
recursiveLeafFlow(portal, source, testWinding):
  for each target portal in portal.mightSee:
    if target already processed:
      continue

    // Clip source winding to target portal
    clipped = clipWindingToPortal(testWinding, target)
    if clipped is null or tiny:
      continue

    // Target is visible
    pvs.set(target.cluster)

    // Recursively check what target can see
    recursiveLeafFlow(target, source, clipped)
```

**Reference**: `q2tools/src/vis.c` lines 400-600 (`RecursiveLeafFlow`)

### 5.2 Anti-Penumbra Clipping

- [ ] Implement anti-penumbra (separator plane) clipping

```typescript
/**
 * Clip winding against anti-penumbra planes
 * This tightens the visibility bounds
 */
export function clipToAntiPenumbra(
  winding: Winding,
  source: Winding,
  pass: Winding
): Winding | null;
```

This is the most complex part of VIS - creates separator planes between source and pass portals to tighten the view frustum.

**Reference**: `q2tools/src/vis.c` lines 250-400 (`ClipToAntiPenumbra`)

### 5.3 Tests

- [ ] Test: Adjacent rooms see each other
- [ ] Test: Rooms behind solid don't see each other
- [ ] Test: L-shaped corridor blocks line of sight
- [ ] Test: Full PVS is subset of flood fill

---

## 6. PVS Compression

### 6.1 Run-Length Encoding

- [ ] Implement PVS compression

```typescript
/**
 * Compress visibility bitsets using run-length encoding
 */
export function compressPvs(
  clusters: BitSet[],
  numClusters: number
): Uint8Array;

/**
 * Decompress single cluster's PVS
 */
export function decompressPvs(
  data: Uint8Array,
  offset: number,
  numClusters: number
): BitSet;
```

**Format** (from `q2tools/src/bspfile.c`):
- 0x00: Next byte is count of zeros
- 0xFF + count: Count of ones
- Other: Literal byte (8 bits of visibility)

**Reference**: `q2tools/src/bspfile.c` lines 500-600 (`CompressVis`, `DecompressVis`)

### 6.2 Tests

- [ ] Test: Compress → decompress = original
- [ ] Test: Compression reduces size
- [ ] Test: Empty PVS compresses well

---

## 7. PHS (Potentially Hearable Set)

### 7.1 Compute PHS

- [ ] Implement PHS computation

```typescript
/**
 * Compute Potentially Hearable Set
 * PHS = union of all PVS for clusters within hearing range
 */
export function computePhs(
  pvs: BitSet[],
  numClusters: number,
  hearingRange?: number
): BitSet[];
```

PHS is typically PVS expanded by one portal step.

**Reference**: `q2tools/src/vis.c` lines 700-800

### 7.2 Tests

- [ ] Test: PHS is superset of PVS
- [ ] Test: PHS includes adjacent clusters

---

## 8. Fast VIS Mode

### 8.1 Quick Visibility

- [ ] Implement fast (approximate) VIS

```typescript
export interface VisOptions {
  /** Fast mode: flood fill only, no anti-penumbra */
  fast?: boolean;

  /** Number of threads (for future parallelization) */
  threads?: number;

  /** Progress callback */
  onProgress?: (percent: number) => void;
}

/**
 * Compute visibility with options
 */
export function computeVisibility(
  portals: Portal[],
  leafs: TreeLeaf[],
  options?: VisOptions
): VisibilityData;
```

Fast mode skips expensive anti-penumbra clipping, producing larger (less optimal) PVS.

**Reference**: `q2tools/src/vis.c` lines 50-80 (fast vis option)

### 8.2 Tests

- [ ] Test: Fast VIS completes quickly
- [ ] Test: Fast VIS is superset of full VIS
- [ ] Test: Full VIS is tighter than fast VIS

---

## 9. Visibility Output

### 9.1 Assemble Visibility Lump

- [ ] Implement visibility lump creation

```typescript
export interface VisibilityData {
  numClusters: number;
  bitOffsets: number[];  // [pvs_offset, phs_offset] per cluster
  data: Uint8Array;
}

/**
 * Create visibility lump data
 */
export function createVisibilityLump(
  pvs: BitSet[],
  phs: BitSet[],
  numClusters: number
): VisibilityData;
```

**Reference**: `q2tools/src/writebsp.c` lines 400-500

### 9.2 Tests

- [ ] Test: Visibility lump structure correct
- [ ] Test: Engine can parse visibility data

---

## 10. Integration

### 10.1 Integrate into Compiler

- [ ] Add VIS pass to BspCompiler

```typescript
// In BspCompiler.compile():
if (!options.noVis) {
  const portals = generatePortals(tree, planes);
  const visData = computeVisibility(portals, leafs, {
    fast: options.fastVis,
    onProgress: (p) => options.onProgress?.('vis', p)
  });
  result.visibility = createVisibilityLump(visData);
}
```

### 10.2 Tests

- [ ] Test: Compiled BSP has valid visibility
- [ ] Test: Engine renders correct faces

---

## 11. WASM Verification

### 11.1 PVS Comparison

- [ ] Compare cluster count
- [ ] Compare PVS bits for each cluster
- [ ] Compare compressed size

### 11.2 Runtime Verification

- [ ] Verify same faces rendered from same viewpoint
- [ ] Verify `inPVS()` queries match

---

## Verification Checklist

- [ ] Portal generation produces correct portals
- [ ] Portal winding clipping correct
- [ ] Flood fill visits all reachable clusters
- [ ] Full PVS computation correct
- [ ] Anti-penumbra tightens visibility
- [ ] PVS compression/decompression works
- [ ] PHS computed correctly
- [ ] Fast VIS produces valid (if loose) results
- [ ] Visibility lump correctly formatted
- [ ] WASM comparison passes
