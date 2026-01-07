**N/A - STRETCH GOALS / GUIDANCE ONLY**

Verified 2026-01-07: This section is documentation of future possibilities, not implementation tasks. No work expected.

The architecture foundations from 22-1 through 22-7 are largely in place, enabling these future possibilities once the remaining migration work (22-6, 22-8) is completed.

---

# Section 22-13: Future Renderers (Stretch Goals)

**Phase:** 6 (Future Work)
**Effort:** N/A (exploration and guidance)
**Dependencies:** 22-12 (architecture complete)
**Merge Safety:** N/A (ideas and prototypes)

---

## Overview

This section explores future renderer possibilities enabled by the clean `CameraState` architecture. Not implementation guides, but inspiration and architectural guidance for future work.

**Enabled by Section 22:**
- Clean boundary between game engine and renderer
- API-agnostic camera state
- Testable without GPU (null/logging renderers)
- Multiple renderers can coexist

---

## Future Renderer Ideas

### 1. Software Raytracing Renderer

**Concept:** CPU-based raytracer for offline rendering, screenshots, or cinematics.

**Architecture:**
```typescript
export class RaytracingRenderer implements IRenderer {
  private raytracer: Raytracer;
  private matrixBuilder: IdentityMatrixBuilder;  // Quake space!

  renderFrame(options: FrameRenderOptions, entities: RenderableEntity[]): void {
    const cameraState = options.cameraState ?? options.camera.toState();

    // Build rays from camera
    const rays = this.generateCameraRays(cameraState);

    // Trace rays through Quake-space scene
    for (const ray of rays) {
      const color = this.raytracer.trace(ray, options.world, entities);
      this.framebuffer.setPixel(ray.screenX, ray.screenY, color);
    }
  }

  private generateCameraRays(camera: CameraState): Ray[] {
    // Camera is in Quake space - generate rays directly
    // No coordinate transforms needed!
    const rays: Ray[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        rays.push(this.computeRay(camera, x, y));
      }
    }
    return rays;
  }
}
```

**Benefits:**
- Accurate lighting and shadows
- Reflections and refractions
- Higher quality than rasterization
- Can run offline (not real-time)

**Use Cases:**
- High-quality screenshots
- Cinematic renders
- Reference images for visual comparison
- Debugging lighting setups

---

### 2. Vulkan/Metal Native Renderer (via wgpu-native)

**Concept:** Native Vulkan or Metal renderer for maximum performance.

**Architecture:**
```typescript
export class VulkanRenderer implements IRenderer {
  private device: VulkanDevice;
  private matrixBuilder: VulkanMatrixBuilder;  // Similar to WebGPU

  renderFrame(options: FrameRenderOptions, entities: RenderableEntity[]): void {
    const cameraState = options.cameraState ?? options.camera.toState();

    // Build Vulkan-specific matrices
    const matrices = buildMatrices(this.matrixBuilder, cameraState);

    // Vulkan rendering commands
    // Similar to WebGPU but with native performance
  }
}

class VulkanMatrixBuilder implements MatrixBuilder {
  readonly coordinateSystem = CoordinateSystem.VULKAN;

  buildViewMatrix(camera: CameraState): mat4 {
    // Vulkan conventions (similar to WebGPU)
    // But with Vulkan-specific optimizations
  }

  buildProjectionMatrix(camera: CameraState): mat4 {
    // Vulkan depth range, coordinate system
  }
}
```

**Benefits:**
- Native performance
- Lower overhead than WebGPU
- Platform-specific optimizations
- Compute shader support

**Challenges:**
- Platform-specific code
- More complex setup
- Vulkan API complexity

---

### 3. Replay/Recording Renderer

**Concept:** Records rendering commands for playback, debugging, or testing.

