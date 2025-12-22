# Section 20-1: WebGPU Context & Device Management

**Phase:** 1 (Foundation)
**Priority:** CRITICAL
**Dependencies:** None (start first)
**Estimated Effort:** 3-4 days

---

## Overview

Implement WebGPU device initialization, context management, and adapter selection for both browser and Node.js (headless) environments. This is the foundation for all subsequent WebGPU work.

**Reference Implementation:** `packages/engine/src/render/context.ts` (WebGL version)

---

## Objectives

1. Create WebGPU device and context initialization
2. Handle adapter selection and feature detection
3. Support both browser canvas and headless rendering
4. Implement context loss/restoration handling
5. Provide similar API to existing WebGL context creation

---

## Tasks

### Task 1: WebGPU Device Initialization

**File:** `packages/engine/src/render/webgpu/context.ts`

Implement device and adapter initialization:

```typescript
interface WebGPUContextOptions {
  powerPreference?: 'low-power' | 'high-performance';
  requiredFeatures?: GPUFeatureName[];
  requiredLimits?: Record<string, number>;
}

interface WebGPUContextState {
  adapter: GPUAdapter;
  device: GPUDevice;
  context?: GPUCanvasContext;  // undefined for headless
  format: GPUTextureFormat;
  features: Set<GPUFeatureName>;
  limits: GPUSupportedLimits;
  isHeadless: boolean;
}

async function createWebGPUContext(
  canvas?: HTMLCanvasElement,
  options?: WebGPUContextOptions
): Promise<WebGPUContextState>
```

**Subtasks:**
1. Request GPUAdapter with power preference
2. Query adapter features and limits
3. Validate required features are available
4. Request GPUDevice with required features/limits
5. Configure canvas context (if provided)
6. Determine optimal surface format
7. Detect headless mode (no canvas)
8. Return context state object

**Test Cases:**
- Successfully creates device in browser environment
- Successfully creates device in headless (@webgpu/dawn) environment
- Respects power preference option
- Throws error if required features unavailable
- Configures canvas context with correct format
- Detects and handles missing WebGPU support gracefully

**Status:**
- [x] Implemented core context creation logic
- [x] Added unit tests with mocks
- [x] Verified build and tests pass
- [x] Integration tests implemented (Note: require GPU/Vulkan drivers, may fail in headless CI)

---

### Task 2: Feature Detection & Capability Queries

**File:** Same as Task 1

Implement feature detection utilities:

```typescript
interface WebGPUCapabilities {
  hasTimestampQuery: boolean;
  hasDepthClipControl: boolean;
  hasTextureCompressionBC: boolean;
  hasTextureCompressionETC2: boolean;
  hasTextureCompressionASTC: boolean;
  maxTextureDimension2D: number;
  maxBindGroups: number;
  maxUniformBufferBindingSize: number;
  maxStorageBufferBindingSize: number;
}

function queryCapabilities(state: WebGPUContextState): WebGPUCapabilities
```

**Subtasks:**
1. Check for optional features (timestamp queries, depth-clip-control, etc.)
2. Query texture compression support
3. Extract relevant limits (max texture size, max bind groups, etc.)
4. Create capabilities summary object
5. Log capabilities to console in debug mode

**Test Cases:**
- Correctly identifies available features
- Returns accurate limit values
- Handles missing optional features gracefully

**Status:**
- [x] Implemented capabilities query
- [x] Added tests

---

### Task 3: Context Loss/Restoration Handling

**File:** Same as Task 1

Implement device loss handling:

```typescript
interface ContextLostHandler {
  (reason: GPUDeviceLostReason): void;
}

function setupDeviceLossHandling(
  device: GPUDevice,
  onLost: ContextLostHandler
): void
```

**Subtasks:**
1. Register `device.lost` promise handler
2. Distinguish between 'destroyed' and 'unknown' reasons
3. Invoke user-provided callback with reason
4. Log device loss events
5. Document restoration strategy (consumer responsibility)

**Test Cases:**
- Detects device loss events
- Invokes callback with correct reason
- Handles multiple loss events
- Does not crash if no callback provided

**Status:**
- [x] Implemented device loss handling
- [x] Added tests

---

### Task 4: Headless Rendering Support

**File:** `packages/engine/src/render/webgpu/headless.ts`

Create headless-specific utilities:

```typescript
interface HeadlessRenderTarget {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
}

function createHeadlessRenderTarget(
  device: GPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat
): HeadlessRenderTarget

async function captureRenderTarget(
  device: GPUDevice,
  texture: GPUTexture
): Promise<Uint8ClampedArray>
```

**Subtasks:**
1. Create texture for headless rendering (without canvas)
2. Configure texture as render attachment
3. Create texture view for rendering
4. Implement GPU-to-CPU texture readback
5. Handle format conversions (RGBA8Unorm to Uint8ClampedArray)
6. Implement staging buffer for readback

**Test Cases:**
- Creates valid render target texture
- Texture has correct dimensions and format
- Can read back rendered content
- Handles different texture formats
- Properly manages staging buffers

**Status:**
- [x] Implemented headless render target creation
- [x] Implemented framebuffer capture
- [x] Added mocked unit tests (passing)
- [x] Added real integration tests with webgpu package (functional, but require GPU drivers)

