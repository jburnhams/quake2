# Section 20-10: MD3 Model Pipeline

**Phase:** 3 (Core Pipelines)
**Priority:** HIGH
**Dependencies:** 20-2 (Resources), 20-6 (Frame Orchestration)
**Estimated Effort:** 4-5 days

---

## Overview

Implement MD3 skeletal model rendering with per-surface materials and lighting.

**Reference Implementation:** `packages/engine/src/render/md3Pipeline.ts` (508 lines)

---

## Tasks

### Task 1: WGSL Shader

**File:** `shaders/md3.wgsl`

Similar to MD2 but with:
- Skeletal transformation matrices
- Per-surface materials
- Multi-pass rendering for different surfaces
- Vertex color support for pre-computed lighting

**Reference:** `md3Pipeline.ts` lines 42-150

**Status:** Completed.

### Task 2: Md3Pipeline Implementation

**File:** `pipelines/md3Pipeline.ts`

**Subtasks:**
1. Hierarchical model structure
2. Tag-based attachments
3. Per-surface rendering
4. Material system
5. Dynamic lighting (via CPU-side vertex color calculation passed to shader)

**Status:** Completed.

### Task 3: Testing

**Visual Tests:**
- `md3-single-surface.png` - Single surface rendering
- `md3-attachment.png` - Model attachment via tags
- `md3-lighting.png` - Dynamic lighting verification

**Reference:** `packages/engine/src/render/md3Pipeline.ts`

**Status:** Completed.

---

**Next Section:** [20-11: Particle System](section-20-11.md)
