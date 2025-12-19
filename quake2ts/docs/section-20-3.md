# Section 20-3: Headless Testing Infrastructure

**Phase:** 1 (Foundation)
**Priority:** CRITICAL
**Dependencies:** 20-1 (Context), 20-2 (Resources)
**Estimated Effort:** 3-4 days

---

## Overview

Establish headless WebGPU testing infrastructure using @webgpu/dawn for Node.js. This enables real GPU rendering in automated tests, forming the foundation for all integration and visual regression testing.

**Goal:** Run actual WebGPU rendering code in CI/CD without a browser.

---

## Objectives

1. Set up @webgpu/dawn for Node.js testing
2. Create comprehensive WebGPU mocks for unit testing
3. Build test utilities for headless rendering
4. Establish patterns for testing rendering pipelines
5. Enable framebuffer capture for visual validation

---

## Tasks

### Task 1: @webgpu/dawn Setup & Configuration

**File:** `packages/test-utils/package.json`

Add dependencies and setup:

```json
{
  "devDependencies": {
    "@webgpu/dawn": "^0.0.x",
    "@webgpu/types": "^0.1.x"
  }
}
```

**File:** `packages/test-utils/src/setup/webgpu.ts`

Create headless WebGPU setup utilities:

```typescript
interface HeadlessWebGPUSetup {
  adapter: GPUAdapter;
  device: GPUDevice;
  cleanup: () => Promise<void>;
}

async function initHeadlessWebGPU(
  options?: {
    powerPreference?: 'low-power' | 'high-performance';
    requiredFeatures?: GPUFeatureName[];
  }
): Promise<HeadlessWebGPUSetup>

async function createHeadlessTestContext(): Promise<WebGPUContextState>
```

**Subtasks:**
1. Import @webgpu/dawn for Node.js environments
2. Create adapter/device initialization for tests
3. Handle cleanup to prevent resource leaks between tests
4. Detect Node.js vs browser environment
5. Provide sensible test defaults (high-performance adapter)
6. Integrate with createWebGPUContext from 20-1

**Test Cases:**
- Successfully initializes in Node.js with @webgpu/dawn
- Cleanup properly releases resources
- Can be called multiple times in test suite
- Environment detection works

---

### Task 2: WebGPU Mock Objects for Unit Testing

**File:** `packages/test-utils/src/engine/mocks/webgpu.ts`

Create comprehensive mocks (similar to `webgl2.ts`):

```typescript
// Mock GPU adapter
function createMockGPUAdapter(
  options?: Partial<GPUAdapter>
): GPUAdapter

// Mock GPU device
function createMockGPUDevice(
  features?: Set<GPUFeatureName>
): GPUDevice

// Mock GPU buffer
function createMockGPUBuffer(
  size: number,
  usage: GPUBufferUsageFlags
): GPUBuffer

// Mock GPU texture
function createMockGPUTexture(
  width: number,
  height: number,
  format: GPUTextureFormat
): GPUTexture

// Mock GPU shader module
function createMockShaderModule(
  code: string
): GPUShaderModule

// Mock GPU render pipeline
function createMockRenderPipeline(): GPURenderPipeline

// Mock GPU bind group
function createMockBindGroup(): GPUBindGroup

// Mock GPU command encoder
function createMockCommandEncoder(): GPUCommandEncoder

// Mock GPU queue
function createMockQueue(): GPUQueue

// Complete mock context
function createMockWebGPUContext(): {
  adapter: GPUAdapter;
  device: GPUDevice;
  queue: GPUQueue;
}
```

**Subtasks:**
1. Mock GPUAdapter with feature/limit queries
2. Mock GPUDevice with all creation methods
3. Mock GPUBuffer with size and usage tracking
4. Mock GPUTexture with dimension tracking
5. Mock GPUShaderModule (minimal, just tracks code)
6. Mock GPURenderPipeline (minimal)
7. Mock GPUCommandEncoder with command recording
8. Mock GPUQueue with submit/writeBuffer/writeTexture
9. Track method calls for test assertions
10. Implement minimal behavior (e.g., writeBuffer updates internal state)

**Test Cases:**
- Mocks satisfy TypeScript types
- Can create all resource types
- Method calls are trackable
- State updates work (writeBuffer, etc.)
- Validation errors throw when expected

---

### Task 3: Headless Rendering Test Utilities

**File:** `packages/test-utils/src/engine/helpers/webgpu-rendering.ts`

Create utilities for testing rendering:

