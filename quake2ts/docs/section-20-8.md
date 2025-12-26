# Section 20-8: BSP Surface Pipeline

**Phase:** 3 (Core Pipelines)
**Priority:** HIGH (Most Complex)
**Dependencies:** 20-2 (Resources), 20-6 (Frame Orchestration)
**Estimated Effort:** 7-10 days

---

## Overview

Implement BSP world geometry rendering with lightmaps, dynamic lights, and material effects. This is the most complex pipeline and forms the bulk of visible geometry.

**Reference Implementation:** `packages/engine/src/render/bspPipeline.ts` (517 lines)

---

## Tasks

### Task 1: WGSL Shader Translation

**File:** `shaders/bsp.wgsl`

Translate complex multi-texture shader:

**Features to implement:**
- [x] Base texture (diffuse)
- [x] Lightmap texture (multiple styles)
- [x] Dynamic point lights (up to 32)
- [x] Texture scrolling/animation
- [x] Fullbright surfaces
- [x] Alpha testing

**Reference:** `bspPipeline.ts` lines 49-251 (GLSL shader)

**Subtasks:**
1. [x] Vertex shader (position, texcoords, lightmap coords)
2. [x] Fragment shader structure
3. [x] Multi-lightmap accumulation
4. [x] Dynamic light calculation (per-pixel)
5. [x] Texture scrolling support
6. [x] Alpha test for fences/grates

### Task 2: BspSurfacePipeline Implementation

**File:** `pipelines/bspPipeline.ts`

```typescript
class BspSurfacePipeline {
  constructor(device: GPUDevice, format: GPUTextureFormat)

  bind(passEncoder: GPURenderPassEncoder, options: BspSurfaceBindOptions): SurfaceRenderState

  draw(passEncoder: GPURenderPassEncoder, geometry: BspSurfaceGeometry, renderMode?: RenderModeConfig): void
}
```

**Subtasks:**
1. [x] Create render pipeline with correct state
2. [x] Vertex buffer layout (pos, texcoord, lightmapcoord, step)
3. [x] Bind group layouts (uniforms, textures, lightmaps, dynamic lights)
4. [x] Implement surface batching by texture (via bind mechanism)
5. [x] Multi-style lightmap blending
6. [x] Dynamic light management
7. [x] Texture animation support

### Task 3: Geometry Management

Adapt existing BspSurfaceGeometry to WebGPU:

**Subtasks:**
1. [x] Use GPUBufferResource from section 20-2 (Implemented via extensions in `bspPipeline.ts` and `WebGPURendererImpl`)
2. [x] Maintain CPU-side data for culling (Retained in existing `BspSurfaceGeometry`)
3. [x] Efficient buffer updates (Implemented in `WebGPURendererImpl.uploadBspGeometry`)
4. [x] Index buffer optimization

### Task 4: Lightmap System

**Subtasks:**
1. [x] Upload lightmap textures (multiple styles)
2. [x] Bind multiple lightmaps simultaneously
3. [x] Implement lightmap blending (additive via shader)
4. [x] Support light style animation (via shader uniforms)

### Task 5: Dynamic Lighting

**Subtasks:**
1. [x] Uniform buffer for up to 32 dynamic lights
2. [x] Per-pixel light calculation
3. [x] Attenuation and falloff
4. [x] Color and intensity

### Task 6: Integration & Testing

**Integration Tests:**
- [x] Render BSP surface with lightmap
- [x] Dynamic lights illuminate surfaces
- [x] Texture scrolling works
- [x] Alpha tested surfaces render correctly

**Visual Regression Tests:**
- [x] `bsp-simple-textured.png` - Single textured surface
- [x] `bsp-lightmapped.png` - Surface with lightmap
- [x] `bsp-dynamic-light.png` - Dynamic light on surface
- [ ] `bsp-scrolling.png` - Animated texture (Tested via unit test logic, visual test to follow in full integration)
- [ ] `bsp-alpha-test.png` - Fence texture with alpha (Tested via shader logic, visual test to follow)

**Test Cases:**
- [x] Lightmaps apply correctly
- [x] Multiple light styles blend
- [x] Dynamic lights attenuate properly
- [x] Texture scrolling smooth
- [x] Alpha testing works
- [x] Batching reduces draw calls

---

**Reference:** `packages/engine/src/render/bspPipeline.ts`

---

**Next Section:** [20-9: MD2 Model Pipeline](section-20-9.md)
