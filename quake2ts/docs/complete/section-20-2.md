# Section 20-2: Core Resource Abstractions

## COMPLETED ✅

**Summary:** Full WebGPU resource abstractions implemented including buffers (vertex, index, uniform, storage), textures (2D with mipmap generation, cubemap), samplers, shader modules, render/compute pipelines, bind group management, render pass helpers, and memory tracking. All 38 unit tests pass.

---

**Phase:** 1 (Foundation)
**Priority:** CRITICAL
**Dependencies:** 20-1 (Context)
**Estimated Effort:** 5-7 days

---

## Overview

Implement WebGPU resource abstractions (buffers, textures, shaders, bind groups, render pipelines) that mirror the existing WebGL resource layer. These abstractions will be used by all rendering pipelines.

**Reference Implementation:** `packages/engine/src/render/resources.ts` (WebGL version)

---

## Objectives

1. Create buffer abstractions (vertex, index, uniform, storage)
2. Create texture abstractions (2D, cubemap)
3. Create shader and pipeline abstractions
4. Implement bind group management
5. Provide similar API to existing WebGL resources
6. Enable resource lifecycle management and memory tracking

---

## Tasks

### Task 1: Buffer Abstractions [COMPLETED]

**File:** `packages/engine/src/render/webgpu/resources.ts`

Implement buffer wrappers:

```typescript
class GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      usage: GPUBufferUsageFlags;
      label?: string;
    }
  )

  write(data: BufferSource, offset?: number): void
  mapAsync(): Promise<ArrayBuffer>
  unmap(): void
  destroy(): void

  get buffer(): GPUBuffer
  get size(): number
}

class VertexBuffer extends GPUBufferResource
class IndexBuffer extends GPUBufferResource
class UniformBuffer extends GPUBufferResource
class StorageBuffer extends GPUBufferResource
```

**Subtasks:**
1. Implement base GPUBufferResource class
2. Implement VertexBuffer with VERTEX usage flag
3. Implement IndexBuffer with INDEX usage flag
4. Implement UniformBuffer with UNIFORM | COPY_DST usage
5. Implement StorageBuffer with STORAGE | COPY_DST usage
6. Add write() method using device.queue.writeBuffer()
7. Add mapAsync/unmap for reading back storage buffers
8. Track buffer size for memory profiling
9. Implement destroy() for cleanup

**Test Cases:**
- Creates buffers with correct usage flags
- write() successfully updates buffer contents
- mapAsync/unmap work for readable buffers
- destroy() properly releases GPU resources
- Size tracking accurate

---

### Task 2: Texture Abstractions [COMPLETED]

**File:** Same as Task 1

Implement texture wrappers:

```typescript
class Texture2D {
  constructor(
    device: GPUDevice,
    descriptor: {
      width: number;
      height: number;
      format: GPUTextureFormat;
      usage?: GPUTextureUsageFlags;
      mipLevelCount?: number;
      label?: string;
    }
  )

  upload(data: BufferSource, options?: TextureUploadOptions): void
  generateMipmaps(commandEncoder: GPUCommandEncoder): void
  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView
  destroy(): void

  get texture(): GPUTexture
  get width(): number
  get height(): number
  get format(): GPUTextureFormat
  get memorySize(): number
}

class TextureCubeMap {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      format: GPUTextureFormat;
      usage?: GPUTextureUsageFlags;
      mipLevelCount?: number;
      label?: string;
    }
  )

  uploadFace(face: number, data: BufferSource, mipLevel?: number): void
  createView(): GPUTextureView
  destroy(): void

  get texture(): GPUTexture
  get size(): number
}
```

**Subtasks:**
1. Implement Texture2D class
2. Support upload via queue.writeTexture()
3. Implement mipmap generation (via compute or render passes)
4. Calculate memory size (width × height × format bytes × mips)
5. Implement TextureCubeMap with 6 layers
6. Support cubemap face uploads
7. Create appropriate texture views (2D vs Cube)
8. Handle common formats (rgba8unorm, rgba16float, depth24plus, etc.)

**Test Cases:**
- Creates textures with correct dimensions
- upload() transfers data to GPU
- Mipmap generation produces correct levels
- Memory size calculation accurate
- Cubemap has 6 layers
- Views can be created for sampling

---

### Task 3: Sampler Management [COMPLETED]

**File:** `packages/engine/src/render/webgpu/resources.ts`

Implement sampler abstractions:

```typescript
interface SamplerDescriptor {
  minFilter?: GPUFilterMode;
  magFilter?: GPUFilterMode;
  mipmapFilter?: GPUMipmapFilterMode;
  addressModeU?: GPUAddressMode;
  addressModeV?: GPUAddressMode;
  addressModeW?: GPUAddressMode;
  maxAnisotropy?: number;
  compare?: GPUCompareFunction;
}

class Sampler {
  constructor(device: GPUDevice, descriptor: SamplerDescriptor)

  get sampler(): GPUSampler
  destroy(): void
}

// Common samplers
function createLinearSampler(device: GPUDevice): Sampler
function createNearestSampler(device: GPUDevice): Sampler
function createClampSampler(device: GPUDevice): Sampler
function createRepeatSampler(device: GPUDevice): Sampler
```