```typescript
interface RenderTestSetup {
  context: WebGPUContextState;
  renderTarget: HeadlessRenderTarget;
  commandEncoder: GPUCommandEncoder;
  cleanup: () => Promise<void>;
}

async function createRenderTestSetup(
  width?: number,
  height?: number
): Promise<RenderTestSetup>

async function renderAndCapture(
  setup: RenderTestSetup,
  renderFn: (pass: GPURenderPassEncoder) => void
): Promise<Uint8ClampedArray>

interface ComputeTestSetup {
  context: WebGPUContextState;
  outputBuffer: GPUBuffer;
  cleanup: () => Promise<void>;
}

async function createComputeTestSetup(
  outputSize: number
): Promise<ComputeTestSetup>

async function runComputeAndReadback(
  setup: ComputeTestSetup,
  computeFn: (pass: GPUComputePassEncoder) => void
): Promise<ArrayBuffer>
```

**Subtasks:**
1. Create setup function that initializes all needed resources
2. Create render target texture and view
3. Provide command encoder for test
4. Implement renderAndCapture helper that:
   - Begins render pass
   - Invokes user render function
   - Ends pass and submits
   - Reads back framebuffer
5. Implement cleanup that destroys all resources
6. Create similar setup for compute shader testing
7. Handle different texture formats and sizes

**Test Cases:**
- Setup creates valid rendering context
- renderAndCapture produces valid pixel data
- Cleanup properly releases resources
- Can run multiple tests in sequence
- Compute setup works for compute shaders

---

### Task 4: Vitest Integration & Configuration

**File:** `packages/engine/vitest.config.ts`

Update config to support WebGPU tests:

```typescript
export default defineConfig({
  test: {
    // ... existing config
    globals: true,
    environment: 'node',  // Use node for headless tests
    setupFiles: ['./tests/setup-webgpu.ts'],
  },
});
```

**File:** `packages/engine/tests/setup-webgpu.ts`

```typescript
import { beforeAll, afterAll } from 'vitest';

let globalAdapter: GPUAdapter | null = null;

beforeAll(async () => {
  // Initialize @webgpu/dawn once for all tests
  globalAdapter = await navigator.gpu.requestAdapter();
});

afterAll(async () => {
  // Cleanup if needed
  globalAdapter = null;
});
```

**Subtasks:**
1. Configure vitest for headless WebGPU
2. Create global test setup file
3. Initialize @webgpu/dawn once (expensive operation)
4. Provide cleanup hooks
5. Handle test isolation (each test gets own device)
6. Configure test timeouts for GPU operations

**Test Cases:**
- Vitest runs with @webgpu/dawn
- Tests can access WebGPU API
- Global setup runs once
- Tests are isolated from each other

---

### Task 5: Example Pipeline Tests (Template)

**File:** `packages/engine/tests/render/webgpu/pipeline-test-template.ts`

Create reusable test patterns:

```typescript
/**
 * Template for testing a rendering pipeline
 */
export async function testPipelineRendering(
  name: string,
  createPipeline: (device: GPUDevice) => RenderPipeline,
  setupGeometry: (device: GPUDevice) => GeometryBuffers,
  expectedOutput?: Uint8ClampedArray  // For validation
) {
  const setup = await createRenderTestSetup(256, 256);

  try {
    const pipeline = createPipeline(setup.context.device);
    const geometry = setupGeometry(setup.context.device);

    const pixels = await renderAndCapture(setup, (pass) => {
      pass.setPipeline(pipeline.pipeline);
      // ... bind geometry and draw
    });

    if (expectedOutput) {
      expect(pixels).toEqual(expectedOutput);
    } else {
      // At least verify we got pixels
      expect(pixels.length).toBe(256 * 256 * 4);
    }
  } finally {
    await setup.cleanup();
  }
}

/**
 * Template for testing compute shaders
 */
export async function testComputeShader(
  name: string,
  createComputePipeline: (device: GPUDevice) => ComputePipeline,
  inputData: Float32Array,
  expectedOutput?: Float32Array
) {
  const setup = await createComputeTestSetup(inputData.byteLength);

  try {
    // ... run compute and validate
  } finally {
    await setup.cleanup();
  }
}
```

**Subtasks:**
1. Create template for testing render pipelines
2. Create template for testing compute pipelines
3. Provide common setup/teardown patterns
4. Include pixel validation helpers
5. Include buffer validation helpers
6. Document usage patterns

**Test Cases:**
- Template can test simple triangle rendering
- Template can test compute shader
- Cleanup always runs even on test failure
- Can be reused across multiple pipelines

---

### Task 6: Test Utilities Export & Documentation

**File:** `packages/test-utils/src/index.ts`

Export WebGPU test utilities:

