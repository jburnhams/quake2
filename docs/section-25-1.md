# Section 25-1: Foundation & Infrastructure (COMPLETED)

**Summary**: Package structure and foundational types established. Test fixtures for maps created. WASM reference implementation deferred.

## Overview

Set up the package structure, WASM reference implementation, and shared constants/types.

**Estimated Tasks**: 12
**Dependencies**: None
**Can Parallelize With**: Nothing initially (this is foundational)

---

## 1. Package Setup

### 1.1 Create Package Structure

- [x] Create `packages/bsp-tools/` directory
- [x] Create `packages/bsp-tools/package.json`
- [x] Create `packages/bsp-tools/tsconfig.json`
- [x] Create `packages/bsp-tools/vitest.config.ts`
- [x] Add to workspace in root `pnpm-workspace.yaml` (Implicit via `packages/*`)

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
│   │   ├── limits.ts
│   │   ├── plane.ts
│   │   ├── compile.ts
│   │   └── epsilon.ts
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

- [x] Create `src/index.ts` with public API exports

**File: `src/index.ts`**
```typescript
// Types
export * from './types/index.js';

// Parser
// export { MapParser } from './parser/mapParser';

// Builder
// export { BspBuilder } from './builder/BspBuilder';
// export * from './builder/primitives';

// Compiler (advanced usage)
// export { BspCompiler } from './compiler/BspCompiler';
```

---

## 2. WASM Reference Implementation (Deferred)

This section is deferred as it requires complex build environment setup (cmake, emscripten) not currently available or priority. Focus is on TypeScript implementation first.

### 2.1 Emscripten Build Setup

- [ ] Create `wasm/CMakeLists.txt` for Emscripten build
- [ ] Create `wasm/build.sh` script
- [ ] Document build prerequisites

### 2.2 JavaScript Bindings

- [ ] Create `wasm/q2toolsWasm.ts` TypeScript wrapper
- [ ] Implement `compileMapToRef(mapContent: string): Uint8Array`
- [ ] Implement `compareBspFiles(a: Uint8Array, b: Uint8Array): ComparisonResult`

### 2.3 WASM Tests

- [ ] Create `tests/wasm/reference.test.ts`
- [ ] Test WASM module loads correctly
- [ ] Test simple box map compilation

---

## 3. Shared Constants & Types

### 3.1 BSP Limits

- [x] Create `src/types/limits.ts` with BSP format limits

### 3.2 Plane Types

- [x] Add plane type constants to shared or bsp-tools
- [x] Implement `planeTypeForNormal`

### 3.3 Compile-Time Types

- [x] Create `src/types/compile.ts` for internal compiler structures

### 3.4 Epsilon Constants

- [x] Create `src/types/epsilon.ts`

---

## 4. Test Fixtures

### 4.1 Programmatic .map Writer

- [x] Create `tests/fixtures/mapWriter.ts`
- [x] Implement functions to generate valid .map file strings

### 4.2 Standard Test Maps

- [x] Create `tests/fixtures/maps/box.ts` - Single hollow box room
- [x] Create `tests/fixtures/maps/corridor.ts` - L-shaped corridor
- [x] Create `tests/fixtures/maps/multiroom.ts` - Two rooms with doorway

---

## 5. CI Integration

### 5.1 Build Scripts

- [x] Add `build` script to package.json
- [x] Add `test:unit` script
- [ ] Add `test:integration` script (requires WASM)
- [ ] Add `test:wasm` script for reference comparison

### 5.2 GitHub Actions

- [ ] Update CI to build bsp-tools package
- [ ] Add WASM build step (cached)
- [ ] Add reference comparison tests

---

## Verification Checklist

- [x] `pnpm install` completes without errors
- [x] `pnpm build` in bsp-tools succeeds
- [x] `pnpm test:unit` passes (placeholder tests)
- [ ] WASM module builds with Emscripten
- [ ] WASM reference test passes with simple map
- [x] Types are correctly exported from package
