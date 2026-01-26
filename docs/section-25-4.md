# Section 25-4: Primitive Builder (MVP)

## Overview

Create a programmatic API for building BSP maps from geometric primitives. This is the MVP that enables testing without external tools.

**Estimated Tasks**: 18
**Dependencies**: Section 25-2 (Winding math)
**Can Parallelize With**: Section 25-3 (Map Parser)

---

## 1. Builder Architecture

### 1.1 Class Overview

**File: `src/builder/BspBuilder.ts`**
```typescript
import type { BspData } from '@quake2ts/shared';

export interface BuildOptions {
  /** Use extended QBSP format for larger maps */
  extendedFormat?: boolean;

  /** Skip VIS computation (all visible) */
  skipVis?: boolean;

  /** Skip lighting (fullbright) */
  skipLighting?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

export interface BuildResult {
  bsp: BspData;
  stats: BuildStats;
  warnings: string[];
}

export interface BuildStats {
  brushCount: number;
  planeCount: number;
  nodeCount: number;
  leafCount: number;
  faceCount: number;
  entityCount: number;
  buildTimeMs: number;
}

export class BspBuilder {
  constructor(options?: BuildOptions);

  // Entity management
  setWorldspawn(properties: Record<string, string>): this;
  addEntity(entity: EntityDef): this;

  // Brush primitives (added to worldspawn)
  addBrush(brush: BrushDef): this;
  addBrushes(brushes: BrushDef[]): this;

  // High-level primitives
  addRoom(params: RoomParams): this;
  addCorridor(params: CorridorParams): this;
  addStairs(params: StairsParams): this;

  // From parsed map
  fromParsedMap(map: ParsedMap): this;

  // Build final BSP
  build(): BuildResult;

  // Validation before build
  validate(): ValidationResult;
}
```

### 1.2 Internal State

- [ ] Define internal state structure

```typescript
interface BuilderState {
  worldspawnProps: Map<string, string>;
  entities: EntityDef[];
  brushes: BrushDef[];
  options: BuildOptions;
}
```

---

## 2. Brush Definitions

### 2.1 Brush Types

- [ ] Create `src/builder/types.ts`

**File: `src/builder/types.ts`**
```typescript
import type { Vec3 } from '@quake2ts/shared';

/** A brush defined by its bounding planes */
export interface BrushDef {
  sides: BrushSideDef[];
  contents?: number;  // CONTENTS_SOLID by default
}

/** A single side/face of a brush */
export interface BrushSideDef {
  plane: PlaneDef;
  texture: TextureDef;
}

/** Plane defined by normal and distance */
export interface PlaneDef {
  normal: Vec3;
  dist: number;
}

/** Texture application on a brush side */
export interface TextureDef {
  name: string;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

/** Entity definition */
export interface EntityDef {
  classname: string;
  properties: Record<string, string>;
  brushes?: BrushDef[];  // For brush entities (func_*)
}
```

### 2.2 Default Values

- [ ] Create constants for defaults

```typescript
export const DEFAULT_TEXTURE: TextureDef = {
  name: 'base1/basewall',
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};

export const DEFAULT_CONTENTS = CONTENTS_SOLID;
```

---

## 3. Primitive Functions

### 3.1 Box Primitive

- [ ] Create `src/builder/primitives.ts`
- [ ] Implement `box()` function

**File: `src/builder/primitives.ts`**
```typescript
export interface BoxParams {
  /** Center of the box */
  origin: Vec3;

  /** Size in each dimension [width, depth, height] */
  size: Vec3;

  /** Texture for all faces (or per-face) */
  texture?: string | TextureDef | {
    top?: TextureDef;
    bottom?: TextureDef;
    north?: TextureDef;
    south?: TextureDef;
    east?: TextureDef;
    west?: TextureDef;
  };

  /** Contents flags */
  contents?: number;
}

/**
 * Create a solid box brush
 */
export function box(params: BoxParams): BrushDef;
```

**Algorithm:**
1. Calculate mins/maxs from origin and size
2. Create 6 axis-aligned planes (±X, ±Y, ±Z)
3. Apply textures to each face

### 3.2 Hollow Box (Room)

- [ ] Implement `hollowBox()` function

```typescript
export interface HollowBoxParams extends BoxParams {
  /** Wall thickness */
  wallThickness: number;

  /** Which sides to include (default: all) */
  sides?: {
    top?: boolean;
    bottom?: boolean;
    north?: boolean;
    south?: boolean;
    east?: boolean;
    west?: boolean;
  };
}

/**
 * Create a hollow box (room) from 6 wall brushes
 */
export function hollowBox(params: HollowBoxParams): BrushDef[];
```

**Returns:** Array of 6 (or fewer) brushes forming walls.

### 3.3 Wedge/Ramp

- [ ] Implement `wedge()` function

