# Section 25-1: Foundation & Infrastructure

## Overview

Set up the package structure, WASM reference implementation, and shared constants/types.

**Estimated Tasks**: 12
**Dependencies**: None
**Can Parallelize With**: Nothing initially (this is foundational)

---

## 1. Package Setup

### 1.1 Create Package Structure

- [ ] Create `packages/bsp-tools/` directory
- [ ] Create `packages/bsp-tools/package.json`
- [ ] Create `packages/bsp-tools/tsconfig.json`
- [ ] Create `packages/bsp-tools/vitest.config.ts`
- [ ] Add to workspace in root `pnpm-workspace.yaml`

**File: `packages/bsp-tools/package.json`**
```json
{
  "name": "@quake2ts/bsp-tools",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@quake2ts/shared": "workspace:*"
  }
}
```

**Directory Structure:**
```
packages/bsp-tools/
├── src/
│   ├── index.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── map.ts
│   │   ├── brush.ts
│   │   └── compile.ts
│   ├── parser/
│   ├── builder/
│   ├── compiler/
│   └── lighting/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── wasm/
    └── q2tools/
```

### 1.2 Package Exports

- [ ] Create `src/index.ts` with public API exports

**File: `src/index.ts`**
```typescript
// Types
export * from './types';

// Parser
export { MapParser } from './parser/mapParser';

// Builder
export { BspBuilder } from './builder/BspBuilder';
export * from './builder/primitives';

// Compiler (advanced usage)
export { BspCompiler } from './compiler/BspCompiler';
```

---

## 2. WASM Reference Implementation

### 2.1 Emscripten Build Setup

- [ ] Create `wasm/CMakeLists.txt` for Emscripten build
- [ ] Create `wasm/build.sh` script
- [ ] Document build prerequisites

**File: `wasm/CMakeLists.txt`**
```cmake
cmake_minimum_required(VERSION 3.10)
project(q2tools-wasm)

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O2")

# Export functions for JS binding
set(EXPORTED_FUNCTIONS "['_compile_map', '_get_bsp_data', '_get_bsp_size', '_free_bsp']")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s EXPORTED_FUNCTIONS=${EXPORTED_FUNCTIONS}")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s MODULARIZE=1 -s EXPORT_ES6=1")

add_executable(q2tools
  # Include relevant q2tools sources
  ${Q2TOOLS_SRC}/bspfile.c
  ${Q2TOOLS_SRC}/brushbsp.c
  # ... etc
)
```

**Reference**: `q2tools/CMakeLists.txt` for full source list

### 2.2 JavaScript Bindings

- [ ] Create `wasm/q2toolsWasm.ts` TypeScript wrapper
- [ ] Implement `compileMapToRef(mapContent: string): Uint8Array`
- [ ] Implement `compareBspFiles(a: Uint8Array, b: Uint8Array): ComparisonResult`

**File: `wasm/q2toolsWasm.ts`**
```typescript
interface Q2ToolsWasm {
  compile_map(mapPtr: number, mapLen: number, flags: number): number;
  get_bsp_data(): number;
  get_bsp_size(): number;
  free_bsp(): void;
}

export class Q2ToolsReference {
  private module: Q2ToolsWasm;

  async init(): Promise<void>;
  compileMap(mapContent: string, options?: CompileOptions): Uint8Array;
  dispose(): void;
}

export interface CompileOptions {
  vis?: boolean;      // Run VIS pass
  rad?: boolean;      // Run RAD pass
  verbose?: boolean;
}
```

### 2.3 WASM Tests

- [ ] Create `tests/wasm/reference.test.ts`
- [ ] Test WASM module loads correctly
- [ ] Test simple box map compilation

**Test Cases:**
1. WASM module initializes without error
2. Compiling empty worldspawn produces valid BSP header
3. Compiling single box brush produces expected lump sizes

---

## 3. Shared Constants & Types

### 3.1 BSP Limits

- [ ] Create `src/types/limits.ts` with BSP format limits

**File: `src/types/limits.ts`**
```typescript
// Standard Q2 BSP limits (from q2tools/src/qfiles.h:35-60)
export const BSP_LIMITS = {
  MAX_MAP_MODELS: 1024,
  MAX_MAP_BRUSHES: 8192,
  MAX_MAP_ENTITIES: 8192,
  MAX_MAP_PLANES: 65536,
  MAX_MAP_NODES: 65536,
  MAX_MAP_LEAFS: 65536,
  MAX_MAP_VERTS: 65536,
  MAX_MAP_FACES: 65536,
  MAX_MAP_LEAFFACES: 65536,
  MAX_MAP_TEXINFO: 8192,
  MAX_MAP_EDGES: 128000,
  MAX_MAP_SURFEDGES: 256000,
  MAX_MAP_LIGHTING: 0x200000,
  MAX_MAP_VISIBILITY: 0x100000,
} as const;

// Extended QBSP limits (from q2tools/src/qfiles.h:62-85)
export const QBSP_LIMITS = {
  MAX_MAP_MODELS: 131072,
  MAX_MAP_BRUSHES: 1048576,
  // ... etc
} as const;
```

