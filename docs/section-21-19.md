# Section 21-19: Full Scene Integration Tests

**Phase:** 5 (Integration)
**Priority:** LOW
**Dependencies:** All previous sections
**Estimated Effort:** 3-4 days

---

## Overview

Validate complete scene rendering combining all features: BSP geometry, models, particles, lighting, effects, and post-processing.

**Renderer Components:**
- All renderer components integrated via `packages/engine/src/render/renderer.ts`

---

## Visual Tests

### Complex Scenes (~5 tests)
1. **Indoor scene:** BSP walls, lightmaps, dynamic lights, MD3 character
2. **Outdoor scene:** Skybox, BSP terrain, MD2 models, particles
3. **Underwater scene:** Water surfaces, warp effect, tinted rendering, bubbles
4. **Combat scene:** Multiple characters, muzzle flashes, explosions, blood particles
5. **Night scene:** Heavy dynamic lighting, light styles, bloom on bright surfaces

### All Features Combined (~3 tests)
1. BSP + models + particles + lights + effects + post-processing
2. Transparent surfaces + warp + models + particles
3. Debug modes on complex scenes

### Performance Validation (~2 tests)
1. Many entities (stress test)
2. Many dynamic lights (stress test)

---

## Implementation Notes

- Use actual game assets from pak.pak
- Create representative game scenarios
- These are the most valuable tests (catch integration bugs)
- Baselines require careful review
- May need larger render targets (512x512 or 1024x1024)

---

## Deliverables

- `tests/webgl/visual/integration/full-scene.test.ts`
- ~10 visual tests
- High-value integration coverage

---

## Success Criteria

- [ ] All rendering features work together
- [ ] No visual artifacts in complex scenes
- [ ] Performance remains acceptable
- [ ] Render order correct (skybox, opaque, transparent, particles, post-FX)
- [ ] All integration tests passing

---

**End of Section 21 Documentation**

All subsections complete. Return to [Section 21-0: Master Overview](section-21-0.md)
