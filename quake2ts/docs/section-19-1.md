# Section 19-1: Shared/Core Utilities Migration

**Work Stream:** Foundation utilities used across all packages
**Priority:** HIGH - Other sections depend on this
**Dependencies:** None
**Parallel Status:** Can start immediately

---

## Overview

This section covers migration of shared testing utilities that form the foundation for other test utilities. These include BSP helpers, binary/network mocks, math utilities, and common test data structures.

---

## Tasks

### 1. Consolidate BSP Helpers (HIGH PRIORITY)

**Status:** Complete
**Dependencies:** None

- [x] **1.1** Verify `test-utils/src/shared/bsp.ts` has all functions from duplicates
  - Functions: `makePlane()`, `makeAxisBrush()`, `makeNode()`, `makeBspModel()`, `makeLeaf()`, `makeLeafModel()`, `makeBrushFromMinsMaxs()`

- [x] **1.2** Remove duplicate BSP helpers from `shared/tests/bsp/test-helpers.ts`
  - Delete file after completing subtasks below

- [x] **1.3** Update imports in `shared/tests/` directory
  - Replace `import { ... } from './bsp/test-helpers'` with `import { ... } from '@quake2ts/test-utils'`
  - Estimated files: ~15

- [x] **1.4** Remove duplicate BSP helpers from `game/tests/physics/bsp-helpers.ts`
  - Delete file after completing subtasks below

- [x] **1.5** Update imports in `game/tests/physics/` directory
  - Replace `import { ... } from './bsp-helpers'` with `import { ... } from '@quake2ts/test-utils'`
  - Estimated files: ~10

- [x] **1.6** Update imports in other `game/tests/` subdirectories
  - Check `game/tests/entities/`, `game/tests/combat/` for BSP helper usage
  - Estimated files: ~5

---

### 2. Expand Binary/Network Mocks (MEDIUM PRIORITY)

**Status:** Complete
**Dependencies:** None

- [x] **2.1** Audit current binary/network mocks in `test-utils/src/shared/mocks.ts`
  - Current: `createBinaryWriterMock()`, `createNetChanMock()`, `createBinaryStreamMock()`

- [x] **2.2** Add `createMessageWriterMock()` factory to `test-utils/src/shared/mocks.ts`
  - Signature: `createMessageWriterMock(overrides?: Partial<MessageWriter>): MessageWriter`
  - Mock methods: `writeString()`, `writeInt()`, `writeByte()`, `writeVector()`

- [x] **2.3** Add `createMessageReaderMock()` factory to `test-utils/src/shared/mocks.ts`
  - Signature: `createMessageReaderMock(data?: Uint8Array): MessageReader`
  - Mock methods: `readString()`, `readInt()`, `readByte()`, `readVector()`

- [x] **2.4** Add `createPacketMock()` factory to `test-utils/src/shared/mocks.ts`
  - Signature: `createPacketMock(overrides?: Partial<Packet>): Packet`
  - Include common packet types: connection, data, ack, disconnect

---

### 3. Create Shared Math/Geometry Helpers (MEDIUM PRIORITY)

**Status:** Complete
**Dependencies:** None

- [x] **3.1** Create `test-utils/src/shared/math.ts` file

- [x] **3.2** Add vector factory `createVector3(x?: number, y?: number, z?: number): Vector3`
  - Default to origin (0, 0, 0)

- [x] **3.3** Add bounds factory `createBounds(mins?: Vector3, maxs?: Vector3): Bounds`
  - Default to unit cube

- [x] **3.4** Add transform factory `createTransform(overrides?: Partial<Transform>): Transform`
  - Include position, rotation, scale

- [x] **3.5** Add `randomVector3(min?: number, max?: number): Vector3` helper
  - For randomized test data

- [x] **3.6** Export all math helpers from `test-utils/src/index.ts`

---

### 4. Expand Trace/Collision Helpers (MEDIUM PRIORITY)

**Status:** Complete
**Dependencies:** None

- [x] **4.1** Move trace helpers from `game/helpers.ts` to `shared/collision.ts`
  - Functions: `intersects()`, `stairTrace()`, `ladderTrace()`
  - These are shared utilities, not game-specific

- [x] **4.2** Add `createTraceMock()` factory to `test-utils/src/shared/collision.ts`
  - Signature: `createTraceMock(overrides?: Partial<Trace>): Trace`
  - Include: `fraction`, `endpos`, `plane`, `surface`, `contents`, `ent`

- [x] **4.3** Add `createSurfaceMock()` factory to `test-utils/src/shared/collision.ts`
  - Signature: `createSurfaceMock(overrides?: Partial<Surface>): Surface`
  - Include common surface types

- [x] **4.4** Update `game/helpers.ts` to re-export from `shared/collision.ts`
  - Maintain backward compatibility temporarily

- [x] **4.5** Update imports across codebase (phased approach)
  - Create subtasks per package in Section 19-3

---

### 5. Create Common Type Factories (LOW PRIORITY)

**Status:** Not started
**Dependencies:** None

- [ ] **5.1** Create `test-utils/src/shared/factories.ts` file

- [ ] **5.2** Add `createConfigStringMock()` factory
  - Signature: `createConfigStringMock(index: number, value: string): ConfigString`

- [ ] **5.3** Add `createConfigStringArrayMock()` factory
  - Signature: `createConfigStringArrayMock(entries?: Record<number, string>): ConfigString[]`
  - Pre-populate common indices (models, sounds, images)

- [ ] **5.4** Add `createCvarMock()` factory
  - Signature: `createCvarMock(name: string, value: string, flags?: number): Cvar`

- [ ] **5.5** Export all shared factories from `test-utils/src/index.ts`

---

### 6. Documentation and Exports (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Tasks 1-5

- [ ] **6.1** Add JSDoc comments to all shared utilities
  - Include usage examples for complex factories

- [ ] **6.2** Update `test-utils/README.md` with shared utilities section
  - Document: BSP helpers, binary mocks, math helpers, collision helpers, factories

- [ ] **6.3** Verify all shared utilities exported from `test-utils/src/index.ts`
  - Organized by category

- [ ] **6.4** Add TypeScript type exports
  - Export types: `TraceMock`, `SurfaceMock`, `BinaryWriterMock`, etc.

---

## Summary

**Total Tasks:** 6
**Total Subtasks:** 32
**Estimated Impact:** ~30 test files updated, ~200 lines of new utilities
**Critical Path:** Task 1 (BSP consolidation) should complete first as it has most immediate duplicates
