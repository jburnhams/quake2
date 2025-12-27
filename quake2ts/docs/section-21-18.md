# Section 21-18: Render Modes & Overrides

**Phase:** 5 (Integration)
**Priority:** LOW
**Dependencies:** 21-6, 21-9, 21-10
**Estimated Effort:** 1-2 days

---

## Overview

Validate render mode overrides including wireframe, solid color, faceted, and entity/surface highlighting.

**Renderer Components:**
- `packages/engine/src/render/frame.ts` (`RenderModeConfig`, `RenderMode`)
- `packages/engine/src/render/renderer.ts` (render mode application, highlighting)
- `packages/engine/src/render/options.ts` (`RenderOptions`)

---

## Visual Tests

### Render Modes (~4 tests)
1. Textured mode (default)
2. Wireframe mode
3. Solid color mode
4. Faceted mode (per-triangle colors)

### Overrides (~3 tests)
1. Global color override
2. Random color generation (per-entity ID)
3. Partial override (missing textures only)

### Highlighting (~2 tests)
1. Entity highlighting
2. Surface highlighting

---

## Deliverables
- `tests/webgl/visual/integration/render-modes.test.ts`
- ~9 visual tests

---

**Next Section:** [21-19: Full Scene Integration Tests](section-21-19.md)
