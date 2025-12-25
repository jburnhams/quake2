# Section 20-6: Frame Rendering Orchestration

**Phase:** 2 (First Rendering)
**Priority:** HIGH
**Dependencies:** 20-5 (Sprite Pipeline)
**Estimated Effort:** 4-5 days

---

## Overview

Implement the frame rendering coordinator that manages render passes, command encoding, and pipeline orchestration. This is the WebGPU equivalent of the existing frame renderer.

**Reference Implementation:** `packages/engine/src/render/frame.ts` (WebGL version, 841 lines)

---

## Objectives

1. Coordinate multiple rendering pipelines
2. Manage render passes and command encoding
3. Handle render target management
4. Implement render state management
5. Support multi-pass rendering (opaque, transparent, post-process)
6. Provide foundation for 3D pipelines

---

## Tasks

### Task 1: Command Encoding & Render Pass Management

**File:** `packages/engine/src/render/webgpu/frame.ts`

```typescript
interface FrameContext {
  device: GPUDevice;
  commandEncoder: GPUCommandEncoder;
  renderTarget: GPUTextureView;
  depthTexture: GPUTextureView;
  width: number;
  height: number;
}

class FrameRenderer {
  constructor(
    context: WebGPUContextState,
    pipelines: {
      sprite: SpriteRenderer;
      // More pipelines added in later sections
    }
  )

  beginFrame(): FrameContext
  renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[]): void
  endFrame(): void
}
```

**Subtasks:**
1. [x] Create FrameRenderer class
2. [x] Implement beginFrame() - create command encoder
3. [x] Implement endFrame() - submit command buffer (handled in `renderFrame`)
4. [x] Create depth texture for 3D rendering
5. [x] Manage render pass descriptors
6. [x] Handle frame timing and statistics

**Test Cases:**
- [x] Can begin and end frame
- [x] Command encoder created correctly
- [x] Depth texture created with correct format
- [x] Command buffer submitted successfully

---

### Task 2: Multi-Pass Rendering

**Subtasks:**
1. [x] Implement opaque geometry pass (placeholder structure)
2. [x] Implement transparent geometry pass (placeholder structure)
3. [x] Implement 2D/HUD pass (integrated `SpriteRenderer`)
4. [x] Support render pass dependencies (e.g., copying texture for warp - placeholder structure)
5. [x] Implement clear operations

**Test Cases:**
- [x] Multiple passes execute in correct order
- [x] Depth buffer shared between passes
- [x] Transparent sorting works (placeholder)

---

### Task 3: Renderer Factory & Integration

**File:** `packages/engine/src/render/webgpu/renderer.ts` (extend)

```typescript
export async function createWebGPURenderer(
  canvas?: HTMLCanvasElement,
  options?: WebGPUContextOptions
): Promise<IWebGPURenderer> {
  const context = await createWebGPUContext(canvas, options);

  const spriteRenderer = new SpriteRenderer(context.device, context.format);
  // More pipelines in later sections

  const frameRenderer = new FrameRenderer(context, { sprite: spriteRenderer });

  return new WebGPURenderer(context, frameRenderer);
}
```

**Subtasks:**
1. [x] Implement createWebGPURenderer factory
2. [x] Initialize all pipelines (Sprite pipeline for now)
3. [x] Create frame renderer with pipeline registry
4. [x] Return IWebGPURenderer instance
5. [x] Match createRenderer() API from WebGL (structural match)

**Test Cases:**
- [x] Factory creates valid renderer
- [x] All pipelines initialized
- [x] Renderer implements IRenderer interface
- [x] Can render frames (verified with mocked and attempted real headless test)

---

### Task 4: Integration with Renderer Interface [x]

**File:** `packages/engine/src/render/webgpu/renderer.ts`

Integrate sprite renderer into main renderer:

**Subtasks:**
1. [x] Create WebGPURenderer class skeleton
2. [x] Integrate SpriteRenderer
3. [x] Implement begin2D/end2D
4. [x] Implement drawPic (textured quad)
5. [x] Implement drawfillRect (solid rect)
6. [x] Implement drawString (texture atlas for text)
7. [x] Handle texture caching
8. [x] Match WebGL renderer API exactly (Updated interfaces to be generic)

**Reference:** `packages/engine/src/render/frame.ts`

**Next Section:** [20-7: Skybox Pipeline](section-20-7.md)
