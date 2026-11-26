# Section 20-9: MD2 Model Pipeline

## COMPLETED ✅ (Superseded by Section 22)

**Summary:** MD2 pipeline implemented with WGSL shader, frame interpolation, dynamic lighting, texture mapping, and backface culling. **Architecture updated by Section 22** to use CameraState and WebGPUMatrixBuilder for correct coordinate handling.

---

**Phase:** 3 (Core Pipelines)
**Priority:** HIGH
**Dependencies:** 20-2 (Resources), 20-6 (Frame Orchestration)
**Estimated Effort:** 4-5 days

---

## Overview

Implement MD2 character model rendering with frame interpolation and dynamic lighting.

**Reference Implementation:** `packages/engine/src/render/md2Pipeline.ts` (468 lines)

---

## Tasks

### Task 1: WGSL Shader with Frame Interpolation

**File:** `shaders/md2.wgsl`

```wgsl
struct VertexInput {
  @location(0) positionFrame1: vec3f,
  @location(1) normalFrame1: vec3f,
  @location(2) positionFrame2: vec3f,
  @location(3) normalFrame2: vec3f,
  @location(4) texcoord: vec2f,
}

// Interpolate between frames
var interpolatedPos = mix(positionFrame1, positionFrame2, u_frameBlend);
var interpolatedNormal = normalize(mix(normalFrame1, normalFrame2, u_frameBlend));
```

**Subtasks:**
1. [x] Dual-frame vertex input
2. [x] Frame interpolation in vertex shader
3. [x] Normal interpolation
4. [x] Dynamic lighting per vertex
5. [x] Texture mapping

**Reference:** `md2Pipeline.ts` lines 41-128

### Task 2: Md2Pipeline Implementation

**File:** `pipelines/md2Pipeline.ts`

**Subtasks:**
1. [x] Render pipeline with frame interpolation
2. [x] Dual vertex buffers (current/next frame)
3. [x] Frame blending uniform
4. [x] Texture binding
5. [x] Dynamic light support
6. [x] Backface culling

### Task 3: Integration & Testing

**Visual Tests:**
- `md2-static.png` - Single frame
- `md2-interpolated.png` - Mid-frame blend
- `md2-lit.png` - With dynamic light

**Test Cases:**
- [x] Frame interpolation smooth
- [x] Normals interpolate correctly
- [x] Dynamic lights work
- [x] Texture mapping correct

**Reference:** `packages/engine/src/render/md2Pipeline.ts`

---

**Next Section:** [20-10: MD3 Model Pipeline](section-20-10.md)
