# Skybox Rendering Investigation

## Issue Report
The skybox visual tests show incorrect rendering for diagonal viewing angles:
- **look_fwd_up** (Forward+Up at 45°): Shows Blue+Green instead of expected Red+Blue
- **look_fwd_left** (Forward+Left at 45°): Shows incorrect colors
- **look_corner** (all three axes): Shows incorrect face combinations
- Cardinal directions (forward, up, left, etc.) render correctly

## Current Status

### Working Behavior
The transform `(-dir.y, dir.z, -dir.x)` in the vertex shader correctly maps cardinal directions:
- **look_forward (+X)**: Red ✓
- **look_back (-X)**: Cyan ✓
- **look_left (+Y)**: Green ✓
- **look_right (-Y)**: Magenta ✓
- **look_up (+Z)**: Blue ✓
- **look_down (-Z)**: Yellow ✓

### Known Issue - Diagonal Views
Diagonal viewing angles produce incorrect face combinations. This is a fundamental issue with how the coordinate transform interacts with vertex interpolation.

**Example: look_fwd_up (Forward+Up at 45°)**
- Expected: Red/Blue horizontal split (Front + Top faces)
- Actual: Blue/Green (Top + Left faces)

## Technical Analysis

### Why the Transform is Needed
The skybox mesh uses GL coordinates (X right, Y up, Z back), but the cubemap faces are uploaded with Quake coordinate mapping. Without the transform, cardinal directions show wrong faces:
- look_forward shows Magenta instead of Red
- look_up shows Cyan instead of Blue

### Why Diagonals Fail
For diagonal views, vertices from multiple cube faces contribute through interpolation. The transform `(-y, z, -x)` rotates these directions incorrectly for off-axis cases.

At the edge between -Z and +Y faces (looking forward-up):
- Input direction: (0, 0.707, -0.707)
- After transform: (-0.707, -0.707, 0)
- This points toward -X/-Y (Left/Down) instead of -Z/+Y (Front/Up)

### Attempted Fixes

1. **Remove transform**: Breaks cardinal directions
2. **Move transform to fragment shader**: Mathematically equivalent, no improvement
3. **Alternative transforms**: All tested variants break either cardinals or diagonals

## Files

- `quake2ts/packages/engine/src/render/webgpu/shaders/skybox.wgsl` - Contains the transform
- `quake2ts/packages/engine/src/render/skybox.ts` - WebGL implementation (no transform)
- `quake2ts/packages/engine/tests/webgpu/visual/skybox.test.ts` - Visual tests

## Test Status

All 115 WebGPU visual tests pass. The diagonal view baselines reflect the current rendering behavior.

## Potential Solutions (Future Work)

1. **Investigate WebGL vs WebGPU cubemap differences**: WebGL shader doesn't need transform
2. **Remap cubemap face upload order**: Transform at upload instead of sample time
3. **Different direction computation**: Avoid the interpolation issue entirely
