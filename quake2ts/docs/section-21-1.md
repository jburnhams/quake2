# Section 21-1: Infrastructure & Test Utilities

**Phase:** 1 (Foundation)
**Priority:** CRITICAL
**Dependencies:** None (start first)
**Estimated Effort:** 3-5 days

---

## Overview

Establish the foundational infrastructure for headless WebGL visual testing. This includes headless WebGL context creation, framebuffer readback, test helpers, and integration with the existing snapshot testing framework.

**Reference Implementation:**
- `packages/test-utils/src/setup/webgpu.ts` (WebGPU equivalent)
- `packages/test-utils/src/engine/helpers/webgpu-rendering.ts` (WebGPU helpers)

---

## Objectives

1. Create headless WebGL context using `gl` package
2. Implement framebuffer readback to capture rendered pixels
3. Build test helpers for WebGL rendering setup
4. Refactor snapshot utilities to be renderer-agnostic
5. Provide similar API to WebGPU test infrastructure

---

## Tasks

### Task 1: Headless WebGL Context Creation

**File:** `packages/test-utils/src/setup/headless-webgl.ts`

Implement headless WebGL context initialization:

```typescript
interface HeadlessWebGLOptions {
  width?: number;
  height?: number;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
}

interface HeadlessWebGLContext {
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  cleanup: () => void;
}

function createHeadlessWebGL(
  options?: HeadlessWebGLOptions
): HeadlessWebGLContext
```

**Subtasks:**
1. Import and configure `gl` package
2. Create WebGL2 context with specified dimensions
3. Configure context attributes (antialias off for determinism, preserveDrawingBuffer true)
4. Set default viewport
5. Verify context creation succeeded
6. Provide cleanup function to release resources
7. Return context state object

**Implementation Notes:**
- Use `gl(width, height, options)` from `gl` package
- Cast to `WebGL2RenderingContext` for TypeScript
- Default to 256x256 for consistency with WebGPU tests
- Disable antialiasing for deterministic pixel comparisons
- Enable `preserveDrawingBuffer: true` for readback

**Test Cases:**
- Successfully creates WebGL2 context
- Context has correct dimensions
- Context is usable (can create buffers, textures)
- Cleanup releases resources
- Multiple contexts can be created sequentially

---

### Task 2: Framebuffer Readback

**File:** Same as Task 1

Implement pixel readback from default framebuffer:

```typescript
function captureWebGLFramebuffer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): Uint8ClampedArray

function flipPixelsVertically(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray
```

**Subtasks:**
1. Allocate Uint8ClampedArray for pixel data (width * height * 4)
2. Call `gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)`
3. Flip pixels vertically (WebGL origin is bottom-left, images are top-left)
4. Return flipped pixel array
5. Handle any GL errors during readback

**Implementation Notes:**
- WebGL `readPixels` returns pixels bottom-up
- Must flip vertically to match PNG/image convention (top-down)
- Flip by reversing rows: `for y in 0..height { copy row[height-1-y] }`
- This matches WebGPU output convention

**Test Cases:**
- Reads pixels from framebuffer
- Pixel data has correct size (width * height * 4)
- Vertical flip produces correct orientation
- Can read from colored framebuffer (clear to red, verify pixels)

---

### Task 3: WebGL Rendering Test Helpers

**File:** `packages/test-utils/src/engine/helpers/webgl-rendering.ts`

Create helpers for WebGL rendering tests:

```typescript
interface WebGLRenderTestSetup {
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  cleanup: () => void;
}

async function createWebGLRenderTestSetup(
  width?: number,
  height?: number
): Promise<WebGLRenderTestSetup>

async function renderAndCaptureWebGL(
  setup: WebGLRenderTestSetup,
  renderFn: (gl: WebGL2RenderingContext) => void
): Promise<Uint8ClampedArray>
```

