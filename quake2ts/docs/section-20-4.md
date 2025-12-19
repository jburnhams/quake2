# Section 20-4: PNG Snapshot Testing Framework

**Phase:** 1 (Foundation)
**Priority:** CRITICAL
**Dependencies:** 20-3 (Headless Testing)
**Estimated Effort:** 2-3 days

---

## Overview

Implement PNG-based visual regression testing using pixelmatch for pixel-perfect comparison. Captures rendered frames as PNG snapshots and compares against baseline images.

**Goal:** Automated visual validation that rendering matches expectations.

---

## Objectives

1. Capture framebuffer output as PNG files
2. Compare rendered output against baseline snapshots
3. Generate diff images highlighting differences
4. Provide workflow for approving/updating baselines
5. Integrate with vitest test framework

---

## Tasks

### Task 1: PNG Encoding & Capture

**File:** `packages/test-utils/src/visual/snapshots.ts`

Implement PNG capture from framebuffer:

```typescript
interface CaptureOptions {
  width: number;
  height: number;
  format?: GPUTextureFormat;
}

async function captureFramebufferAsPNG(
  device: GPUDevice,
  texture: GPUTexture,
  options: CaptureOptions
): Promise<Buffer>

async function savePNG(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  filepath: string
): Promise<void>

async function loadPNG(
  filepath: string
): Promise<{ data: Uint8ClampedArray; width: number; height: number }>
```

**Subtasks:**
1. Install pngjs dependency (`npm install pngjs @types/pngjs`)
2. Implement texture readback to Uint8ClampedArray
3. Convert RGBA buffer to PNG using pngjs
4. Write PNG to filesystem
5. Read PNG from filesystem
6. Handle format conversions (BGRA ↔ RGBA if needed)
7. Ensure alpha channel preserved

**Test Cases:**
- Captures texture as PNG
- PNG can be written to disk
- PNG can be read back
- Round-trip preserves pixel data
- Handles different texture sizes

---

### Task 2: Pixel Comparison with pixelmatch

**File:** Same as Task 1

Implement pixel comparison:

```typescript
interface ComparisonResult {
  pixelsDifferent: number;
  totalPixels: number;
  percentDifferent: number;
  passed: boolean;
  diffImage?: Uint8ClampedArray;
}

interface ComparisonOptions {
  threshold?: number;        // Pixel difference threshold (0-1), default 0.1
  includeAA?: boolean;       // Include anti-aliasing detection
  diffColor?: [number, number, number];  // Color for diff pixels
  maxDifferencePercent?: number;  // Max % difference to pass, default 0.1%
}

async function compareSnapshots(
  actual: Uint8ClampedArray,
  expected: Uint8ClampedArray,
  width: number,
  height: number,
  options?: ComparisonOptions
): Promise<ComparisonResult>
```

**Subtasks:**
1. Install pixelmatch dependency (`npm install pixelmatch @types/pixelmatch`)
2. Implement wrapper around pixelmatch
3. Generate diff image highlighting differences
4. Calculate difference percentage
5. Apply threshold for pass/fail
6. Handle edge cases (size mismatch, missing baseline)
7. Provide sensible defaults (0.1% tolerance)

**Test Cases:**
- Identical images pass comparison
- Different images fail comparison
- Diff image generated correctly
- Threshold works as expected
- Size mismatches detected and reported

---

### Task 3: Snapshot Test Utilities

**File:** Same as Task 1

Create high-level test utilities:

```typescript
interface SnapshotTestOptions {
  name: string;
  width?: number;
  height?: number;
  updateBaseline?: boolean;  // Update baseline if true
  threshold?: number;
  maxDifferencePercent?: number;
}

async function expectSnapshot(
  pixels: Uint8ClampedArray,
  options: SnapshotTestOptions
): Promise<void>

async function renderAndExpectSnapshot(
  setup: RenderTestSetup,
  renderFn: (pass: GPURenderPassEncoder) => void,
  options: Omit<SnapshotTestOptions, 'width' | 'height'>
): Promise<void>

function getSnapshotPath(name: string, type: 'baseline' | 'actual' | 'diff'): string
```

