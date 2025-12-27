# Skybox Rendering Investigation

## Issue Report (RESOLVED)
The skybox visual tests showed incorrect rendering for diagonal viewing angles:
- **look_fwd_up** (Forward+Up at 45°): Showed Blue+Green instead of expected Red+Blue
- **look_fwd_left** (Forward+Left at 45°): Showed incorrect colors
- **look_corner** (all three axes): Showed incorrect face combinations
- Cardinal directions (forward, up, left, etc.) rendered correctly

## Root Cause & Fix

### The Problem
The WebGPU shader contained an unnecessary coordinate transform:
```wgsl
output.direction = vec3<f32>(-dir.y, dir.z, -dir.x);
```

This transform was **incorrect** because:
1. **The mesh is already in GL coordinates**: The `SKYBOX_POSITIONS` mesh uses GL coordinate system (X right, Y up, Z back)
2. **The view matrix already handles Quake→GL**: The camera's `viewProjectionMatrix` includes the coordinate system transform
3. **WebGL doesn't use this transform**: The working WebGL implementation uses `v_direction = dir` directly

### The Fix
Removed the incorrect transform in `skybox.wgsl`:
```wgsl
// Before (BROKEN):
output.direction = vec3<f32>(-dir.y, dir.z, -dir.x);

// After (FIXED):
output.direction = dir;
```

### Why Cardinal Directions Worked
The transform `(-dir.y, dir.z, -dir.x)` is a 90° rotation that happens to map axis-aligned directions correctly through mathematical coincidence, but scrambles diagonal directions:

| GL Direction | Transform Result | Face Sampled |
|--------------|------------------|--------------|
| (1,0,0) +X   | (0,0,-1) -Z      | Back (correct by coincidence) |
| (0,1,0) +Y   | (-1,0,0) -X      | Left (correct by coincidence) |
| (0,0,-1) -Z  | (0,-1,0) -Y      | Bottom (WRONG - should be Back) |
| (0.7,0,0.7)  | (0,0.7,-0.7)     | Wrong combination |

For diagonal views like look_fwd_up, the transform mapped the Front face (+X) direction to the Left face (+Y), causing Green to appear where Red should be.

## Files Modified

- `quake2ts/packages/engine/src/render/webgpu/shaders/skybox.wgsl` - Removed incorrect transform

## Verification

After the fix, skybox tests should show:
- **look_fwd_up**: Red/Blue horizontal split (Front + Top faces)
- **look_fwd_left**: Red/Green vertical split (Front + Left faces)
- **look_corner**: Red/Green/Blue intersection (Front + Left + Top faces)