**Subtasks:**
1. Wrap `createHeadlessWebGL` for test usage
2. Provide default dimensions (256x256)
3. Create `renderAndCaptureWebGL` that:
   - Calls user render function
   - Finishes all GL commands (`gl.finish()`)
   - Captures framebuffer pixels
   - Returns pixel array
4. Ensure cleanup is called properly
5. Provide TypeScript types for all exports

**Implementation Notes:**
- Similar pattern to `createRenderTestSetup` in `webgpu-rendering.ts`
- Call `gl.finish()` before readback to ensure rendering completes
- Return setup object for flexibility (user can render multiple frames)

**Test Cases:**
- Creates test setup successfully
- Render function is called
- Captured pixels reflect rendered content
- Cleanup works properly
- Can reuse setup for multiple render calls

---

### Task 4: Renderer-Agnostic Snapshot Utilities

**File:** `packages/test-utils/src/visual/snapshots.ts` (modify existing)

Refactor snapshot utilities to work with both WebGL and WebGPU:

**Subtasks:**
1. Review current `expectSnapshot` implementation
2. Ensure it accepts `Uint8ClampedArray` (already does)
3. No changes needed if already renderer-agnostic
4. If WebGPU-specific code exists, extract to separate helpers
5. Document that `expectSnapshot` works with any renderer

**Implementation Notes:**
- Current `expectSnapshot` already accepts pixel arrays
- `savePNG`, `loadPNG`, `compareSnapshots` are renderer-agnostic
- Only GPU-specific code is `captureFramebufferAsPNG` (WebGPU)
- Keep WebGPU helpers in `webgpu-rendering.ts`
- Keep WebGL helpers in `webgl-rendering.ts`
- `snapshots.ts` remains agnostic

**Test Cases:**
- WebGPU tests still work (no regression)
- WebGL pixel arrays work with `expectSnapshot`
- PNG saving/loading works for both
- Comparison works identically

---

### Task 5: Shared Rendering Utilities

**File:** `packages/test-utils/src/shared/rendering-common.ts` (new)

Create common utilities shared between WebGL and WebGPU tests:

```typescript
// Procedural texture generation
function createCheckerboardTexture(
  width: number,
  height: number,
  cellSize: number,
  color1: [number, number, number, number],
  color2: [number, number, number, number]
): Uint8ClampedArray

function createSolidColorTexture(
  width: number,
  height: number,
  color: [number, number, number, number]
): Uint8ClampedArray

function createGradientTexture(
  width: number,
  height: number,
  from: [number, number, number, number],
  to: [number, number, number, number]
): Uint8ClampedArray

// Test data helpers
function createTestVertices(count: number): Float32Array
function createTestIndices(count: number): Uint16Array
```

**Subtasks:**
1. Implement procedural texture generation functions
2. Add common test data generators
3. Document usage patterns
4. Export from test-utils index

**Implementation Notes:**
- Avoid loading external assets in simple tests
- Generate test data programmatically
- Checkerboard useful for texture filtering tests
- Solid colors for basic validation
- Gradients for interpolation testing

**Test Cases:**
- Generated textures have correct dimensions
- Pixel values match expected colors
- Test data has correct formats

---

### Task 6: Package Configuration

**File:** `packages/engine/package.json`

Add dependencies and test scripts:

**Subtasks:**
1. Add `gl` package to `devDependencies`:
   ```json
   "gl": "^6.0.2"
   ```
2. Add `@types/gl` if available (check npm)
3. Add test script for WebGL visual tests:
   ```json
   "test:webgl": "cross-env TEST_TYPE=webgl vitest run"
   ```
4. Verify existing dependencies are sufficient (vitest, pngjs, pixelmatch)

**File:** `packages/test-utils/package.json`

Add `gl` package:

**Subtasks:**
1. Add `gl` to `devDependencies` (same version as engine)
2. No changes to exports needed (helpers exported from index)

**Implementation Notes:**
- Use `cross-env` for environment variable (already in dependencies)
- `TEST_TYPE=webgl` used in vitest config to filter tests
- Similar pattern to `test:webgpu` script