**Subtasks:**
1. Implement expectSnapshot that:
   - Loads baseline PNG (if exists)
   - Compares with actual pixels
   - Saves actual PNG on failure
   - Saves diff PNG on failure
   - Updates baseline if flag set
   - Throws if comparison fails
2. Implement renderAndExpectSnapshot helper
3. Define snapshot directory structure:
   ```
   tests/__snapshots__/
   ├── baselines/
   │   └── test-name.png
   ├── actual/
   │   └── test-name.png  (on failure)
   └── diff/
       └── test-name.png  (on failure)
   ```
4. Handle missing baseline (first run)
5. Support update mode (--update flag)

**Test Cases:**
- First run creates baseline
- Subsequent runs compare against baseline
- Failures save actual and diff
- Update mode replaces baseline
- Snapshot paths are consistent

---

### Task 4: Vitest Integration

**File:** `packages/engine/tests/helpers/visual-testing.ts`

Integrate with vitest:

```typescript
import { test as base } from 'vitest';

interface VisualTestContext {
  expectSnapshot: (pixels: Uint8ClampedArray, name: string) => Promise<void>;
  renderAndExpectSnapshot: (
    renderFn: (pass: GPURenderPassEncoder) => void,
    name: string
  ) => Promise<void>;
}

export const test = base.extend<VisualTestContext>({
  expectSnapshot: async ({}, use) => {
    // Setup snapshot testing
    const impl = async (pixels: Uint8ClampedArray, name: string) => {
      await expectSnapshot(pixels, { name, width: 256, height: 256 });
    };
    await use(impl);
  },

  renderAndExpectSnapshot: async ({}, use) => {
    // Setup render snapshot testing with cleanup
    // ...
  },
});
```

**Subtasks:**
1. Create custom vitest test extension with snapshot context
2. Handle --update-snapshots CLI flag
3. Integrate with vitest's snapshot workflow
4. Provide clear error messages on failure
5. Clean up actual/diff on successful runs (optional)

**Test Cases:**
- Custom test fixtures work
- --update flag updates baselines
- Test failures show helpful messages
- Cleanup works correctly

---

### Task 5: CLI & Workflow

**File:** `packages/engine/package.json`

Add test scripts:

```json
{
  "scripts": {
    "test:visual": "vitest run --testPathPattern=visual",
    "test:visual:update": "vitest run --testPathPattern=visual --update-snapshots",
    "test:visual:watch": "vitest --testPathPattern=visual"
  }
}
```

**Documentation:** `docs/testing-visual.md`

```markdown
# Visual Regression Testing

## Running Visual Tests

\`\`\`bash
# Run visual tests
npm run test:visual

# Update baselines (after manual review)
npm run test:visual:update

# Watch mode for development
npm run test:visual:watch
\`\`\`

## Reviewing Failures

When a visual test fails:

1. Check `tests/__snapshots__/actual/test-name.png` - what was rendered
2. Check `tests/__snapshots__/diff/test-name.png` - highlighted differences
3. If change is expected:
   - Run `npm run test:visual:update` to update baseline
4. If change is unexpected:
   - Fix the rendering code
   - Re-run tests

## Creating New Visual Tests

\`\`\`typescript
import { test } from '../helpers/visual-testing';

test('renders skybox correctly', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    (pass) => {
      // ... render skybox
    },
    'skybox-basic'
  );
});
\`\`\`
```

**Subtasks:**
1. Add npm scripts for visual testing
2. Document workflow for running tests
3. Document workflow for reviewing failures
4. Document workflow for updating baselines
5. Provide examples of visual tests

---

### Task 6: Example Visual Tests

**File:** `packages/engine/tests/visual/basic-rendering.test.ts`

Create example visual tests:

