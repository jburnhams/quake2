# Section 20-5: Sprite/2D Renderer (First Pipeline)

**Phase:** 2 (First Rendering)
**Priority:** HIGH
**Dependencies:** 20-2 (Resources), 20-4 (Snapshots)
**Estimated Effort:** 3-4 days

---

## Overview

Implement the simplest rendering pipeline - 2D sprite/HUD rendering. This serves as proof-of-concept for WebGPU rendering and validates the entire testing infrastructure.

**Reference Implementation:** `packages/engine/src/render/sprite.ts` (WebGL version)

---

## Objectives

1. Implement WebGPU 2D sprite renderer
2. Translate GLSL shader to WGSL
3. Support textured quads and filled rectangles
4. Support text rendering (texture atlas-based)
5. Validate with headless tests and PNG snapshots
6. Establish pattern for subsequent pipelines

---

## Tasks

### Task 1: WGSL Shader Translation

**File:** `packages/engine/src/render/webgpu/shaders/sprite.wgsl`

Translate sprite shader from GLSL to WGSL:

**Reference:** `packages/engine/src/render/sprite.ts` (contains inline GLSL)

**WGSL Shader Structure:**
```wgsl
// Vertex shader
struct VertexInput {
  @location(0) position: vec2f,
  @location(1) texcoord: vec2f,
  @location(2) color: vec4f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
  @location(1) color: vec4f,
}

struct Uniforms {
  projection: mat4x4f,  // Orthographic projection
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.projection * vec4f(input.position, 0.0, 1.0);
  output.texcoord = input.texcoord;
  output.color = input.color;
  return output;
}

// Fragment shader
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texColor = textureSample(tex, texSampler, input.texcoord);
  return texColor * input.color;
}

// Fragment shader variant for solid colors (no texture)
@fragment
fn fs_solid(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
```

**Subtasks:**
1. Translate vertex shader GLSL → WGSL
2. Translate fragment shader GLSL → WGSL
3. Create solid color variant (for rectangles)
4. Define vertex input structure
5. Define uniform buffer layout
6. Define bind group layout (uniforms, sampler, texture)

**Test Cases:**
- Shader compiles without errors
- Shader compilation info has no warnings
- Bind group layout matches shader expectations

---

### Task 2: Sprite Pipeline Implementation

**File:** `packages/engine/src/render/webgpu/pipelines/sprite.ts`

Implement sprite rendering pipeline:

```typescript
interface SpriteVertex {
  position: [number, number];
  texcoord: [number, number];
  color: [number, number, number, number];
}

interface SpriteDrawCommand {
  type: 'textured' | 'solid';
  vertices: SpriteVertex[];
  indices: number[];
  texture?: Texture2D;
}

class SpriteRenderer {
  constructor(device: GPUDevice, format: GPUTextureFormat)

  begin(commandEncoder: GPUCommandEncoder, renderTarget: GPUTextureView): void
  drawTexturedQuad(x: number, y: number, w: number, h: number, texture: Texture2D): void
  drawSolidRect(x: number, y: number, w: number, h: number, color: vec4): void
  end(): void

  setProjection(width: number, height: number): void
  destroy(): void
}
```

**Subtasks:**
1. Create SpriteRenderer class
2. Create render pipelines (textured and solid variants)
3. Create vertex buffer layout (position, texcoord, color)
4. Implement orthographic projection matrix
5. Create uniform buffer for projection matrix
6. Implement begin() - start render pass
7. Implement drawTexturedQuad() - batch quads
8. Implement drawSolidRect() - batch rectangles
9. Implement end() - flush batched geometry, submit commands
10. Implement batching (combine multiple sprites into single draw)
11. Create bind groups for textures
12. Handle blend state (alpha blending for sprites)

**Test Cases:**
- Pipeline creates successfully
- Can draw single textured quad
- Can draw solid rectangle
- Can batch multiple sprites
- Projection matrix transforms correctly
- Blending works (transparent sprites)