**Architecture:**
```typescript
export interface RecordedFrame {
  readonly frameNumber: number;
  readonly timestamp: number;
  readonly cameraState: CameraState;
  readonly commands: RenderCommand[];
  readonly entities: RenderableEntity[];
}

export class RecordingRenderer implements IRenderer {
  private frames: RecordedFrame[] = [];
  private frameNumber = 0;

  renderFrame(options: FrameRenderOptions, entities: RenderableEntity[]): void {
    const cameraState = options.cameraState ?? options.camera.toState();

    this.frames.push({
      frameNumber: this.frameNumber++,
      timestamp: performance.now(),
      cameraState: { ...cameraState },  // Deep copy
      commands: this.captureCommands(options, entities),
      entities: [...entities]
    });
  }

  saveRecording(filename: string): void {
    // Serialize frames to file
    fs.writeFileSync(filename, JSON.stringify(this.frames, null, 2));
  }

  static async playback(
    filename: string,
    targetRenderer: IRenderer
  ): Promise<void> {
    const frames = JSON.parse(fs.readFileSync(filename, 'utf-8'));

    for (const frame of frames) {
      targetRenderer.renderFrame({
        camera: createCameraFromState(frame.cameraState),
        cameraState: frame.cameraState,
        // ... reconstruct options from commands ...
      }, frame.entities);

      await sleep(16);  // 60 FPS playback
    }
  }
}
```

**Use Cases:**
- Record gameplay for bug reports
- Replay rendering for debugging
- Create test fixtures from gameplay
- Performance profiling (deterministic replay)

---

### 4. Headless Batch Renderer

**Concept:** Render many frames efficiently for testing or content generation.

**Architecture:**
```typescript
export class BatchRenderer implements IRenderer {
  private workers: WebGPURenderer[];  // Pool of renderers

  async renderBatch(requests: RenderRequest[]): Promise<ImageData[]> {
    const results = await Promise.all(
      requests.map((request, i) => {
        const worker = this.workers[i % this.workers.length];
        return this.renderOne(worker, request);
      })
    );
    return results;
  }

  private async renderOne(
    renderer: WebGPURenderer,
    request: RenderRequest
  ): Promise<ImageData> {
    renderer.renderFrame({
      camera: createCameraFromState(request.cameraState),
      cameraState: request.cameraState,
      world: request.world,
      sky: request.sky
    }, request.entities);

    return await captureFramebuffer(renderer);
  }
}
```

**Use Cases:**
- Generate visual regression baselines
- Batch screenshot generation
- Map preview thumbnails
- Automated visual testing at scale

---

### 5. Differential/Comparison Renderer

**Concept:** Render with two renderers simultaneously and show differences.

**Architecture:**
```typescript
export class ComparisonRenderer implements IRenderer {
  constructor(
    private rendererA: IRenderer,
    private rendererB: IRenderer,
    private diffMode: 'side-by-side' | 'overlay' | 'difference'
  ) {}

  renderFrame(options: FrameRenderOptions, entities: RenderableEntity[]): void {
    // Render with both
    this.rendererA.renderFrame(options, entities);
    this.rendererB.renderFrame(options, entities);

    // Capture outputs
    const outputA = this.captureOutput(this.rendererA);
    const outputB = this.captureOutput(this.rendererB);

    // Show comparison
    switch (this.diffMode) {
      case 'side-by-side':
        this.renderSideBySide(outputA, outputB);
        break;
      case 'overlay':
        this.renderOverlay(outputA, outputB);
        break;
      case 'difference':
        this.renderDifference(outputA, outputB);
        break;
    }
  }

  private renderDifference(a: ImageData, b: ImageData): void {
    // Highlight pixels that differ
    for (let i = 0; i < a.data.length; i += 4) {
      const diffR = Math.abs(a.data[i] - b.data[i]);
      const diffG = Math.abs(a.data[i + 1] - b.data[i + 1]);
      const diffB = Math.abs(a.data[i + 2] - b.data[i + 2]);
      const diff = Math.max(diffR, diffG, diffB);

      // Show difference in red
      this.output.data[i] = diff;
      this.output.data[i + 1] = 0;
      this.output.data[i + 2] = 0;
      this.output.data[i + 3] = 255;
    }
  }
}
```

**Use Cases:**
- Visual debugging (WebGL vs WebGPU)
- Regression detection
- Validation during refactoring
- Performance comparison visualization