```typescript
import { test } from '../helpers/visual-testing';
import { createRenderTestSetup } from '@quake2ts/test-utils';

test('renders clear color', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    (pass) => {
      // Pass does nothing, just clears to red
    },
    'clear-red'
  );
});

test('renders single triangle', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    (pass) => {
      const pipeline = createSimpleTrianglePipeline();
      pass.setPipeline(pipeline);
      pass.draw(3);
    },
    'triangle-simple'
  );
});
```

**Subtasks:**
1. Create basic visual test file
2. Test clear color (simplest case)
3. Test simple triangle rendering
4. Generate initial baselines
5. Verify tests fail when rendering changes
6. Verify tests pass when rendering is correct

**Test Cases:**
- Clear color test passes
- Triangle test passes
- Changing clear color fails test
- Updating baseline makes test pass again

---

## Deliverables

### New Files Created
- `packages/test-utils/src/visual/snapshots.ts` (~400 lines)
- `packages/engine/tests/helpers/visual-testing.ts` (~150 lines)
- `packages/engine/tests/visual/basic-rendering.test.ts` (~100 lines)
- `docs/testing-visual.md` (documentation)

### Modified Files
- `packages/test-utils/package.json` (add pngjs, pixelmatch)
- `packages/engine/package.json` (add test scripts)
- `packages/test-utils/src/index.ts` (export snapshot utilities)

### Directories Created
- `packages/engine/tests/__snapshots__/baselines/`
- `packages/engine/tests/__snapshots__/actual/`
- `packages/engine/tests/__snapshots__/diff/`

---

## Testing Strategy

### Unit Tests

Test snapshot utilities in isolation:

```typescript
test('PNG round-trip preserves data', async () => {
  const original = new Uint8ClampedArray([255, 0, 0, 255]);
  await savePNG(original, 1, 1, '/tmp/test.png');
  const loaded = await loadPNG('/tmp/test.png');
  expect(loaded.data).toEqual(original);
});

test('pixelmatch detects differences', async () => {
  const img1 = new Uint8ClampedArray([255, 0, 0, 255]);
  const img2 = new Uint8ClampedArray([0, 255, 0, 255]);
  const result = await compareSnapshots(img1, img2, 1, 1);
  expect(result.passed).toBe(false);
  expect(result.pixelsDifferent).toBeGreaterThan(0);
});
```

### Integration Tests

Use visual tests to test the visual testing framework:

```typescript
test('visual test passes for identical renders', async () => {
  // Render same scene twice, should pass
});

test('visual test fails for different renders', async () => {
  // Render different scenes, should fail
});
```

---

## Success Criteria

- [ ] Can capture framebuffer as PNG
- [ ] Can compare PNG snapshots with pixelmatch
- [ ] Diff images generated on failure
- [ ] Baseline update workflow works
- [ ] Vitest integration complete
- [ ] CLI commands work
- [ ] Documentation complete
- [ ] Example visual tests pass

---

## References

**Dependencies:**
- [pixelmatch](https://github.com/mapbox/pixelmatch) - Fast pixel-level image comparison
- [pngjs](https://github.com/lukeapage/pngjs) - PNG encoder/decoder

**Inspiration:**
- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Jest Image Snapshot](https://github.com/americanexpress/jest-image-snapshot)

---

## Notes for Implementer

- **Threshold Tuning:** Start with 0.1% tolerance. May need adjustment for anti-aliased content.
- **Performance:** PNG encoding/decoding is fast enough for tests. No optimization needed initially.
- **Baseline Management:** Store baselines in git. Actual/diff should be gitignored.
- **CI/CD:** Visual tests should run in CI. Failures mean something changed - review needed.
- **Platform Differences:** GPU drivers may produce slightly different output. Threshold accounts for this.
- **Baseline Approval:** Manual review required before updating baselines. Don't auto-update in CI.

---

**Next Section:** [20-5: Sprite/2D Renderer (First Pipeline)](section-20-5.md)
