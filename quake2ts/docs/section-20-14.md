# Section 20-14: Debug Rendering

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 20-6 (Frame Orchestration)
**Estimated Effort:** 2-3 days

---

## Overview

Implement debug visualization: wireframe, bounding boxes, normals, PVS visualization.

**Reference Implementation:** `packages/engine/src/render/debug.ts` (469 lines)

---

## Tasks

### Task 1: Debug Pipelines

**File:** `pipelines/debug.ts`

**Pipelines:**
1. **Wireframe** - Line topology, no fill
2. **Bounding Boxes** - Axis-aligned boxes
3. **Normals** - Lines from vertices
4. **PVS Visualization** - Highlight visible surfaces

### Task 2: WGSL Shaders

**File:** `shaders/debug.wgsl`

Simple solid-color shaders for each debug mode.

### Task 3: Integration

Add debug rendering controls to IWebGPURenderer interface.

### Task 4: Testing

**Visual Tests:**
- `debug-wireframe.png`
- `debug-bounds.png`
- `debug-normals.png`

**Reference:** `packages/engine/src/render/debug.ts`

---

**Next Section:** [20-15: Extended Renderer Interface](section-20-15.md)
