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
1. Create FrameRenderer class
2. Implement beginFrame() - create command encoder
3. Implement endFrame() - submit command buffer
4. Create depth texture for 3D rendering
5. Manage render pass descriptors
6. Handle frame timing and statistics

**Test Cases:**
- Can begin and end frame
- Command encoder created correctly
- Depth texture created with correct format
- Command buffer submitted successfully

---

### Task 2: Multi-Pass Rendering

**Subtasks:**
1. Implement opaque geometry pass
2. Implement transparent geometry pass (back-to-front sorted)
3. Implement 2D/HUD pass
4. Support render pass dependencies
5. Implement clear operations

**Test Cases:**
- Multiple passes execute in correct order
- Depth buffer shared between passes
- Transparent sorting works

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
1. Implement createWebGPURenderer factory
2. Initialize all pipelines
3. Create frame renderer with pipeline registry
4. Return IWebGPURenderer instance
5. Match createRenderer() API from WebGL

**Test Cases:**
- Factory creates valid renderer
- All pipelines initialized
- Renderer implements IRenderer interface
- Can render frames

---

**Reference:** `packages/engine/src/render/frame.ts`

**Next Section:** [20-7: Skybox Pipeline](section-20-7.md)
