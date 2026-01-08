# Section 20-13: Post-Processing & Effects

## ⏳ NOT STARTED

**Status:** Future work - Phase 4 (Advanced Features)

**Prerequisites:**
- Section 20-6 (Frame Orchestration) ✅ COMPLETED
- All core rendering pipelines operational

**Scope Notes:**
- This section will implement render settings that are currently stubbed in Section 20-6
- The WebGL reference implementation exists at `packages/engine/src/render/postProcess.ts`
- Will require render-to-texture infrastructure for intermediate framebuffers

---

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 20-6 (Frame Orchestration)
**Estimated Effort:** 3-4 days

---

## Overview

Implement post-processing effects like underwater distortion and gamma correction.

**Reference Implementation:** `packages/engine/src/render/postProcess.ts`

---

## Tasks

### Task 1: Post-Process Pipeline

**File:** `pipelines/postProcess.ts`

**Subtasks:**
1. Fullscreen quad rendering
2. Framebuffer texture sampling
3. Underwater warping effect
4. Gamma correction
5. Brightness adjustment

### Task 2: WGSL Shaders

**File:** `shaders/postProcess.wgsl`

**Effects:**
- Underwater: sinusoidal UV distortion
- Gamma: `pow(color.rgb, vec3f(1.0 / gamma))`
- Brightness: linear scaling

### Task 3: Render-to-Texture

**Subtasks:**
1. Create intermediate framebuffer
2. Render scene to texture
3. Apply post-process shader
4. Present to screen

### Task 4: Testing

**Visual Tests:**
- `post-underwater.png`
- `post-gamma.png`
- `post-brightness.png`

**Reference:** `packages/engine/src/render/postProcess.ts`

---

**Next Section:** [20-14: Debug Rendering](section-20-14.md)
