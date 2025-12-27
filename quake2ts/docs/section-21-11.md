# Section 21-11: Dynamic Lighting System

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 21-6
**Estimated Effort:** 2-3 days

---

## Overview

Validate dynamic point light rendering, light accumulation, culling, and attenuation.

**Renderer Components:**
- `packages/engine/src/render/dlight.ts` (`DLight` interface)
- `packages/engine/src/render/lightCulling.ts` (`cullLights`)
- `packages/engine/src/render/light.ts` (`calculateEntityLight`)
- `packages/engine/src/render/bspPipeline.ts` (dynamic light application)

---

## Visual Tests

### Point Lights (~4 tests)
1. Single colored point light on surface
2. Multiple point lights (different colors)
3. Light attenuation over distance
4. Light intensity variations

### Light Accumulation (~3 tests)
1. Overlapping light volumes
2. Additive blending validation
3. Oversaturation clamping

### Light Culling (~2 tests)
1. Lights outside frustum culled
2. Lights too far from geometry culled

---

## Deliverables
- `tests/webgl/visual/lighting/dynamic-lights.test.ts`
- ~9 visual tests

---

**Next Section:** [21-12: Light Styles & Animation](section-21-12.md)
