# Section 21-14: Post-Processing (Underwater Warp)

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 21-6
**Estimated Effort:** 1-2 days

---

## Overview

Validate post-processing underwater warp effect including framebuffer rendering, distortion shader, and full-screen quad rendering.

**Renderer Components:**
- `packages/engine/src/render/postprocessing/pipeline.ts` (`PostProcessPipeline`)
- `packages/engine/src/render/frame.ts` (post-process integration)

---

## Visual Tests

### Underwater Warp (~4 tests)
1. Basic warp distortion
2. Warp strength variations
3. Time-based animation
4. Warp + water tint color

### Framebuffer Operations (~2 tests)
1. Render-to-texture validation
2. Full-screen quad coverage

---

## Deliverables
- `tests/webgl/visual/effects/underwater-warp.test.ts`
- ~6 visual tests

---

**Next Section:** [21-15: Bloom Effects](section-21-15.md)
