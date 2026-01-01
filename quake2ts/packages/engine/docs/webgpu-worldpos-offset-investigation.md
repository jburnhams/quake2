# WebGPU WorldPos Offset Bug Investigation

## Problem Summary

Dynamic lights in WebGPU rendering appear at the **wrong position** on surfaces. A light placed at the center of a wall illuminates the **bottom-right corner** instead of the center.

## Confirmed Symptom

Through visual testing, we confirmed that:

```
worldPos (in fragment shader) = position - surface.mins
```

Instead of the expected:

```
worldPos = position (absolute world coordinates)
```

### Evidence

1. **Light at origin test**: A light at world origin `(0,0,0)` creates maximum brightness at the corner where `position = mins`. If `worldPos = position - mins`, then `worldPos = (0,0,0)` at that corner, making it coincide with the light position.

2. **Distance calculations**: With the buggy offset:
   - Bottom-right corner: `worldPos = (0,0,0)`, distance to light `(180,0,100)` ≈ 206 units
   - Center: `worldPos = (0,200,200)`, distance to light ≈ 287 units
   - Result: Bottom-right is **closer** to light, explaining the visual bug

## Code Paths Investigated

### Vertex Data Creation

| Location | Status |
|----------|--------|
| `tests/webgpu/visual/lighting.test.ts` → `createTestBspGeometry()` | ✅ Creates absolute coordinates |
| `src/render/bsp/surface.ts` → `createBspSurfaces()` | ✅ Uses `bsp.vertices[]` directly |
| `src/render/bsp/generator.ts` → `generateBspGeometryData()` | ✅ Copies positions without transformation |

### GPU Upload Path

| Location | Status |
|----------|--------|
| `src/render/webgpu/renderer.ts` → `uploadBspGeometry()` | ✅ Writes `surface.vertexData` directly |
| `src/render/webgpu/resources.ts` → `GPUBufferResource.write()` | ✅ Calls `device.queue.writeBuffer()` with no transformation |

### Shader Code

| Location | Status |
|----------|--------|
| `src/render/webgpu/shaders/bsp.wgsl` → `vertexMain()` | ✅ Sets `output.worldPos = pos` directly |
| `src/render/webgpu/shaders/bsp.wgsl` → `fragmentMain()` | ✅ Uses `distance(input.worldPos, dlight.position)` |

### Pipeline Configuration

| Location | Status |
|----------|--------|
| `src/render/webgpu/pipelines/bspPipeline.ts` → constructor | ✅ Vertex layout: offset 0, float32x3, stride 32 |
| `src/render/webgpu/pipelines/bspPipeline.ts` → `draw()` | ✅ Calls `setVertexBuffer(0, geometry.gpuVertexBuffer)` |
| `src/render/webgpu/pipelines/bspPipeline.ts` → `bind()` | ✅ Light positions uploaded directly to uniform buffer |

### Frame Rendering

| Location | Status |
|----------|--------|
| `src/render/webgpu/frame.ts` → `renderFrame()` | ✅ Passes `dlights` to pipeline without transformation |
| `src/render/webgpu/frame.ts` → `drawSurfaceBatch()` | ✅ Uses `viewProjection` from camera |

## Verification Tests Created

### Unit Tests (CPU-side verification)

- `tests/render/webgpu/vertex-data-verification.test.ts` - Confirms vertex data contains absolute positions `(200,-200,-100)` not `(0,0,0)`
- `tests/render/webgpu/worldpos-coordinate.test.ts` - Mathematical proof of how the offset affects light distances
- `tests/render/webgpu/worldpos-output.test.ts` - Documents expected vs buggy color outputs

### Visual Tests (GPU-side proof)

- `tests/webgpu/visual/lighting-debug.visual.test.ts` - Shows light at center appearing at corner
- `tests/webgpu/visual/worldpos-debug.visual.test.ts` - Light at origin illuminates mins corner
- `tests/webgpu/visual/worldpos-zero-mins.visual.test.ts` - Tests with different mins values

## Current Status

**The root cause is NOT in our application code.**

Every code path from vertex data creation through GPU upload to shader execution has been traced. The CPU-side data is verified correct. The transformation `worldPos = position - mins` must occur:

1. During GPU buffer read (driver-level), OR
2. In varying interpolation (WebGPU/Vulkan behavior), OR
3. In some mechanism not yet identified

## Hypotheses to Explore

### H1: Lavapipe Software Renderer Issue

The tests run on `lavapipe` (Mesa's software Vulkan). This could be a driver-specific bug. Test on real GPU hardware to isolate.

### H2: Vertex Buffer Alignment/Padding Issue

WebGPU may have subtle alignment requirements causing bytes to be read from wrong offsets. The 32-byte stride matches our 8-float vertex, but there could be implicit padding.

### H3: Varying Interpolation Quirk

The `worldPos` varying is interpolated from vertex to fragment shader. Perspective-correct interpolation divides by W. Something in the `viewProjection` matrix could affect this.

### H4: Test Geometry Structure Issue

The test geometry includes `mins`/`maxs` metadata properties. While not used in rendering code, some framework behavior might be interpreting these.

## Future Work

1. **Hardware Test**: Run visual tests on actual GPU (not lavapipe) to determine if driver-specific

2. **Buffer Readback**: Create test that reads GPU buffer back to CPU after upload to verify data integrity

3. **Debug Shader**: Modify `bsp.wgsl` to output `worldPos` as fragment color to visualize actual values

4. **WebGL Comparison**: Verify WebGL renderer (`src/render/bspPipeline.ts`) doesn't have this issue with identical test geometry

5. **Matrix Investigation**: Examine `Camera` class (`src/render/camera.ts`) and `viewProjectionMatrix` construction for any coordinate system transformations that might affect worldPos interpretation

## Related Files

- Investigation doc: `docs/webgpu-lighting-coordinate-investigation.md`
- WebGPU context: `docs/section-22-0.md`
- Camera transforms: `src/render/camera.ts`
- Coordinate utilities: `src/render/transforms.ts`

## Workaround (if root cause not found)

Pass surface `mins` as a uniform and adjust in shader:

```
// In fragment shader
let correctedWorldPos = input.worldPos + surface.mins;
let dist = distance(correctedWorldPos, dlight.position);
```

This compensates for the offset but doesn't explain its origin.
