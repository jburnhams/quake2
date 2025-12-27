# Section 21-4: Texture & Material System

**Phase:** 2 (Basic Rendering)
**Priority:** HIGH
**Dependencies:** 21-1
**Estimated Effort:** 1-2 days

---

## Overview

Validate texture loading, sampling, filtering, and material property application. Tests the foundation for all textured rendering.

**Renderer Components:**
- `packages/engine/src/render/resources.ts` (`Texture2D` class)
- `packages/engine/src/render/materials.ts` (`MaterialManager`, material properties)
- `packages/engine/src/render/materialLoader.ts` (material loading)

---

## Visual Tests

### Texture Filtering (~3 tests)
1. Nearest vs linear filtering
2. Mipmap generation and sampling
3. Anisotropic filtering (if supported)

### Texture Wrapping (~2 tests)
1. Repeat, clamp, mirror modes
2. Non-power-of-2 textures

### Material Properties (~3 tests)
1. Emissive materials (self-lit)
2. Specular properties
3. Material parameter blending

---

## Deliverables
- `tests/webgl/visual/textures/filtering.test.ts`
- `tests/webgl/visual/textures/materials.test.ts`
- ~8 visual tests

---

**Next Section:** [21-5: Skybox Rendering](section-21-5.md)
