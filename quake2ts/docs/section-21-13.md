# Section 21-13: Particle Systems

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 21-1
**Estimated Effort:** 2-3 days

---

## Overview

Validate particle system rendering including emission, physics simulation, rendering, and blending.

**Renderer Components:**
- `packages/engine/src/render/particleSystem.ts` (`ParticleSystem`, `ParticleRenderer`)
- `packages/engine/src/render/renderer.ts` (particle rendering integration)

---

## Visual Tests

### Particle Types (~4 tests)
1. Point particles (explosions)
2. Line particles (trails)
3. Textured particles
4. Colored particles

### Particle Behaviors (~4 tests)
1. Gravity-affected particles
2. Particle lifetime/fade
3. Particle size variation
4. Velocity-based motion

### Blending & Effects (~3 tests)
1. Additive blending (fire, explosions)
2. Alpha blending (smoke)
3. Particle sorting (depth)

---

## Deliverables
- `tests/webgl/visual/effects/particles.test.ts`
- ~11 visual tests

---

**Next Section:** [21-14: Post-Processing (Underwater Warp)](section-21-14.md)