---

### Task 3: Geometry Batching

**File:** Same as Task 2

Implement efficient batching:

```typescript
class SpriteBatch {
  private vertices: Float32Array;
  private indices: Uint16Array;
  private vertexCount: number = 0;
  private indexCount: number = 0;

  addQuad(x: number, y: number, w: number, h: number, /* ... */): void
  flush(pass: GPURenderPassEncoder): void
  reset(): void
}
```

**Subtasks:**
1. Create SpriteBatch class for geometry accumulation
2. Pre-allocate vertex/index buffers (e.g., 1000 sprites)
3. Implement addQuad() to append to batch
4. Implement flush() to upload and draw batch
5. Handle batch overflow (auto-flush when full)
6. Track draw calls for profiling
7. Implement state bucketing (group by texture)

**Test Cases:**
- Batch can accumulate multiple quads
- Flush draws all accumulated geometry
- Overflow triggers auto-flush
- State changes trigger flush
- Batch reset works

---

### Task 4: Integration with Renderer Interface

**File:** `packages/engine/src/render/webgpu/renderer.ts`

Integrate sprite renderer into main renderer:

```typescript
class WebGPURenderer implements IRenderer {
  private spriteRenderer: SpriteRenderer;

  begin2D(): void {
    // Setup 2D rendering state
    this.spriteRenderer.setProjection(this.width, this.height);
  }

  drawPic(
    x: number, y: number,
    w: number, h: number,
    name: string,
    alpha?: number
  ): void {
    const texture = this.textureCache.get(name);
    this.spriteRenderer.drawTexturedQuad(x, y, w, h, texture);
  }

  drawfillRect(
    x: number, y: number,
    w: number, h: number,
    color: number
  ): void {
    const rgba = parseColor(color);
    this.spriteRenderer.drawSolidRect(x, y, w, h, rgba);
  }

  end2D(): void {
    this.spriteRenderer.end();
  }
}
```

**Subtasks:**
1. Create WebGPURenderer class skeleton
2. Integrate SpriteRenderer
3. Implement begin2D/end2D
4. Implement drawPic (textured quad)
5. Implement drawfillRect (solid rect)
6. Implement drawString (texture atlas for text)
7. Handle texture caching
8. Match WebGL renderer API exactly

**Test Cases:**
- begin2D/end2D work
- drawPic renders texture
- drawfillRect renders colored rectangle
- Multiple draw calls batch correctly
- API matches existing WebGL renderer

---

### Task 5: Headless Integration Tests

**File:** `packages/engine/tests/render/webgpu/sprite.test.ts`

Test sprite rendering with headless WebGPU:

```typescript
import { createRenderTestSetup } from '@quake2ts/test-utils';
import { SpriteRenderer } from '../../../src/render/webgpu/pipelines/sprite';

test('renders solid rectangle', async () => {
  const setup = await createRenderTestSetup(256, 256);

  const spriteRenderer = new SpriteRenderer(
    setup.context.device,
    setup.context.format
  );
  spriteRenderer.setProjection(256, 256);

  spriteRenderer.begin(setup.commandEncoder, setup.renderTarget.view);
  spriteRenderer.drawSolidRect(0, 0, 256, 256, [1, 0, 0, 1]); // Red
  spriteRenderer.end();

  const pixels = await captureRenderTarget(
    setup.context.device,
    setup.renderTarget.texture
  );

  // Verify red color
  expect(pixels[0]).toBe(255); // R
  expect(pixels[1]).toBe(0);   // G
  expect(pixels[2]).toBe(0);   // B

  await setup.cleanup();
});

test('renders textured quad', async () => {
  // Similar test with texture
});
```

**Subtasks:**
1. Write unit tests for SpriteRenderer
2. Test solid rectangle rendering
3. Test textured quad rendering
4. Test batching behavior
5. Test projection matrix
6. Test blending
7. All tests run headlessly with @webgpu/dawn

