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
- [x] Nearest vs linear filtering (`textures/filtering.test.ts`)
- [x] Mipmap generation and sampling (`textures/filtering.test.ts`)
- [ ] Anisotropic filtering (if supported) - *Skipped for now as basic filtering covers most cases.*

### Texture Wrapping (~2 tests)
- [x] Repeat, clamp, mirror modes (`textures/wrapping.test.ts`)
- [x] Non-power-of-2 textures (`textures/wrapping.test.ts`)

### Material Properties (~3 tests)
- [x] Emissive/Tinting materials (`textures/materials.test.ts`)
- [ ] Specular properties - *Requires full 3D lighting setup, deferred to later phases.*
- [x] Material parameter blending - *Covered by tinting tests.*

---

## Deliverables
- `tests/webgl/visual/textures/filtering.test.ts`
- `tests/webgl/visual/textures/wrapping.test.ts`
- `tests/webgl/visual/textures/materials.test.ts`
- ~8 visual tests

---

**Next Section:** [21-5: Skybox Rendering](section-21-5.md)
