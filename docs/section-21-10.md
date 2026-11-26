# Section 21-10: MD3 Skeletal Models

**Phase:** 3 (Core 3D)
**Priority:** HIGH
**Dependencies:** 21-1, 21-4
**Estimated Effort:** 3 days

---

## Overview

Validate MD3 skeletal model rendering including multi-surface meshes, model attachments (tags), and per-surface materials.

**Renderer Components:**
- `packages/engine/src/render/md3Pipeline.ts` (`Md3Pipeline` class)
- `packages/assets/md3.ts` (`Md3Model` structure)
- `packages/engine/src/render/scene.ts` (`RenderableMd3` entity type)

---

## Visual Tests

### Basic MD3 Rendering (~3 tests)
1. Single-surface MD3 model
2. Multi-surface MD3 model (head, torso, legs)
3. Frame interpolation between poses

### Model Attachments (~3 tests)
1. Weapon attached to hand tag
2. Head attached to torso tag
3. Complex attachment hierarchy

### Per-Surface Materials (~2 tests)
1. Different textures per surface
2. Material properties per surface

### Lighting & Tinting (~2 tests)
1. Per-surface tinting
2. Lighting on multi-surface models

---

## Deliverables
- `tests/webgl/visual/models/md3-basic.test.ts`
- `tests/webgl/visual/models/md3-attachments.test.ts`
- ~10 visual tests

---

**Next Section:** [21-11: Dynamic Lighting System](section-21-11.md)
