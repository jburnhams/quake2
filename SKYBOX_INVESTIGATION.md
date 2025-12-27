# Skybox Rendering Investigation

## Issue Report
The skybox visual tests show incorrect rendering for diagonal viewing angles:
- **look_fwd_up** (Forward+Up at 45°): Shows Blue+Green instead of expected Red+Blue
- **look_fwd_left** (Forward+Left at 45°): Shows incorrect colors
- **look_corner** (all three axes): Shows incorrect face combinations
- Cardinal directions (forward, up, left, etc.) render correctly

## Investigation Summary

### Root Cause Identified
The WebGPU shader contains this coordinate transform on line 33:
```wgsl
output.direction = vec3<f32>(-dir.y, dir.z, -dir.x);
```

This transform is **incorrect** for the following reasons:

1. **The mesh is already in GL coordinates**: The `SKYBOX_POSITIONS` mesh uses GL coordinate system (X right, Y up, Z back)
2. **The WebGL shader doesn't have this transform**: The working WebGL implementation in `src/render/skybox.ts` uses `v_direction = dir` directly (line 63)
3. **The comment is misleading**: It claims to transform from "Quake coordinates" but the mesh isn't in Quake coordinates

### Comparison with WebGL Implementation

**WebGL shader (WORKING):**
```glsl
void main() {
  vec3 dir = normalize(a_position);
  dir.xy += u_scroll;
  v_direction = dir;  // NO coordinate transform
  gl_Position = u_viewProjectionNoTranslation * vec4(a_position, 1.0);
}
```

**WebGPU shader (BROKEN):**
```wgsl
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
  var dir = normalize(position);
  dir.x += uniforms.scroll.x;
  dir.y += uniforms.scroll.y;
  output.direction = vec3<f32>(-dir.y, dir.z, -dir.x);  // INCORRECT transform
  output.position = uniforms.viewProjection * vec4<f32>(position, 1.0);
  return output;
}
```

### Why Cardinal Directions Still Work

The incorrect transform happens to produce correct results for cardinal directions due to mathematical coincidence:
- When looking at +X face: dir = (1,0,0) → transform → (0,0,-1) which samples the correct face
- When looking at +Y face: dir = (0,1,0) → transform → (-1,0,0) which samples the correct face
- When looking at +Z face: dir = (0,0,1) → transform → (0,1,0) which samples the correct face

But for diagonal angles, the transform produces incorrect combinations.

### Attempted Fixes

1. **Remove transform entirely**: Gives wrong colors (Magenta/Cyan instead of Red/Blue)
   - Suggests there IS a coordinate system difference between WebGL and WebGPU cubemaps

2. **Add viewRotation matrix uniform**: Produced all-red output
   - Matrix packing or usage was incorrect

3. **Use clip-space position as direction**: Perspective distortion artifacts

4. **Negate Z coordinate only**: Still wrong colors

### Remaining Mystery

There appears to be a **coordinate system difference** between WebGL and WebGPU cubemap sampling that I haven't identified:
- WebGL cubemap uses left-handed coordinates
- WebGPU cubemap may use right-handed coordinates
- The face ordering or orientation might differ
- The view matrix construction might need adjustment

## Next Steps

To properly fix this issue, investigate:

1. **WebGPU cubemap coordinate system**: Verify if WebGPU uses different handedness or face ordering than WebGL
2. **View matrix construction in `camera.ts`**: Check if the Quake→GL transform in the view matrix needs adjustment for WebGPU
3. **Cubemap face upload**: Verify `TextureCubeMap.uploadFace()` maps faces correctly
4. **Reference implementations**: Compare with other WebGPU skybox implementations

## Files Involved

- `quake2ts/packages/engine/src/render/webgpu/shaders/skybox.wgsl` - Broken shader with incorrect transform
- `quake2ts/packages/engine/src/render/skybox.ts` - Working WebGL implementation
- `quake2ts/packages/engine/src/render/camera.ts` - View matrix construction
- `quake2ts/packages/engine/src/render/webgpu/resources.ts` - TextureCubeMap implementation
- `quake2ts/packages/engine/tests/webgpu/visual/skybox.test.ts` - Visual tests showing the issue

## Test Evidence

Current baselines (from commit c4042f0) were updated to match the **broken rendering**, not to fix it. The baseline images themselves are incorrect and should not be used as reference.

Run tests to see the issue:
```bash
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json \
ALWAYS_SAVE_SNAPSHOTS=1 \
pnpm run test:webgpu -- tests/webgpu/visual/skybox.test.ts
```
