# Section 20-20: Compute Shaders - Post-Processing

## ⏳ NOT STARTED

**Status:** Future work - Phase 6 (WebGPU Enhancements)

**Prerequisites:**
- Section 20-13 (Post-Processing) ⏳ NOT STARTED
- Section 20-15 (Extended Interface) ⏳ NOT STARTED
- No `compute/` directory exists yet - will need to be created

**Scope Notes:**
- Implements post-processing effects using compute shaders
- Requires Section 20-13 (fragment-based post-processing) first
- Provides compute-based alternatives: blur, bloom, tone mapping
- Uses shared memory for performance optimization

**WebGPU Compute Benefits:**
- Better performance for complex effects like bloom
- Access to shared memory for separable filters
- More flexible image processing capabilities

---

**Phase:** 6 (WebGPU Enhancements)
**Priority:** LOW
**Dependencies:** 20-13 (Post-Processing), 20-15 (Extended Interface)
**Estimated Effort:** 3-4 days

---

## Overview

Implement post-processing effects using compute shaders for better performance and advanced effects like bloom, blur, tone mapping.

---

## Objectives

1. Implement compute-based post-processing
2. Add advanced effects not feasible in fragment shaders
3. Demonstrate image processing in compute
4. Enable effect chaining

---

## Tasks

### Task 1: Gaussian Blur Compute Shader

**File:** `compute/blur.wgsl`

**Two-pass separable blur:**

```wgsl
// Horizontal pass
@compute @workgroup_size(16, 16)
fn blurHorizontal(
  @builtin(global_invocation_id) id: vec3u
) {
  // Read from input texture
  // Apply horizontal blur kernel
  // Write to intermediate texture
}

// Vertical pass
@compute @workgroup_size(16, 16)
fn blurVertical(/* ... */) {
  // Similar for vertical
}
```

**Subtasks:**
1. Implement separable blur
2. Use shared memory for performance
3. Handle edge cases
4. Support variable kernel size

**Test Cases:**
- Blur produces smooth output
- No edge artifacts
- Shared memory optimization works
- Kernel size configurable

---

### Task 2: Bloom Effect

**File:** `compute/bloom.wgsl`

**Subtasks:**
1. Extract bright pixels (threshold)
2. Downsampling pass
3. Gaussian blur (from Task 1)
4. Upsampling and combine
5. Additive blend with original

**Test Cases:**
- Bright areas glow
- Bloom intensity controllable
- No artifacts
- Performance acceptable

---

### Task 3: Tone Mapping

**File:** `compute/tonemap.wgsl`

**Operators:**
- Reinhard
- ACES
- Uncharted 2

**Subtasks:**
1. Implement multiple tone mapping operators
2. Exposure control
3. Gamma correction
4. Output to final framebuffer

**Test Cases:**
- HDR values mapped to LDR correctly
- Different operators selectable
- Exposure adjustment works

---

### Task 4: Effect Pipeline

**File:** `pipelines/postProcessCompute.ts`

```typescript
class ComputePostProcess {
  applyBlur(input: GPUTexture, output: GPUTexture, radius: number): void
  applyBloom(input: GPUTexture, output: GPUTexture, threshold: number): void
  applyTonemap(input: GPUTexture, output: GPUTexture, exposure: number): void

  // Chain multiple effects
  applyEffectChain(effects: PostProcessEffect[]): void
}
```

**Subtasks:**
1. Manage intermediate textures
2. Chain compute dispatches
3. Handle texture barriers
4. Optimize effect order

**Test Cases:**
- Individual effects work
- Effects can chain
- Intermediate textures managed correctly
- No resource leaks

---

### Task 5: Visual Tests & Performance

**Visual Tests:**
- `compute-post-blur.png`
- `compute-post-bloom.png`
- `compute-post-tonemap.png`
- `compute-post-chain.png` - Multiple effects

**Performance:**
- Compare compute vs fragment shader post-processing
- Measure effect overhead

**Test Cases:**
- Visual output matches expectations
- Compute faster than fragment approach
- Can run multiple effects at 60 FPS

---

**References:**
- [GPU Gems - Bloom](https://developer.nvidia.com/gpugems/gpugems/part-ii-lighting-and-shadows/chapter-21-real-time-glow)
- [Tone Mapping](https://64.github.io/tonemapping/)

---

**Next Section:** [20-21: Compute Shaders - Advanced Features](section-20-21.md)