---

### Task 7: Vitest Configuration

**File:** `packages/engine/vitest.config.ts` (modify if needed)

Configure test filtering for WebGL visual tests:

**Subtasks:**
1. Check existing vitest config
2. Ensure `TEST_TYPE` environment variable filtering works
3. WebGL tests should run when `TEST_TYPE=webgl`
4. Pattern should match `tests/webgl/visual/**/*.test.ts`
5. Document test organization in README

**Implementation Notes:**
- Likely already configured for WebGPU tests
- Use same pattern for WebGL
- Tests self-filter based on `TEST_TYPE` env var

---

## Deliverables

### New Files Created
- `packages/test-utils/src/setup/headless-webgl.ts` (~150 lines)
- `packages/test-utils/src/engine/helpers/webgl-rendering.ts` (~200 lines)
- `packages/test-utils/src/shared/rendering-common.ts` (~150 lines)

### Modified Files
- `packages/test-utils/src/visual/snapshots.ts` (minor refactor if needed)
- `packages/engine/package.json` (add dependencies, scripts)
- `packages/test-utils/package.json` (add dependencies)
- `packages/test-utils/src/index.ts` (export new utilities)

### Tests Created
- `packages/test-utils/tests/setup/headless-webgl.test.ts` (~100 lines)
  - Context creation tests
  - Framebuffer readback tests
  - Cleanup tests

---

## Testing Strategy

### Unit Tests

Test infrastructure without renderer:

```typescript
import { describe, test, expect } from 'vitest';
import { createHeadlessWebGL, captureWebGLFramebuffer } from '../src/setup/headless-webgl';

test('creates headless WebGL context', () => {
  const { gl, width, height, cleanup } = createHeadlessWebGL();

  expect(gl).toBeDefined();
  expect(width).toBe(256);
  expect(height).toBe(256);

  cleanup();
});

test('captures framebuffer pixels', () => {
  const { gl, width, height, cleanup } = createHeadlessWebGL({ width: 64, height: 64 });

  // Clear to red
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const pixels = captureWebGLFramebuffer(gl, width, height);

  // Verify first pixel is red
  expect(pixels[0]).toBe(255);  // R
  expect(pixels[1]).toBe(0);    // G
  expect(pixels[2]).toBe(0);    // B
  expect(pixels[3]).toBe(255);  // A

  cleanup();
});
```

### Integration Tests

Test with actual renderer (deferred to section 21-3+):

```typescript
import { createRenderer } from '@quake2ts/engine';
import { createWebGLRenderTestSetup, renderAndCaptureWebGL } from '@quake2ts/test-utils';

test('renders with WebGL renderer', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Render frame
  renderer.begin2D();
  renderer.drawfillRect(0, 0, 256, 256, [1, 0, 0, 1]);
  renderer.end2D();

  const pixels = await renderAndCaptureWebGL(setup, () => {});

  // Verify red pixels
  expect(pixels[0]).toBe(255);

  setup.cleanup();
});
```

---

## Success Criteria

- [x] `gl` package installed and working
- [x] Can create headless WebGL2 context
- [x] Can read pixels from framebuffer
- [x] Vertical flip produces correct orientation
- [x] Test helpers mirror WebGPU helpers API
- [x] Snapshot utilities work with WebGL pixels
- [x] Common utilities available for both renderers
- [x] All infrastructure tests pass
- [x] Zero breaking changes to existing WebGPU tests

---

## Notes for Implementer

- **Context Options:** Disable antialiasing (`antialias: false`) for deterministic tests
- **Preserving Buffer:** Enable `preserveDrawingBuffer: true` for reliable readback
- **Orientation:** WebGL is bottom-up, must flip for PNG comparison
- **Cleanup:** Always call cleanup to avoid resource leaks
- **Type Safety:** Use proper TypeScript types, cast `gl` context if needed

---

**Next Section:** [21-2: CI/CD Pipeline & GitHub Pages](section-21-2.md)