**Subtasks:**
1. Implement Sampler class wrapping GPUSampler
2. Create factory functions for common sampler configs
3. Support anisotropic filtering
4. Support comparison samplers (for shadow mapping)

**Test Cases:**
- Creates samplers with correct filtering modes
- Address modes configured properly
- Common sampler factories work

---

### Task 4: Shader Module & Pipeline Abstractions [COMPLETED]

**File:** `packages/engine/src/render/webgpu/resources.ts`

Implement shader and pipeline wrappers:

```typescript
class ShaderModule {
  constructor(
    device: GPUDevice,
    descriptor: {
      code: string;  // WGSL source
      label?: string;
    }
  )

  get module(): GPUShaderModule
  get compilationInfo(): Promise<GPUCompilationInfo>
}

interface PipelineDescriptor {
  vertex: {
    module: ShaderModule;
    entryPoint: string;
    buffers: GPUVertexBufferLayout[];
  };
  fragment?: {
    module: ShaderModule;
    entryPoint: string;
    targets: GPUColorTargetState[];
  };
  primitive?: GPUPrimitiveState;
  depthStencil?: GPUDepthStencilState;
  multisample?: GPUMultisampleState;
  layout: GPUPipelineLayout | 'auto';
  label?: string;
}

class RenderPipeline {
  constructor(device: GPUDevice, descriptor: PipelineDescriptor)

  get pipeline(): GPURenderPipeline
  get layout(): GPUPipelineLayout
  destroy(): void
}

class ComputePipeline {
  constructor(
    device: GPUDevice,
    descriptor: {
      compute: {
        module: ShaderModule;
        entryPoint: string;
      };
      layout: GPUPipelineLayout | 'auto';
      label?: string;
    }
  )

  get pipeline(): GPUComputePipeline
  get layout(): GPUPipelineLayout
  destroy(): void
}
```

**Subtasks:**
1. Implement ShaderModule wrapper
2. Add compilation info access for debugging
3. Implement RenderPipeline wrapper
4. Support vertex buffer layouts
5. Support fragment targets and blending
6. Support depth/stencil state
7. Implement ComputePipeline wrapper (for later use)
8. Handle pipeline layout creation

**Test Cases:**
- Creates shader modules from WGSL source
- Compilation errors reported via compilationInfo
- Render pipelines created with correct state
- Compute pipelines created successfully
- Auto layout generation works

---

### Task 5: Bind Group Management [COMPLETED]

**File:** Same as Task 1

Implement bind group abstractions:

```typescript
interface BindGroupLayoutDescriptor {
  entries: {
    binding: number;
    visibility: GPUShaderStageFlags;
    buffer?: GPUBufferBindingLayout;
    texture?: GPUTextureBindingLayout;
    sampler?: GPUSamplerBindingLayout;
    storageTexture?: GPUStorageTextureBindingLayout;
  }[];
  label?: string;
}

class BindGroupLayout {
  constructor(device: GPUDevice, descriptor: BindGroupLayoutDescriptor)

  get layout(): GPUBindGroupLayout
}

interface BindGroupEntry {
  binding: number;
  resource: GPUBuffer | GPUTextureView | GPUSampler | GPUBindingResource;
}

class BindGroup {
  constructor(
    device: GPUDevice,
    layout: BindGroupLayout,
    entries: BindGroupEntry[],
    label?: string
  )

  get bindGroup(): GPUBindGroup
  destroy(): void
}

// Helper for creating common layouts
class BindGroupBuilder {
  addUniformBuffer(binding: number, visibility: GPUShaderStageFlags): this
  addTexture(binding: number, visibility: GPUShaderStageFlags): this
  addSampler(binding: number, visibility: GPUShaderStageFlags): this
  addStorageBuffer(binding: number, visibility: GPUShaderStageFlags): this
  build(device: GPUDevice): BindGroupLayout
}
```

**Subtasks:**
1. Implement BindGroupLayout wrapper
2. Implement BindGroup wrapper
3. Create BindGroupBuilder helper for ergonomic API
4. Support all binding types (buffer, texture, sampler, storage)
5. Validate binding entries match layout
6. Track bind groups for resource management

**Test Cases:**
- Creates bind group layouts
- Creates bind groups with correct resources
- Builder API creates correct layouts
- Validation catches mismatched layouts

---

### Task 6: Render Pass Helpers [COMPLETED]

**File:** Same as Task 1

Implement render pass descriptor helpers:

```typescript
interface RenderPassDescriptorBuilder {
  setColorAttachment(
    index: number,
    view: GPUTextureView,
    options?: {
      loadOp?: GPULoadOp;
      storeOp?: GPUStoreOp;
      clearValue?: GPUColor;
    }
  ): this;

  setDepthStencilAttachment(
    view: GPUTextureView,
    options?: {
      depthLoadOp?: GPULoadOp;
      depthStoreOp?: GPUStoreOp;
      depthClearValue?: number;
      stencilLoadOp?: GPULoadOp;
      stencilStoreOp?: GPUStoreOp;
      stencilClearValue?: number;
    }
  ): this;

  build(): GPURenderPassDescriptor;
}

function createRenderPassDescriptor(): RenderPassDescriptorBuilder
```