```typescript
// WebGPU mocks (for unit tests)
export {
  createMockGPUAdapter,
  createMockGPUDevice,
  createMockGPUBuffer,
  createMockGPUTexture,
  createMockWebGPUContext,
} from './engine/mocks/webgpu';

// Headless rendering utilities (for integration tests)
export {
  initHeadlessWebGPU,
  createHeadlessTestContext,
} from './setup/webgpu';

export {
  createRenderTestSetup,
  renderAndCapture,
  createComputeTestSetup,
  runComputeAndReadback,
} from './engine/helpers/webgpu-rendering';

// Test templates
export {
  testPipelineRendering,
  testComputeShader,
} from './engine/helpers/pipeline-test-template';
```

**File:** `packages/test-utils/README.md`

Update documentation with WebGPU testing examples:

```markdown
## WebGPU Testing

### Unit Tests (Mocked)

For testing logic without GPU:

\`\`\`typescript
import { createMockWebGPUContext } from '@quake2ts/test-utils';

test('creates uniform buffer', () => {
  const { device } = createMockWebGPUContext();
  const buffer = new UniformBuffer(device, { size: 256 });
  expect(buffer.size).toBe(256);
});
\`\`\`

### Integration Tests (Headless)

For testing actual rendering with @webgpu/dawn:

\`\`\`typescript
import { createRenderTestSetup, renderAndCapture } from '@quake2ts/test-utils';

test('renders triangle', async () => {
  const setup = await createRenderTestSetup();
  const pixels = await renderAndCapture(setup, (pass) => {
    // ... render triangle
  });
  // Validate pixels
  await setup.cleanup();
});
\`\`\`
```

**Subtasks:**
1. Export all WebGPU testing utilities
2. Document mock usage patterns
3. Document headless testing patterns
4. Provide code examples
5. Explain when to use mocks vs headless

---

## Deliverables

### New Files Created
- `packages/test-utils/src/setup/webgpu.ts` (~150 lines)
- `packages/test-utils/src/engine/mocks/webgpu.ts` (~600 lines)
- `packages/test-utils/src/engine/helpers/webgpu-rendering.ts` (~300 lines)
- `packages/test-utils/src/engine/helpers/pipeline-test-template.ts` (~200 lines)
- `packages/engine/tests/setup-webgpu.ts` (~50 lines)

### Modified Files
- `packages/test-utils/package.json` (add @webgpu/dawn)
- `packages/test-utils/src/index.ts` (exports)
- `packages/test-utils/README.md` (documentation)
- `packages/engine/vitest.config.ts` (setup file)

### Tests Created
- `packages/test-utils/tests/webgpu-mocks.test.ts` (~150 lines)
  - Test mocks satisfy type system
  - Test mock behavior

- `packages/test-utils/tests/webgpu-headless.test.ts` (~100 lines)
  - Test headless initialization
  - Test render utilities
  - Test cleanup

---

## Testing Strategy

### Unit Tests

Test the testing infrastructure itself:
- Mocks create valid objects
- Headless setup works
- Cleanup doesn't leak resources

### Integration Tests

Use headless rendering to test utilities:

```typescript
test('headless rendering produces pixel data', async () => {
  const setup = await createRenderTestSetup(2, 2);

  const pixels = await renderAndCapture(setup, (pass) => {
    // Render single red pixel at 0,0
  });

  // Validate red pixel at top-left
  expect(pixels[0]).toBe(255);  // R
  expect(pixels[1]).toBe(0);    // G
  expect(pixels[2]).toBe(0);    // B
  expect(pixels[3]).toBe(255);  // A

  await setup.cleanup();
});
```

---

## Success Criteria

- [ ] @webgpu/dawn installs and runs in Node.js
- [ ] Can create headless WebGPU context in tests
- [ ] Comprehensive mocks available for unit testing
- [ ] Render test utilities can capture pixels
- [ ] Compute test utilities can read back buffers
- [ ] All tests pass
- [ ] Documentation explains usage patterns
- [ ] No resource leaks between tests

---

## References

**Existing Code:**
- `packages/test-utils/src/mocks/webgl2.ts` - WebGL mock equivalent
- `packages/engine/tests/render.bspPipeline.test.ts` - Example pipeline tests

**External:**
- [@webgpu/dawn npm package](https://www.npmjs.com/package/@webgpu/dawn)
- [WebGPU Test Utilities Examples](https://github.com/gpuweb/cts)

---

## Notes for Implementer

- **Mock Completeness:** Don't need 100% API coverage. Focus on what rendering pipelines use.
- **Headless Performance:** @webgpu/dawn initialization is slow (~500ms). Do it once in beforeAll, not per-test.
- **Memory Leaks:** Always call cleanup() in finally blocks. Use afterEach hooks as safety net.
- **Platform Support:** @webgpu/dawn may not work on all platforms. Document requirements (x64, ARM, etc.)
- **CI/CD:** Test in CI early to catch platform issues. May need specific runner configuration.

---

**Next Section:** [20-4: PNG Snapshot Testing Framework](section-20-4.md)
