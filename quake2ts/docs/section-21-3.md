# Section 21-3: 2D Rendering (Sprites, UI, Text)

**Phase:** 2 (Basic Rendering)
**Priority:** HIGH
**Dependencies:** 21-1
**Estimated Effort:** 2-3 days

---

## Overview

Validate 2D rendering functionality including sprites, UI elements, text rendering, and filled rectangles. Tests the `SpriteRenderer` class and 2D drawing API exposed by the renderer.

**Renderer Components:**
- `packages/engine/src/render/sprite.ts` (`SpriteRenderer` class)
- `packages/engine/src/render/renderer.ts` (2D API: `begin2D`, `drawPic`, `drawString`, `drawfillRect`, `end2D`)
- `packages/engine/src/render/interface.ts` (`IRenderer` 2D methods)

---

## Objectives

1. Validate sprite rendering with textures
2. Test filled rectangle drawing (solid colors)
3. Verify text rendering with font textures
4. Test texture sampling and filtering
5. Validate 2D coordinate system (screen space)
6. Test alpha blending for UI elements

---

## Test Files Structure

```
tests/webgl/visual/2d/
├── sprites.test.ts          # Sprite/texture rendering
├── text.test.ts             # Text rendering
└── ui-elements.test.ts      # Rectangles, UI primitives
```

---

## Tasks

### Task 1: Sprite Rendering Tests

**File:** `tests/webgl/visual/2d/sprites.test.ts`

**Visual Tests:**

1. **Sprite: Textured quad - checkerboard**
   - Create 128x128 checkerboard texture (red/black, 16x16 cells)
   - Render centered 128x128 sprite
   - Validate texture sampling, filtering

2. **Sprite: Texture wrapping modes**
   - Create small 32x32 texture
   - Render 256x256 sprite (oversize)
   - Validate repeat/clamp behavior

3. **Sprite: Multiple sprites - batch rendering**
   - Render 4 different colored sprites in grid
   - Validate batching, draw call efficiency
   - Verify z-ordering (overlapping sprites)

4. **Sprite: Alpha blending**
   - Render semi-transparent sprite over background
   - Validate alpha blending equation
   - Test premultiplied vs straight alpha

**Implementation Pattern:**

```typescript
import { test, beforeAll } from 'vitest';
import { createRenderer } from '../../../src/render/renderer';
import { createWebGLRenderTestSetup } from '@quake2ts/test-utils';
import { expectSnapshot } from '@quake2ts/test-utils';
import { createCheckerboardTexture } from '@quake2ts/test-utils';
import path from 'path';

const snapshotDir = path.join(__dirname, '..', '__snapshots__');

test('sprite: textured quad - checkerboard', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Create checkerboard texture
  const texData = createCheckerboardTexture(128, 128, 16, [1,0,0,1], [0,0,0,1]);
  const pic = renderer.uploadPic('test-checker', texData, 128, 128);

  // Clear and render
  setup.gl.clearColor(0, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  renderer.drawPic(64, 64, 128, 128, pic);
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-sprite-checkerboard',
    description: 'Red/black checkerboard sprite centered on black background',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});
```

**Subtasks:**
1. Create test file with imports
2. Implement each visual test
3. Generate procedural textures (avoid external assets)
4. Capture and compare snapshots
5. Document expected visual output

**Assets Needed:**
- None (procedural generation via `createCheckerboardTexture`, etc.)

---

### Task 2: UI Elements Tests

**File:** `tests/webgl/visual/2d/ui-elements.test.ts`

**Visual Tests:**

1. **UI: Filled rectangle - solid color**
   - Render blue rectangle on black background
   - Validate `drawfillRect` implementation

2. **UI: Multiple rectangles - overlapping**
   - Render 3 overlapping rectangles (red, green, blue)
   - Validate painter's algorithm (last drawn on top)

3. **UI: Rectangle with transparency**
   - Render semi-transparent rectangle over background pattern
   - Validate alpha blending

4. **UI: Full-screen gradient**
   - Render multiple rectangles to create gradient effect
   - Validate color interpolation

**Implementation Notes:**
- Use `renderer.drawfillRect(x, y, width, height, [r, g, b, a])`
- Clear to known background color
- Test different blend modes if supported

**Subtasks:**
1. Implement solid rectangle test
2. Implement overlapping rectangles test
3. Implement transparency test
4. Implement gradient test
5. Generate baselines and review

---

### Task 3: Text Rendering Tests

**File:** `tests/webgl/visual/2d/text.test.ts`

**Visual Tests:**

1. **Text: Simple string - monospace font**
   - Load or generate 8x8 font texture
   - Render "HELLO WORLD" text
   - Validate character spacing, positioning

2. **Text: Multi-line text**
   - Render 3 lines of text
   - Validate line height, alignment

3. **Text: Colored text**
   - Render text with different colors
   - Validate color modulation

**Implementation Notes:**
- May need simple bitmap font (8x8 ASCII)
- Can generate procedural font texture if needed
- Use `renderer.drawString(x, y, text)` or similar API
- Check if font rendering is part of `SpriteRenderer` or separate

**Subtasks:**
1. Create or locate bitmap font texture
2. Implement text rendering tests
3. Validate character glyph rendering
4. Check spacing and kerning

**Assets Needed:**
- Simple bitmap font (can use procedural 8x8 glyphs)
- Or use existing font from pak.pak if available

---

## Deliverables

### Test Files Created
- `tests/webgl/visual/2d/sprites.test.ts` (~150 lines, 4 tests)
- `tests/webgl/visual/2d/ui-elements.test.ts` (~120 lines, 4 tests)
- `tests/webgl/visual/2d/text.test.ts` (~100 lines, 3 tests)

### Baseline Images (~11 images)
- `__snapshots__/baselines/2d-sprite-*.png`
- `__snapshots__/baselines/2d-ui-*.png`
- `__snapshots__/baselines/2d-text-*.png`

---

## Success Criteria

- [ ] All sprite rendering tests pass
- [ ] Texture sampling works correctly
- [ ] UI rectangles render with correct colors
- [ ] Alpha blending produces expected results
- [ ] Text renders legibly (if text API exists)
- [ ] Baselines reviewed and approved
- [ ] ~11 visual tests passing

---

## Notes for Implementer

- **Coordinate System:** Verify 2D coordinate origin (top-left vs bottom-left)
- **Texture Upload:** Use `renderer.uploadPic()` or similar to create GPU textures
- **Cleanup:** Dispose textures after tests to avoid leaks
- **Determinism:** Avoid time-based animations in snapshot tests
- **Font Rendering:** Check renderer API - text rendering may be implemented differently

---

**Next Section:** [21-4: Texture & Material System](section-21-4.md)