**Test Cases:**
- Solid rectangle renders correct color
- Textured quad samples texture correctly
- Multiple sprites batch together
- Projection transforms positions correctly
- Blending alpha works

---

### Task 6: Visual Regression Tests

**File:** `packages/engine/tests/visual/sprite.test.ts`

Create PNG snapshot tests:

```typescript
import { test } from '../helpers/visual-testing';

test('sprite: solid red rectangle', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    (pass) => {
      const renderer = new SpriteRenderer(device, format);
      renderer.begin(encoder, view);
      renderer.drawSolidRect(64, 64, 128, 128, [1, 0, 0, 1]);
      renderer.end();
    },
    'sprite-red-rect'
  );
});

test('sprite: textured quad', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    (pass) => {
      // ... render textured sprite
    },
    'sprite-textured'
  );
});

test('sprite: multiple batched quads', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    (pass) => {
      // ... render 10 colored rectangles
    },
    'sprite-batched'
  );
});
```

**Subtasks:**
1. Create visual test for solid rectangle
2. Create visual test for textured quad
3. Create visual test for batched sprites
4. Create visual test for text rendering
5. Create visual test for alpha blending
6. Generate baseline snapshots
7. Verify snapshots match expectations

**Test Cases:**
- All visual tests pass
- Changing rendering fails tests
- Baselines can be updated

---

## Deliverables

### New Files Created
- `packages/engine/src/render/webgpu/shaders/sprite.wgsl` (~80 lines)
- `packages/engine/src/render/webgpu/pipelines/sprite.ts` (~400 lines)
- `packages/engine/src/render/webgpu/renderer.ts` (skeleton, ~150 lines)
- `packages/engine/tests/render/webgpu/sprite.test.ts` (~300 lines)
- `packages/engine/tests/visual/sprite.test.ts` (~150 lines)

### Baselines Created
- `tests/__snapshots__/baselines/sprite-red-rect.png`
- `tests/__snapshots__/baselines/sprite-textured.png`
- `tests/__snapshots__/baselines/sprite-batched.png`
- `tests/__snapshots__/baselines/sprite-text.png`
- `tests/__snapshots__/baselines/sprite-alpha.png`

---

## Testing Strategy

### Unit Tests
- Pipeline creation and configuration
- Vertex buffer layout
- Uniform buffer updates
- Batching logic

### Integration Tests (Headless)
- Actual rendering output validated
- Color values checked
- Texture sampling verified

### Visual Regression Tests
- PNG snapshots for all rendering scenarios
- Automated comparison with baselines

---

## Success Criteria

- [ ] WGSL shader compiles without errors
- [ ] Sprite pipeline renders solid rectangles
- [ ] Sprite pipeline renders textured quads
- [ ] Batching works efficiently
- [ ] Projection matrix correct
- [ ] Alpha blending works
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All visual regression tests pass
- [ ] Matches WebGL renderer output exactly

---

## References

**Existing Code:**
- `packages/engine/src/render/sprite.ts` - WebGL implementation

**WebGPU Examples:**
- [WebGPU Samples - Textured Cube](https://webgpu.github.io/webgpu-samples/samples/texturedCube)

---

## Notes for Implementer

- **Blending:** Enable alpha blending: `blend: { color: {}, alpha: {} }`
- **Primitive Topology:** Use 'triangle-list' with indexed drawing
- **Projection:** Orthographic: `ortho(0, width, height, 0, -1, 1)` (Y-down for screen space)
- **Batching:** Start with simple batching. Optimize later if needed.
- **Coordinate System:** Screen space (0,0) = top-left, (width, height) = bottom-right
- **Text Rendering:** Use texture atlas with character UV coordinates (existing approach)

---

**Next Section:** [20-6: Frame Rendering Orchestration](section-20-6.md)