```typescript
export interface WedgeParams {
  origin: Vec3;
  size: Vec3;

  /** Direction the ramp faces */
  direction: 'north' | 'south' | 'east' | 'west';

  texture?: string | TextureDef;
}

/**
 * Create a wedge/ramp brush
 */
export function wedge(params: WedgeParams): BrushDef;
```

**Algorithm:**
1. Start with box planes
2. Replace one vertical face with angled plane

### 3.4 Stairs

- [ ] Implement `stairs()` function

```typescript
export interface StairsParams {
  origin: Vec3;
  width: number;
  height: number;
  depth: number;
  stepCount: number;
  direction: 'north' | 'south' | 'east' | 'west';
  texture?: string | TextureDef;
}

/**
 * Create stair steps
 */
export function stairs(params: StairsParams): BrushDef[];
```

**Returns:** Array of `stepCount` box brushes.

### 3.5 Cylinder (Approximation)

- [ ] Implement `cylinder()` function

```typescript
export interface CylinderParams {
  origin: Vec3;
  radius: number;
  height: number;
  sides: number;  // 8, 12, 16, etc.
  texture?: string | TextureDef;
}

/**
 * Create a cylindrical brush (approximated by N sides)
 */
export function cylinder(params: CylinderParams): BrushDef;
```

### 3.6 Tests

- [ ] Test: `box()` produces 6-sided brush
- [ ] Test: `box()` planes face outward
- [ ] Test: `hollowBox()` produces 6 brushes
- [ ] Test: `wedge()` produces valid convex brush
- [ ] Test: `stairs()` produces correct step count
- [ ] Test: `cylinder()` produces N+2 sided brush

---

## 4. High-Level Builders

### 4.1 Room Builder

- [ ] Implement `addRoom()` on BspBuilder

```typescript
export interface RoomParams {
  origin: Vec3;
  size: Vec3;
  wallThickness?: number;
  floorTexture?: string;
  ceilingTexture?: string;
  wallTexture?: string;

  /** Openings (doors, windows) */
  openings?: OpeningDef[];
}

export interface OpeningDef {
  wall: 'north' | 'south' | 'east' | 'west';
  position: Vec3;  // Relative to room origin
  size: Vec3;
}
```

### 4.2 Corridor Builder

- [ ] Implement `addCorridor()` on BspBuilder

```typescript
export interface CorridorParams {
  start: Vec3;
  end: Vec3;
  width: number;
  height: number;
  wallThickness?: number;
  texture?: string;
}
```

### 4.3 Tests

- [ ] Test: `addRoom()` creates valid enclosed space
- [ ] Test: `addCorridor()` creates valid enclosed space
- [ ] Test: Room with opening has correct hole

---

## 5. Entity Helpers

### 5.1 Common Entities

- [ ] Create `src/builder/entities.ts`

**File: `src/builder/entities.ts`**
```typescript
export function playerStart(origin: Vec3, angle?: number): EntityDef {
  return {
    classname: 'info_player_start',
    properties: {
      origin: `${origin.x} ${origin.y} ${origin.z}`,
      ...(angle !== undefined && { angle: String(angle) }),
    },
  };
}

export function light(origin: Vec3, intensity?: number, color?: Vec3): EntityDef {
  return {
    classname: 'light',
    properties: {
      origin: `${origin.x} ${origin.y} ${origin.z}`,
      light: String(intensity ?? 300),
      ...(color && { _color: `${color.x} ${color.y} ${color.z}` }),
    },
  };
}

export function trigger(origin: Vec3, size: Vec3, target: string): EntityDef;
export function funcDoor(brush: BrushDef, properties: Record<string, string>): EntityDef;
export function funcButton(brush: BrushDef, target: string): EntityDef;
```

### 5.2 Tests

- [ ] Test: `playerStart()` produces valid entity
- [ ] Test: `light()` produces valid entity
- [ ] Test: `funcDoor()` includes brush

---

## 6. Simple BSP Compiler (Convex Only)

### 6.1 Compiler for MVP

For the MVP, implement a simplified compiler that only handles non-overlapping convex brushes.

- [ ] Create `src/compiler/SimpleCompiler.ts`

**File: `src/compiler/SimpleCompiler.ts`**
```typescript
export class SimpleCompiler {
  constructor(brushes: BrushDef[], entities: EntityDef[]);

  compile(): CompileResult;
}

export interface CompileResult {
  planes: BspPlane[];
  nodes: BspNode[];
  leafs: BspLeaf[];
  faces: BspFace[];
  // ... other lumps
}
```

### 6.2 Plane Deduplication

- [ ] Implement `PlaneSet` class

**File: `src/compiler/planes.ts`**
```typescript
export class PlaneSet {
  private planes: CompilePlane[] = [];
  private hashTable: Map<number, number[]> = new Map();

  /**
   * Find or add a plane, return index
   */
  findOrAdd(normal: Vec3, dist: number): number;

  /**
   * Get all planes
   */
  getPlanes(): CompilePlane[];

  /**
   * Hash function for plane lookup
   */
  private hash(dist: number): number;
}
```