---

### 6. ASCII Art Renderer (Terminal Rendering)

**Concept:** Render to terminal using ASCII art for remote debugging.

**Architecture:**
```typescript
export class ASCIIRenderer implements IRenderer {
  private matrixBuilder = new IdentityMatrixBuilder();

  renderFrame(options: FrameRenderOptions, entities: RenderableEntity[]): void {
    const cameraState = options.cameraState ?? options.camera.toState();

    // Raytrace at low resolution
    const ascii: string[] = [];
    for (let y = 0; y < 40; y++) {
      let line = '';
      for (let x = 0; x < 80; x++) {
        const depth = this.sampleDepth(cameraState, x / 80, y / 40, options.world);
        line += this.depthToASCII(depth);
      }
      ascii.push(line);
    }

    // Print to terminal
    console.clear();
    console.log(ascii.join('\n'));
  }

  private depthToASCII(depth: number): string {
    const chars = ' .:-=+*#%@';
    const index = Math.floor((1 - depth) * chars.length);
    return chars[Math.min(index, chars.length - 1)];
  }
}
```

**Use Cases:**
- Remote server debugging
- Headless environment visualization
- Fun demos
- Accessibility testing

---

## Implementation Guidance

### How to Add a New Renderer

**Step 1: Implement IRenderer Interface**
```typescript
export class MyRenderer implements IRenderer {
  // Implement all required methods
}
```

**Step 2: Create Matrix Builder (if needed)**
```typescript
export class MyMatrixBuilder implements MatrixBuilder {
  readonly coordinateSystem = CoordinateSystem.MY_API;

  buildViewMatrix(camera: CameraState): mat4 {
    // Build view matrix in your coordinate system
  }

  buildProjectionMatrix(camera: CameraState): mat4 {
    // Build projection matrix with your conventions
  }
}
```

**Step 3: Use CameraState**
```typescript
renderFrame(options: FrameRenderOptions, entities: RenderableEntity[]): void {
  const cameraState = options.cameraState ?? options.camera.toState();
  const matrices = buildMatrices(this.matrixBuilder, cameraState);
  // Use matrices for rendering
}
```

**Step 4: Test with Logging Renderer**
```typescript
const logger = createLoggingRenderer(CoordinateSystem.MY_API);
logger.renderFrame(options, entities);
logger.printLogs();  // Verify no double-transforms
```

**Step 5: Add Visual Tests**
```typescript
test('MyRenderer produces correct output', async () => {
  const renderer = new MyRenderer();
  const output = await renderTestScene(renderer);
  await expectSnapshot(output).toMatchBaseline('my-renderer/test.png');
});
```

---

## Architecture Benefits

**What Section 22 Enables:**

1. **Clean Boundary**
   - Game engine provides Quake-space data
   - Renderer handles all coordinate transforms
   - No leaky abstractions

2. **Testability**
   - Null renderer for fast tests
   - Logging renderer catches bugs
   - Visual regression baseline

3. **Flexibility**
   - Multiple renderers coexist
   - Easy to experiment
   - Swap renderers at runtime

4. **Maintainability**
   - Each renderer self-contained
   - Shared utilities in `utils/`
   - Clear responsibilities

---

## Success Criteria

This section has no implementation, but success looks like:

- [ ] Architecture enables new renderers
- [ ] Documentation inspires experimentation
- [ ] Examples demonstrate patterns
- [ ] Future developers can add renderers easily
- [ ] Section 22 foundation is solid

---

## Conclusion

The renderer refactoring (Section 22) establishes a clean, extensible architecture that enables:

- **Fixed:** WebGPU diagonal view bug
- **Improved:** Testability (null/logging renderers)
- **Enabled:** Future renderers (raytracing, Vulkan, etc.)
- **Simplified:** Clear API boundary (CameraState)

**Future Work:**
- Explore raytracing prototype
- Investigate Vulkan backend
- Build recording/playback system
- Create comparison tools

---

**Section 22 Complete!** 🎉

The renderer architecture is now clean, tested, and ready for the future.