**Reference**: `q2tools/src/qfiles.h` lines 35-85

### 3.2 Plane Types

- [ ] Add plane type constants to shared or bsp-tools

**File: `src/types/plane.ts`**
```typescript
// Plane axis types (from q2tools/src/qfiles.h:126-133)
export const PLANE_X = 0;      // normal is +/- (1,0,0)
export const PLANE_Y = 1;      // normal is +/- (0,1,0)
export const PLANE_Z = 2;      // normal is +/- (0,0,1)
export const PLANE_ANYX = 3;   // normal predominantly X
export const PLANE_ANYY = 4;   // normal predominantly Y
export const PLANE_ANYZ = 5;   // normal predominantly Z

export function planeTypeForNormal(normal: Vec3): number;
```

**Reference**: `q2tools/src/map.c` lines 64-84 (`PlaneTypeForNormal`)

### 3.3 Compile-Time Types

- [ ] Create `src/types/compile.ts` for internal compiler structures

**File: `src/types/compile.ts`**
```typescript
import type { Vec3, Bounds3 } from '@quake2ts/shared';

/** Internal plane during compilation (extends runtime plane) */
export interface CompilePlane {
  normal: Vec3;
  dist: number;
  type: number;
  signbits: number;
  hashChain?: number;  // For plane deduplication
}

/** Brush side during compilation */
export interface CompileSide {
  planeNum: number;
  texInfo: number;
  winding?: Winding;
  visible: boolean;
  tested: boolean;
  bevel: boolean;
}

/** Map brush before CSG */
export interface MapBrush {
  entityNum: number;
  brushNum: number;
  sides: CompileSide[];
  bounds: Bounds3;
  contents: number;
}

/** BSP brush after CSG (may be fragmented) */
export interface BspBrush {
  original: MapBrush;
  sides: CompileSide[];
  bounds: Bounds3;
  next?: BspBrush;  // Linked list for fragments
}
```

**Reference**: `q2tools/src/qbsp.h` lines 50-120

### 3.4 Epsilon Constants

- [ ] Create `src/types/epsilon.ts`

**File: `src/types/epsilon.ts`**
```typescript
// From q2tools/src/qbsp.h and various .c files
export const NORMAL_EPSILON = 0.00001;
export const DIST_EPSILON = 0.01;
export const ON_EPSILON = 0.1;
export const EDGE_LENGTH_EPSILON = 0.2;
export const POINT_ON_PLANE_EPSILON = 0.5;
export const CONTINUOUS_EPSILON = 0.005;
```

**Reference**: `q2tools/src/qbsp.h` lines 25-35

---

## 4. Test Fixtures

### 4.1 Programmatic .map Writer

- [ ] Create `tests/fixtures/mapWriter.ts`
- [ ] Implement functions to generate valid .map file strings

**File: `tests/fixtures/mapWriter.ts`**
```typescript
export interface MapEntity {
  classname: string;
  properties: Record<string, string>;
  brushes?: MapBrushDef[];
}

export interface MapBrushDef {
  sides: MapBrushSide[];
}

export interface MapBrushSide {
  plane: [Vec3, Vec3, Vec3];  // Three points defining plane
  texture: string;
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export function writeMapFile(entities: MapEntity[]): string;
export function createBoxBrush(origin: Vec3, size: Vec3, texture?: string): MapBrushDef;
export function createHollowBox(origin: Vec3, size: Vec3, wallThickness: number, texture?: string): MapBrushDef[];
```

### 4.2 Standard Test Maps

- [ ] Create `tests/fixtures/maps/box.ts` - Single hollow box room
- [ ] Create `tests/fixtures/maps/corridor.ts` - L-shaped corridor
- [ ] Create `tests/fixtures/maps/multiroom.ts` - Two rooms with doorway

**Test Map: Simple Box Room**
```typescript
// tests/fixtures/maps/box.ts
export function createBoxRoom(size = 512, wallThickness = 16): MapEntity[] {
  return [{
    classname: 'worldspawn',
    properties: { message: 'Test Box Room' },
    brushes: createHollowBox([0, 0, 0], [size, size, size], wallThickness)
  }, {
    classname: 'info_player_start',
    properties: { origin: `${size/2} ${size/2} 32` }
  }];
}
```

---

## 5. CI Integration

### 5.1 Build Scripts

- [ ] Add `build` script to package.json
- [ ] Add `test:unit` script
- [ ] Add `test:integration` script (requires WASM)
- [ ] Add `test:wasm` script for reference comparison

### 5.2 GitHub Actions

- [ ] Update CI to build bsp-tools package
- [ ] Add WASM build step (cached)
- [ ] Add reference comparison tests

---

## Verification Checklist

- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` in bsp-tools succeeds
- [ ] `pnpm test:unit` passes (placeholder tests)
- [ ] WASM module builds with Emscripten
- [ ] WASM reference test passes with simple map
- [ ] Types are correctly exported from package
