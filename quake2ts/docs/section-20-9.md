# Section 20-9: MD2 Model Pipeline

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
1. Dual-frame vertex input
2. Frame interpolation in vertex shader
3. Normal interpolation
4. Dynamic lighting per vertex
5. Texture mapping

**Reference:** `md2Pipeline.ts` lines 41-128

### Task 2: Md2Pipeline Implementation

**File:** `pipelines/md2Pipeline.ts`

**Subtasks:**
1. Render pipeline with frame interpolation
2. Dual vertex buffers (current/next frame)
3. Frame blending uniform
4. Texture binding
5. Dynamic light support
6. Backface culling

### Task 3: Integration & Testing

**Visual Tests:**
- `md2-static.png` - Single frame
- `md2-interpolated.png` - Mid-frame blend
- `md2-lit.png` - With dynamic light

**Test Cases:**
- Frame interpolation smooth
- Normals interpolate correctly
- Dynamic lights work
- Texture mapping correct

**Reference:** `packages/engine/src/render/md2Pipeline.ts`

---

**Next Section:** [20-10: MD3 Model Pipeline](section-20-10.md)
