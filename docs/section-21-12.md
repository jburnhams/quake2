# Section 21-12: Light Styles & Animation

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 21-6, 21-11
**Estimated Effort:** 2 days

---

## Overview

Validate animated lightmap styles including pulsing, flickering, and custom patterns.

**Renderer Components:**
- `packages/engine/src/render/lightStyles.ts` (light style patterns)
- `packages/engine/src/render/bspPipeline.ts` (style application)
- `packages/engine/src/render/frame.ts` (lightmap style blending)

---

## Visual Tests

### Style Patterns (~4 tests)
1. Steady light (pattern 'a')
2. Pulsing light (sine wave)
3. Flickering light (random pattern)
4. Strobing light (on/off pattern)

### Multiple Styles (~3 tests)
1. Surface with 2 simultaneous styles
2. Surface with 4 styles (max)
3. Style override system

### Animation (~2 tests)
1. Style progression over time
2. Synchronized multi-surface styles

---

## Deliverables
- `tests/webgl/visual/lighting/light-styles.test.ts`
- ~9 visual tests

---

**Next Section:** [21-13: Particle Systems](section-21-13.md)
