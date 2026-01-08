# Section 20-12: Dynamic Lighting System

## ✅ COMPLETED

**Status:** Fully implemented and integrated into BSP and MD2 pipelines.

**Summary:**
- Dynamic lighting implemented in `bsp.wgsl` and `md2.wgsl` shaders
- Supports up to 32 dynamic lights (MAX_DLIGHTS=32), exceeding original spec of 8
- Per-pixel lighting calculations with attenuation
- Light data passed via uniform buffers in pipeline implementations
- Uses CameraState architecture from Section 22 refactoring

**Implementation Files:**
- `packages/engine/src/render/webgpu/shaders/bsp.wgsl` - BSP dynamic lighting
- `packages/engine/src/render/webgpu/shaders/md2.wgsl` - MD2 model lighting
- `packages/engine/src/render/webgpu/pipelines/bspPipeline.ts` - Light buffer management
- `packages/engine/src/render/webgpu/pipelines/md2Pipeline.ts` - Light buffer management

---

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 20-8 (BSP Pipeline)
**Estimated Effort:** 3-4 days

---

## Overview

Implement dynamic point lights that illuminate BSP surfaces and models in real-time.

**Reference Implementation:** Integrated in `bspPipeline.ts` and `md2Pipeline.ts`

---

## Tasks

1. **Light Uniform Buffer Management** ✅
   - Structure for up to 32 dynamic lights (MAX_DLIGHTS=32)
   - Light position, color, radius, intensity
   - Update buffer per frame

2. **Per-Pixel Lighting Calculations** ✅
   - Attenuation based on distance
   - Diffuse lighting (N·L)
   - Color modulation

3. **Light Culling** ✅
   - Frustum culling for lights
   - Surface-light intersection testing
   - Only pass relevant lights to shader

4. **Integration & Testing** ✅
   - Visual test: `lighting-point.png`
   - Visual test: `lighting-multiple.png`
   - Visual test: `lighting-colored.png`

**Test Cases:**
- Lights illuminate surfaces correctly
- Attenuation smooth and realistic
- Multiple lights accumulate
- Colored lights tint surfaces
- Off-screen lights culled

---

**Next Section:** [20-13: Post-Processing & Effects](section-20-13.md)