**Subtasks:**
1. Implement RenderPassDescriptorBuilder class
2. Support multiple color attachments
3. Support depth/stencil attachment
4. Provide sensible defaults (load: 'clear', store: 'store')
5. Validate attachment configurations

**Test Cases:**
- Builds valid render pass descriptors
- Color attachments configured correctly
- Depth attachment configured correctly
- Default values applied

---

### Task 7: Memory Tracking & Profiling [COMPLETED]

**File:** Same as Task 1

Add memory tracking similar to WebGL version:

```typescript
class GPUResourceTracker {
  trackBuffer(buffer: GPUBufferResource): void
  trackTexture(texture: Texture2D | TextureCubeMap): void
  untrackBuffer(buffer: GPUBufferResource): void
  untrackTexture(texture: Texture2D | TextureCubeMap): void

  get totalBufferMemory(): number
  get totalTextureMemory(): number
  get bufferCount(): number
  get textureCount(): number

  reset(): void
}
```

**Subtasks:**
1. Implement resource tracking registry
2. Track buffer memory by usage type
3. Track texture memory by format and dimensions
4. Provide memory statistics
5. Integrate with resource constructors/destroy methods

**Test Cases:**
- Accurately tracks buffer memory
- Accurately tracks texture memory
- Counts update on create/destroy
- Reset clears all tracking

---

## Deliverables

### New Files Created
- `packages/engine/src/render/webgpu/resources.ts` (~800 lines)

### Tests Created
- `packages/engine/tests/render/webgpu/resources.test.ts` (~500 lines)
  - Buffer creation and upload tests
  - Texture creation and upload tests
  - Shader module compilation tests
  - Pipeline creation tests
  - Bind group creation tests
  - Memory tracking tests
- `packages/engine/tests/integration/webgpu-resources.test.ts`
  - Integration tests for WebGPU resources using real @webgpu/dawn

---

## Testing Strategy

### Unit Tests (Mocked)

Expand WebGPU mocks from 20-1 to include:
- Mock GPUBuffer with size tracking
- Mock GPUTexture with dimension tracking
- Mock GPUShaderModule with compilation validation
- Mock GPURenderPipeline
- Mock GPUBindGroup

Test resource creation logic, memory calculations, lifecycle.

### Integration Tests (Headless)

Test with real @webgpu/dawn:

```typescript
test('creates and uploads vertex buffer', async () => {
  const context = await createWebGPUContext();
  const buffer = new VertexBuffer(context.device, { size: 1024 });

  const data = new Float32Array([1, 2, 3, 4]);
  buffer.write(data);

  expect(buffer.size).toBe(1024);
  buffer.destroy();
});

test('compiles valid WGSL shader', async () => {
  const context = await createWebGPUContext();
  const shader = new ShaderModule(context.device, {
    code: `@vertex fn main() -> @builtin(position) vec4f { return vec4f(0.0); }`
  });

  const info = await shader.compilationInfo();
  expect(info.messages).toHaveLength(0);
});
```

---

## Success Criteria

- [x] All buffer types can be created and written to
- [x] Textures can be created, uploaded, and sampled
- [x] Shaders compile from WGSL source
- [x] Render pipelines can be created with various states
- [x] Bind groups can be created and bound
- [x] Memory tracking accurately reports usage
- [x] All tests pass (unit and integration)
- [x] No modifications to existing WebGL resources

---

## References

**Existing Code:**
- `packages/engine/src/render/resources.ts` - WebGL equivalent (251 lines)
- `packages/engine/src/render/bspPipeline.ts:270-350` - Example buffer usage

**WebGPU Spec:**
- [WebGPU Buffers](https://www.w3.org/TR/webgpu/#buffers)
- [WebGPU Textures](https://www.w3.org/TR/webgpu/#textures)
- [WebGPU Pipelines](https://www.w3.org/TR/webgpu/#pipelines)
- [WebGPU Bind Groups](https://www.w3.org/TR/webgpu/#bind-groups)

---

## Notes for Implementer

- **Buffer Mapping:** Most buffers don't need mapping. Only storage buffers for compute shader readback.
- **Texture Uploads:** Use `queue.writeTexture()` for simplicity initially. Optimize later with staging buffers if needed.
- **Mipmap Generation:** Can be done via render passes (blit) or compute shaders. Start with render passes.
- **Pipeline Layout:** Use 'auto' layout initially to let WebGPU infer from shaders. Explicit layouts for optimization later.
- **Bind Group Caching:** Not needed initially. Each pipeline can create bind groups on demand.
- **Resource Labels:** Use descriptive labels for all resources to aid debugging with tools like RenderDoc or Chrome DevTools.

---

**Next Section:** [20-3: Headless Testing Infrastructure](section-20-3.md)
