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
- Base texture (diffuse)
- Lightmap texture (multiple styles)
- Dynamic point lights (up to 8)
- Texture scrolling/animation
- Fullbright surfaces
- Alpha testing

**Reference:** `bspPipeline.ts` lines 49-251 (GLSL shader)

**Subtasks:**
1. Vertex shader (position, texcoords, lightmap coords)
2. Fragment shader structure
3. Multi-lightmap accumulation
4. Dynamic light calculation (per-pixel)
5. Texture scrolling support
6. Alpha test for fences/grates

### Task 2: BspSurfacePipeline Implementation

**File:** `pipelines/bspPipeline.ts`

```typescript
class BspSurfacePipeline {
  constructor(device: GPUDevice, format: GPUTextureFormat)

  bind(options: {
    projectionView: mat4;
    viewPos: vec3;
    dynamicLights: Light[];
    time: number;
  }): void

  drawSurface(surface: BspSurfaceGeometry): void
  flush(): void
}
```

**Subtasks:**
1. Create render pipeline with correct state
2. Vertex buffer layout (pos, normal, texcoord, lightmapcoord)
3. Bind group layouts (uniforms, textures, lightmaps, dynamic lights)
4. Implement surface batching by texture
5. Multi-style lightmap blending
6. Dynamic light management
7. Texture animation support

### Task 3: Geometry Management

Adapt existing BspSurfaceGeometry to WebGPU:

**Subtasks:**
1. Use GPUBufferResource from section 20-2
2. Maintain CPU-side data for culling
3. Efficient buffer updates for animated surfaces
4. Index buffer optimization

### Task 4: Lightmap System

**Subtasks:**
1. Upload lightmap textures (multiple styles)
2. Bind multiple lightmaps simultaneously
3. Implement lightmap blending (additive)
4. Support light style animation

### Task 5: Dynamic Lighting

**Subtasks:**
1. Uniform buffer for up to 8 dynamic lights
2. Per-pixel light calculation
3. Attenuation and falloff
4. Color and intensity

### Task 6: Integration & Testing

**Integration Tests:**
- Render BSP surface with lightmap
- Dynamic lights illuminate surfaces
- Texture scrolling works
- Alpha tested surfaces render correctly

**Visual Regression Tests:**
- `bsp-simple.png` - Single textured surface
- `bsp-lightmap.png` - Surface with lightmap
- `bsp-dynamic-light.png` - Dynamic light on surface
- `bsp-scrolling.png` - Animated texture
- `bsp-alpha-test.png` - Fence texture with alpha

**Test Cases:**
- Lightmaps apply correctly
- Multiple light styles blend
- Dynamic lights attenuate properly
- Texture scrolling smooth
- Alpha testing works
- Batching reduces draw calls

---

**Reference:** `packages/engine/src/render/bspPipeline.ts`

---

**Next Section:** [20-9: MD2 Model Pipeline](section-20-9.md)
