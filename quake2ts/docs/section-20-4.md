# Section 20-4: PNG Snapshot Testing Framework

**Phase:** 1 (Foundation)
**Priority:** CRITICAL
**Dependencies:** 20-3 (Headless Testing)
**Estimated Effort:** 2-3 days
**Status:** Completed

---

## Overview

Implement PNG-based visual regression testing using pixelmatch for pixel-perfect comparison. Captures rendered frames as PNG snapshots and compares against baseline images.

**Goal:** Automated visual validation that rendering matches expectations.

---

## Objectives

1. Capture framebuffer output as PNG files [x]
2. Compare rendered output against baseline snapshots [x]
3. Generate diff images highlighting differences [x]
4. Provide workflow for approving/updating baselines [x]
5. Integrate with vitest test framework [x]

---

## Tasks

### Task 1: PNG Encoding & Capture [x]

**File:** `packages/test-utils/src/visual/snapshots.ts`

Implemented PNG capture from framebuffer using `pngjs`.
Includes handling of `GPUBuffer` readback, padding removal, and RGBA/BGRA handling.

**Subtasks:**
1. Install pngjs dependency (`npm install pngjs @types/pngjs`) [x]
2. Implement texture readback to Uint8ClampedArray [x]
3. Convert RGBA buffer to PNG using pngjs [x]
4. Write PNG to filesystem [x]
5. Read PNG from filesystem [x]
6. Handle format conversions (BGRA ↔ RGBA if needed) [x]
7. Ensure alpha channel preserved [x]

---

### Task 2: Pixel Comparison with pixelmatch [x]

**File:** `packages/test-utils/src/visual/snapshots.ts`

Implemented pixel comparison using `pixelmatch`.

**Subtasks:**
1. Install pixelmatch dependency (`npm install pixelmatch @types/pixelmatch`) [x]
2. Implement wrapper around pixelmatch [x]
3. Generate diff image highlighting differences [x]
4. Calculate difference percentage [x]
5. Apply threshold for pass/fail [x]
6. Handle edge cases (size mismatch, missing baseline) [x]
7. Provide sensible defaults (0.1% tolerance) [x]

---

### Task 3: Snapshot Test Utilities [x]

**File:** `packages/test-utils/src/visual/snapshots.ts`

Created high-level test utilities: `expectSnapshot` and `renderAndExpectSnapshot`.

**Subtasks:**
1. Implement expectSnapshot [x]
2. Implement renderAndExpectSnapshot helper [x]
3. Define snapshot directory structure [x]
4. Handle missing baseline (first run) [x]
5. Support update mode (--update flag) [x]

---

### Task 4: Vitest Integration [x]

**File:** `packages/engine/tests/helpers/visual-testing.ts`

Integrated with vitest using `base.extend`.
Refactored `renderAndExpectSnapshot` fixture to accept a callback that receives `device` to allow resource creation.

**Subtasks:**
1. Create custom vitest test extension with snapshot context [x]
2. Handle --update-snapshots CLI flag [x]
3. Integrate with vitest's snapshot workflow [x]
4. Provide clear error messages on failure [x]
5. Clean up actual/diff on successful runs (optional) [x] (Implemented cleanup of setup, but actual/diff are left if failure occurred, which is intended)

---

### Task 5: CLI & Workflow [x]

**File:** `packages/engine/package.json`

Added test scripts: `test:visual`, `test:visual:update`, `test:visual:watch`.
Moved visual tests to `tests/integration/visual/` to run as part of integration suite.

**Documentation:** `docs/testing-visual.md` created.

**Subtasks:**
1. Add npm scripts for visual testing [x]
2. Document workflow for running tests [x]
3. Document workflow for reviewing failures [x]
4. Document workflow for updating baselines [x]
5. Provide examples of visual tests [x]

---

### Task 6: Example Visual Tests [x]

**File:** `packages/engine/tests/integration/visual/basic-rendering.test.ts`

Created example visual tests for clear color and triangle rendering.

**Subtasks:**
1. Create basic visual test file [x]
2. Test clear color (simplest case) [x]
3. Test simple triangle rendering [x]
4. Generate initial baselines [x]
5. Verify tests fail when rendering changes [x] (Implicitly verified by `packages/test-utils/tests/visual/expectSnapshot.test.ts`)
6. Verify tests pass when rendering is correct [x]

---

## Deliverables

### New Files Created
- `packages/test-utils/src/visual/snapshots.ts`
- `packages/engine/tests/helpers/visual-testing.ts`
- `packages/engine/tests/integration/visual/basic-rendering.test.ts`
- `docs/testing-visual.md`

### Modified Files
- `packages/test-utils/package.json`
- `packages/engine/package.json`
- `packages/test-utils/src/index.ts`

### Directories Created
- `packages/engine/tests/integration/visual/__snapshots__/baselines/`
- `packages/engine/tests/integration/visual/__snapshots__/actual/`
- `packages/engine/tests/integration/visual/__snapshots__/diff/`

---

## Success Criteria

- [x] Can capture framebuffer as PNG
- [x] Can compare PNG snapshots with pixelmatch
- [x] Diff images generated on failure
- [x] Baseline update workflow works
- [x] Vitest integration complete
- [x] CLI commands work
- [x] Documentation complete
- [x] Example visual tests pass

---

**Next Section:** [20-5: Sprite/2D Renderer (First Pipeline)](section-20-5.md)
