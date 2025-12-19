# Section 20-19: Compute Shaders - Dynamic Lighting

**Phase:** 6 (WebGPU Enhancements)
**Priority:** LOW
**Dependencies:** 20-12 (Dynamic Lighting), 20-15 (Extended Interface)
**Estimated Effort:** 5-6 days

---

## Overview

Implement clustered forward lighting or light accumulation using compute shaders for better performance with many dynamic lights.

---

## Objectives

1. Support 100+ dynamic lights (vs 8 limit in traditional forward rendering)
2. Implement light culling on GPU
3. Accumulate lighting in compute pass
4. Demonstrate advanced WebGPU compute capabilities

---

## Tasks

### Task 1: Light Culling Compute Shader

**File:** `compute/lightCulling.wgsl`

**Approach:** Clustered forward rendering

**Subtasks:**
1. Divide screen into tiles (e.g., 16x16 pixels)
2. Compute which lights affect each tile
3. Write light indices to tile buffer
4. Use in fragment shader

**Algorithm:**
```wgsl
@compute @workgroup_size(16, 16)
fn cullLights(
  @builtin(global_invocation_id) tileID: vec3u
) {
  // Compute tile frustum
  // Test each light against frustum
  // Write visible light indices to buffer
}
```

**Test Cases:**
- Tiles computed correctly
- Light culling accurate
- Frustum tests correct
- Performance improved

---

### Task 2: Light Accumulation Buffer

**Subtasks:**
1. Create light index buffer (per-tile)
2. Create light data buffer (positions, colors, radii)
3. Update fragment shader to read from tile buffer
4. Accumulate lighting from all visible lights

**Test Cases:**
- Many lights render correctly
- Per-tile culling reduces fragment shader work
- Visual output matches traditional approach
- Performance scales with light count

---

### Task 3: Dynamic Light Updates

**Subtasks:**
1. Upload light data to GPU buffer
2. Dispatch light culling compute shader
3. Use results in fragment rendering
4. Handle light add/remove dynamically

**Test Cases:**
- Light updates reflected immediately
- Adding/removing lights works
- Buffer updates efficient

---

### Task 4: Performance Testing

**Benchmarks:**
- 8 lights (traditional approach)
- 50 lights (compute approach)
- 100 lights (compute approach)
- 500 lights (stress test)

**Metrics:**
- Frame time
- Culling time
- Fragment shader time

---

### Task 5: Visual Validation

**Visual Tests:**
- `compute-lighting-many.png` - 50+ lights
- `compute-lighting-clustered.png` - Complex scene with many lights

**Test Cases:**
- Matches traditional lighting visually
- Handles many lights
- No artifacts
- Performance acceptable

---

**References:**
- [Clustered Forward Rendering](http://www.aortiz.me/2018/12/21/CG.html)
- [Tiled Forward Shading](https://wickedengine.net/2018/01/10/optimizing-tile-based-light-culling/)

---

**Next Section:** [20-20: Compute Shaders - Post-Processing](section-20-20.md)