**Reference**: `q2tools/src/map.c` lines 110-200 (plane hashing)

### 6.3 Brush to Windings

- [ ] Implement brush face winding generation

```typescript
/**
 * Generate windings for all faces of a brush
 */
export function generateBrushWindings(brush: BrushDef): Map<number, Winding>;
```

**Algorithm:**
1. For each side, create base winding for plane
2. Clip winding against all other planes of brush
3. Result is the visible face polygon

**Reference**: `q2tools/src/map.c` lines 380-430 (`MakeBrushWindings`)

### 6.4 Simple BSP Tree

- [ ] Implement simple tree builder for convex brushes

```typescript
/**
 * Build BSP tree from non-overlapping convex brushes
 * This simplified version doesn't do CSG
 */
export function buildSimpleTree(
  brushes: BrushDef[],
  planes: PlaneSet
): { nodes: BspNode[]; leafs: BspLeaf[] };
```

For MVP: Create one leaf per brush, tree structure separates them.

### 6.5 Tests

- [ ] Test: Plane deduplication finds existing planes
- [ ] Test: Opposite planes share index (flipped)
- [ ] Test: Brush windings are valid convex polygons
- [ ] Test: Simple tree compiles single brush
- [ ] Test: Simple tree compiles multiple non-overlapping brushes

---

## 7. BSP Output

### 7.1 BSP Writer

- [ ] Migrate/refactor `test-utils/bspBuilder.ts` into `bsp-tools`

**File: `src/output/bspWriter.ts`**
```typescript
import type { BspData } from '@quake2ts/shared';

export class BspWriter {
  /**
   * Serialize BspData to binary format
   */
  static write(data: BspData): Uint8Array;

  /**
   * Write to file (Node.js only)
   */
  static writeToFile(data: BspData, path: string): Promise<void>;
}
```

**Reference**: Existing `packages/test-utils/src/engine/builders/bspBuilder.ts`

### 7.2 Lump Assembly

- [ ] Implement lump assembly from compile result

```typescript
export function assembleBsp(result: CompileResult, entities: EntityDef[]): BspData;
```

### 7.3 Entity String

- [ ] Implement entity lump string generation

```typescript
export function serializeEntities(entities: EntityDef[]): string;
```

**Format:**
```
{
"classname" "worldspawn"
"key" "value"
}
{
"classname" "info_player_start"
"origin" "0 0 0"
}
```

**Reference**: `q2tools/src/writebsp.c` lines 50-100

### 7.4 Tests

- [ ] Test: Entity serialization matches expected format
- [ ] Test: BSP header has correct magic/version
- [ ] Test: Lump offsets are valid
- [ ] Test: Written BSP can be parsed by engine

---

## 8. Trivial VIS/Lighting

### 8.1 All-Visible VIS

- [ ] Implement trivial VIS (all clusters see all clusters)

```typescript
/**
 * Generate visibility data where everything is visible
 */
export function generateTrivialVis(leafCount: number): Uint8Array;
```

**Format:** All bits set to 1.

### 8.2 Fullbright Lighting

- [ ] Implement fullbright lightmaps

```typescript
/**
 * Generate fullbright lighting data
 */
export function generateFullbrightLighting(faces: BspFace[]): Uint8Array;
```

**Format:** All light samples set to 255 (white).

---

## 9. Integration Tests

### 9.1 End-to-End Build

- [ ] Test: Build single room → BSP loads in engine
- [ ] Test: Build room with player start → player spawns
- [ ] Test: Build corridor → player can walk through

### 9.2 WASM Comparison

- [ ] Test: Compare plane counts with WASM reference
- [ ] Test: Compare node/leaf structure with WASM reference

---

## 10. Migration from test-utils

### 10.1 Backward Compatibility

- [ ] Create compatibility shim in test-utils that uses bsp-tools
- [ ] Deprecate old `buildTestBsp()` function
- [ ] Update existing tests to use new API

**File: `packages/test-utils/src/engine/builders/bspBuilder.ts`**
```typescript
// DEPRECATED: Use @quake2ts/bsp-tools instead
import { BspBuilder } from '@quake2ts/bsp-tools';

/** @deprecated Use BspBuilder from @quake2ts/bsp-tools */
export function buildTestBsp(/* ... */): BspData {
  console.warn('buildTestBsp is deprecated, use BspBuilder from @quake2ts/bsp-tools');
  // ... forward to new implementation
}
```

---

## Verification Checklist

- [ ] All primitive functions produce valid brushes
- [ ] BspBuilder compiles simple maps
- [ ] Output BSP passes engine validation
- [ ] Output BSP renders correctly (visual inspection)
- [ ] Player can spawn and move in generated maps
- [ ] WASM comparison shows matching structure
- [ ] Existing test-utils tests still pass
- [ ] Performance: Simple room builds in <100ms