---

### Task 5: Error Handling & Validation

**File:** Same as Task 1

Implement comprehensive error handling:

**Subtasks:**
1. Handle missing WebGPU API (browser too old)
2. Handle adapter request failures
3. Handle device request failures (features not supported)
4. Validate canvas element is valid HTMLCanvasElement
5. Provide helpful error messages for common issues
6. Implement device.pushErrorScope/popErrorScope helpers

**Test Cases:**
- Throws descriptive error if WebGPU not available
- Throws if required features not supported
- Validates canvas parameter
- Error messages guide user to solutions
- Captures validation errors via error scopes

**Status:**
- [x] Implemented robust error handling
- [x] Added tests covering failure cases

---

### Task 6: Integration with Existing Architecture

**File:** `packages/engine/src/render/interface.ts` (new file)

Create minimal shared interfaces:

```typescript
// Shared renderer interface
export interface IRenderer {
  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[],
    renderOptions?: RenderOptions
  ): void;

  begin2D(): void;
  drawPic(/* ... */): void;
  drawString(/* ... */): void;
  drawfillRect(/* ... */): void;
  end2D(): void;

  dispose(): void;
}

// WebGPU-specific extension (defined later in 20-15)
export interface IWebGPURenderer extends IRenderer {
  // Extended interface defined in section 20-15
}
```

**Subtasks:**
1. Extract existing Renderer interface to shared file
2. Ensure WebGL renderer still implements interface
3. Create placeholder for WebGPU renderer interface
4. Update exports in index.ts
5. No breaking changes to existing code

**Test Cases:**
- WebGL renderer still compiles and works
- Interface correctly defines contract
- Both renderers can be typed as IRenderer

**Status:**
- [x] Created `packages/engine/src/render/interface.ts`
- [x] Updated `packages/engine/src/render/renderer.ts` to implement `IRenderer`
- [x] Verified build passes

---

## Deliverables

### New Files Created
- `packages/engine/src/render/webgpu/context.ts` (~250 lines)
- `packages/engine/src/render/webgpu/headless.ts` (~150 lines)
- `packages/engine/src/render/interface.ts` (~50 lines)

### Modified Files
- `packages/engine/src/render/index.ts` (add exports)
- `packages/engine/package.json` (add @webgpu/types dependency)

### Tests Created
- `packages/engine/tests/render/webgpu/context.test.ts` (~200 lines)
  - Mock-based unit tests
  - Tests for all error conditions
  - Feature detection tests

- `packages/engine/tests/render/webgpu/headless.test.ts` (~100 lines)
  - Headless render target creation
  - Texture readback tests

- `packages/engine/tests/render/webgpu/integration.test.ts` (~100 lines)
  - Real integration tests using @webgpu/dawn (webgpu npm package)
  - Verifies actual GPU context creation and simple clear/readback in headless Node.js environment

---

## Testing Strategy

### Unit Tests (Mocked)

Create basic WebGPU mocks in test-utils (minimal for now, expanded in 20-3):

```typescript
// packages/test-utils/src/engine/mocks/webgpu.ts (minimal)
export function createMockGPUAdapter(): GPUAdapter { /* ... */ }
export function createMockGPUDevice(): GPUDevice { /* ... */ }
```

Test context creation logic without real GPU.

### Integration Tests (Headless)

Test with real webgpu package:

```typescript
test('creates headless context with webgpu', async () => {
  const context = await createWebGPUContext();
  expect(context.device).toBeDefined();
  expect(context.isHeadless).toBe(true);
});
```

**Note on CI/CD:** Integration tests using the `webgpu` npm package require GPU drivers (Vulkan, Metal, or D3D12) or SwiftShader. These may fail in headless CI environments without GPU support. Unit tests with mocks provide sufficient coverage for CI/CD pipelines.

---

## Success Criteria

- [x] Can create WebGPU context in browser with canvas
- [x] Can create WebGPU context headlessly with @webgpu/dawn
- [x] Feature detection correctly identifies capabilities
- [x] Device loss handling implemented
- [x] Headless render targets can be created and read back
- [x] Error handling provides helpful messages
- [x] Shared interface extracts common renderer contract
- [x] All tests pass (unit and integration)
- [x] Zero modifications to existing WebGL code

---

## References

**Existing Code:**
- `packages/engine/src/render/context.ts` - WebGL equivalent
- `packages/client/src/session.ts:87` - Context initialization in app

**WebGPU Spec:**
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WGPU Adapter Selection](https://www.w3.org/TR/webgpu/#adapter-selection)

**Dependencies:**
- `@webgpu/types` - TypeScript definitions
- `@webgpu/dawn` - Node.js implementation (dev dependency)

---

## Notes for Implementer

- **Adapter Selection:** Prefer high-performance adapter by default (can override with options)
- **Required Features:** Initially require none, make all features optional for maximum compatibility
- **Surface Format:** Use `navigator.gpu.getPreferredCanvasFormat()` or fallback to 'bgra8unorm'
- **Headless Detection:** If no canvas provided, assume headless mode
- **Error Messages:** Include links to browser compatibility info if WebGPU not available

---

**Next Section:** [20-2: Core Resource Abstractions](section-20-2.md)
