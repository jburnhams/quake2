# Section 20-18: Compute Shaders - Particle Systems

**Phase:** 6 (WebGPU Enhancements)
**Priority:** LOW
**Dependencies:** 20-11 (Particle System), 20-15 (Extended Interface)
**Estimated Effort:** 4-5 days

---

## Overview

Offload particle physics and updates to GPU compute shaders for massive performance improvement.

---

## Objectives

1. Move particle updates from CPU to GPU
2. Implement particle physics in compute shader
3. Support 10,000+ particles efficiently
4. Demonstrate WebGPU compute capabilities

---

## Tasks

### Task 1: Compute Shader for Particle Updates

**File:** `compute/particleUpdate.wgsl`

```wgsl
struct Particle {
  position: vec3f,
  velocity: vec3f,
  color: vec4f,
  life: f32,
  size: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> deltaTime: f32;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= arrayLength(&particles)) { return; }

  var p = particles[index];

  // Update physics
  p.position += p.velocity * deltaTime;
  p.velocity.y -= 9.8 * deltaTime;  // Gravity
  p.life -= deltaTime;

  // Write back
  particles[index] = p;
}
```

**Subtasks:**
1. Define particle structure matching CPU side
2. Implement physics update (position, velocity, acceleration)
3. Handle particle lifetime
4. Support different particle types (smoke, explosion, etc.)
5. Collision detection (optional)

**Test Cases:**
- Particle positions update correctly
- Velocity integration accurate
- Gravity applied
- Particles die when lifetime expires

---

### Task 2: GPU Particle Buffer Management

**File:** `pipelines/particleSystemCompute.ts`

```typescript
class ComputeParticleSystem {
  private particleBuffer: StorageBuffer;  // Read/write from compute
  private computePipeline: ComputePipeline;

  constructor(device: GPUDevice, maxParticles: number)

  update(deltaTime: number): void  // Dispatch compute shader
  render(pass: GPURenderPassEncoder): void  // Render from same buffer
}
```

**Subtasks:**
1. Allocate storage buffer for particles
2. Create compute pipeline for updates
3. Implement dispatch (workgroup size calculation)
4. Synchronize compute and render passes
5. Handle buffer barriers if needed

**Test Cases:**
- Storage buffer created correctly
- Compute shader dispatches
- Results visible in render pass
- No race conditions

---

### Task 3: Particle Spawn and Management

**Subtasks:**
1. CPU-side particle emission
2. Upload new particles to GPU
3. Particle recycling (dead particles reused)
4. Particle sorting on GPU (optional, for transparency)

**Test Cases:**
- New particles spawn correctly
- Dead particles recycled
- Emission rate controllable

---

### Task 4: Performance Comparison

**Benchmarks:**
- CPU particle system (existing)
- GPU particle system (compute)
- Measure update time for 1k, 10k, 100k particles

**Expected Results:**
- GPU significantly faster for >1k particles
- Can handle 100k+ particles at 60 FPS

---

### Task 5: Integration & Visual Tests

**Visual Tests:**
- `compute-particles-explosion.png` - 10k particles
- `compute-particles-fountain.png` - Continuous emission
- `compute-particles-smoke.png` - Complex physics

**Test Cases:**
- Compute particles match CPU visual output
- Performance improved
- No visual artifacts
- Synchronization correct

---

**Reference:** `packages/engine/src/render/particleSystem.ts` (CPU version)

**WebGPU Compute:**
- [WebGPU Compute Shader Spec](https://www.w3.org/TR/webgpu/#computing)
- [WGSL Compute Examples](https://webgpu.github.io/webgpu-samples/samples/computeBoids)

---

**Next Section:** [20-19: Compute Shaders - Dynamic Lighting](section-20-19.md)
