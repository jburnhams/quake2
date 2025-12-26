# Section 21-5: Skybox Rendering

**Phase:** 2 (Basic Rendering)
**Priority:** HIGH
**Dependencies:** 21-1
**Estimated Effort:** 1-2 days

---

## Overview

Validate skybox rendering including cubemap application, texture scrolling, and depth testing behavior.

**Renderer Components:**
- `packages/engine/src/render/skybox.ts` (`SkyboxPipeline` class)
- `packages/engine/src/render/frame.ts` (skybox rendering in `renderSky`)

---

## Visual Tests

### Basic Skybox (~2 tests)
1. 6-sided cubemap skybox
2. Skybox without translation (stays at infinite distance)

### Scrolling Textures (~3 tests)
1. Horizontal scroll at different speeds
2. Vertical scroll
3. Multi-layer scrolling (parallax)

### Depth Behavior (~2 tests)
1. Skybox renders behind all geometry
2. Depth mask disabled during render

---

## Deliverables
- `tests/webgl/visual/skybox/basic.test.ts`
- `tests/webgl/visual/skybox/scrolling.test.ts`
- ~7 visual tests

---

**Next Section:** [21-6: BSP World Geometry & Lightmaps](section-21-6.md)
