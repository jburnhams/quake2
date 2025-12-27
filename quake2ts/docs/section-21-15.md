# Section 21-15: Bloom Effects

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 21-6
**Estimated Effort:** 2 days

---

## Overview

Validate bloom post-processing including bright pass extraction, blur, and additive composition.

**Renderer Components:**
- `packages/engine/src/render/bloom.ts` (`BloomPipeline`)
- `packages/engine/src/render/frame.ts` (bloom integration)

---

## Visual Tests

### Bloom Pipeline (~5 tests)
1. Bright pass extraction (threshold)
2. Horizontal blur pass
3. Vertical blur pass (two-pass blur)
4. Additive composition
5. Bloom intensity control

### Edge Cases (~2 tests)
1. Bloom with no bright pixels
2. Bloom with fully bright scene

---

## Deliverables
- `tests/webgl/visual/effects/bloom.test.ts`
- ~7 visual tests

---

**Next Section:** [21-16: Debug Rendering & Visualization](section-21-16.md)
