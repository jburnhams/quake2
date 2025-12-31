# WebGL Lightmap Rendering Issue

## Update: Lightmap Colors Now Working! (Commit 69e8e803)

**Status**: ✅ Lightmap colors are now being applied correctly
**New Issue**: ⚠️ Geometry renders extremely small (tiny dots instead of full-size quads)

### Progress
After implementing the vertex layout changes and light style defaults:
- `lightmap-static-red.png`: Now shows a tiny **red** dot (was white square)
- `lightmap-styles.png`: Now shows a tiny **green** dot (was white square)
- Other BSP tests (e.g., `bsp-single-quad.png`) render at correct size

### Current Problem
The lightmap **colors** are correct, but the **geometry scale** is wrong:
- Test creates 256×256 unit quad (vertices from -128 to +128)
- Camera at [0, 0, 300] looking at [0, 0, 0]
- Should fill most of 256×256 viewport
- **Actually renders as ~2 pixel dot**

This suggests an issue in `createBspSurfaces()` when processing lightmap data, but NOT an issue with the lightmap sampling shader logic (which works correctly).

---

## Update: Integration Test Fixed

**Status**: Integration test crash fixed (commit fd0edee4)

The `lightstyles.test.ts` integration test was crashing with:
```
TypeError: Cannot read properties of undefined (reading 'join')
```

**Root Cause**: New fields `styleIndices` and `styleLayers` were added to `BspSurfaceGeometry` as required fields, but old code/tests didn't set them.

**Fixes Applied**:
1. Made `styleIndices` and `styleLayers` optional in `BspSurfaceGeometry` interface
2. Added default values `[0, 255, 255, 255]` and `[0, -1, -1, -1]` in rendering code when undefined
3. Updated integration test mock geometry to include these fields
4. Updated test expectations to check both `u_lightStyleFactors` and `u_styleLayerMapping` uniforms

**Result**: Integration tests now pass (48 tests passing).

---

## Issue Description

WebGL visual tests for lightmaps are passing but producing incorrect output:
- `lightmap-static-red.png` - Expected: red square, Actual: white square
- `lightmap-blend.png` - Expected: green checkerboard, Actual: black square
- `lightmap-styles.png` - Expected: magenta (red+blue blend), Actual: white square
- `lightmap-fullbright.png` - Expected: white (correct), Actual: white (coincidentally correct)

All 50 tests pass consistently, indicating the rendering is stable but systematically wrong.

## Test Setup

Tests create BSP surfaces with synthetic lightmap data:
- `tests/webgl/visual/world/lightmaps.test.ts`
- Lightmaps created with `createTestLightmap(width, height, r, g, b)`
- For single-style: 16x16 RGB data (768 bytes)
- For multi-style: Multiple RGB layers packed vertically (e.g., 16x48 for 3 styles)
- Styles specified in face data: `[0, 255, 255, 255]` for single style, `[0, 1, 2, 255]` for multi-style

## Findings

### 1. Missing Vertex Attribute
**File**: `quake2ts/packages/engine/src/render/bsp.ts`
- **Issue**: Shader expects `a_lightmapStep` attribute (location 3) but vertex layout only had 7 floats
- **Shader**: `quake2ts/packages/engine/src/render/bspPipeline.ts` - vertex shader uses `a_lightmapStep` to calculate vertical offset for multi-style layers
- **Fix Applied**: Updated `BSP_VERTEX_LAYOUT` to include lightmapStep as 8th float, changed stride from 7 to 8

### 2. Missing Light Style Default Values
**File**: `quake2ts/packages/engine/src/render/frame.ts`
- **Issue**: When `world.lightStyles` is undefined/empty, `effectiveLightStyles` array is empty
- **Impact**: Style 0 (always used) has undefined value, causing `resolveLightStyles()` to return 0.0 for all styles
- **Shader Logic**: Fragment shader multiplies lightmap color by style factor - if factor is 0, result is black
- **Fix Applied**: Initialize 64 light styles with default value 1.0 when not provided

### 3. Multi-Style Lightmap Dimension Validation
**File**: `quake2ts/packages/engine/src/render/bsp.ts` - `createBspSurfaces()`
- **Issue**: Size validation checked `samples.length === lmWidth * lmHeight * 3` (single layer only)
- **Impact**: Multi-style lightmaps with 3x the data were rejected
- **Fix Applied**: Calculate expected size as `lmWidth * lmHeight * 3 * numStyles` and set height to `lmHeight * numStyles`

## Attempted Fixes

### Fix 1: Added lightmapStep Vertex Attribute
- **Method**: `buildVertexData()` in `quake2ts/packages/engine/src/render/bsp.ts`
- **Change**: Calculate step as `placement.scale[1] / numValidStyles` and include in vertex data
- **Purpose**: Allows shader to offset V coordinate by `layer * v_lightmapStep` for multi-style sampling

### Fix 2: Default Light Style Values
- **Location**: `quake2ts/packages/engine/src/render/frame.ts` - light style preparation before rendering
- **Change**: Pre-populate 64 styles with 1.0 when `world.lightStyles` is empty or undefined
- **Purpose**: Ensure style 0 always has brightness value of 1.0 (full brightness)

### Fix 3: Flexible Lightmap Dimension Handling
- **Method**: `createBspSurfaces()` lightmap extraction logic
- **Change**: Accept lightmaps if they have valid data, infer dimensions from sample count if needed
- **Purpose**: Handle both single-style and multi-style lightmaps correctly

## Theories on Remaining Issue

### Theory 1: Lightmap Texture Upload Problem
**Suspect**: `quake2ts/packages/engine/src/render/bsp.ts` - `buildBspGeometry()` lightmap atlas creation
- The lightmap data might not be uploaded to GPU correctly
- Check: `writeLightmapIntoAtlas()` - RGB to RGBA conversion
- Check: `texture.uploadImage()` call parameters (format: gl.RGBA, type: gl.UNSIGNED_BYTE)
- **Test**: Atlas texture might be blank or improperly formatted

### Theory 2: Light Style Factor Computation
**Suspect**: `quake2ts/packages/engine/src/render/bspPipeline.ts` - `resolveLightStyles()`
- Despite default values, factors might still compute to 0.0
- The shader receives `u_lightStyleFactors` uniform - might not be bound correctly
- **Test**: Add logging to see actual factor values passed to shader

### Theory 3: Lightmap UV Coordinate Mismatch
**Suspect**: `quake2ts/packages/engine/src/render/bsp.ts` - UV remapping in `createBspSurfaces()`
- UV calculation: `(textureCoord / 16) - floorMin + 0.5`
- **Potential Issue**: For synthetic test lightmaps, this calculation might produce UVs outside [0,1] range
- **Potential Issue**: The `remapLightmapCoords()` function might be scaling/offsetting incorrectly with `placement.scale`
- **Test**: UVs might be pointing to empty/black areas of atlas

### Theory 4: Shader Uniform Binding
**Suspect**: `quake2ts/packages/engine/src/render/bspPipeline.ts` - `bind()` method
- `u_applyLightmap` might be false even when lightmap exists
- `u_fullbright` might be true, bypassing lightmap application
- `u_lightStyleFactors` might not be set correctly
- **Check**: Line ~427 - uniform binding sequence

### Theory 5: Test Data Format Mismatch
**Suspect**: `tests/webgl/visual/world/lightmaps.test.ts` - `createTestLightmap()`
- Test creates lightmap as raw RGB bytes but BSP system expects specific format
- The `lightmap` property passed to surface might need width/height metadata
- **Check**: How test lightmap integrates with `BspSurfaceInput.lightmap` field

## Key Code Locations

### Rendering Pipeline
- **BSP Pipeline**: `quake2ts/packages/engine/src/render/bspPipeline.ts`
  - `bind()` - Sets up shader uniforms including light styles
  - `resolveLightStyles()` - Converts style indices to factor array
  - Vertex shader - Uses `a_lightmapStep` attribute
  - Fragment shader - Samples lightmap with style-based Y offset

### Geometry Building
- **BSP Geometry**: `quake2ts/packages/engine/src/render/bsp.ts`
  - `createBspSurfaces()` - Extracts lightmap data from BSP faces
  - `buildBspGeometry()` - Creates GPU buffers and lightmap atlases
  - `buildVertexData()` - Interleaves vertex attributes including lightmapStep
  - `writeLightmapIntoAtlas()` - Copies RGB data to RGBA atlas

### Frame Rendering
- **Frame Renderer**: `quake2ts/packages/engine/src/render/frame.ts`
  - Light style preparation - Initializes default values
  - `resolveSurfaceTextures()` - Gets lightmap texture from atlas
  - `bindSurfaceTextures()` - Binds lightmap to texture unit 1

## Next Investigation Steps

1. **Add Debug Logging**:
   - Log `effectiveLightStyles` array values before rendering
   - Log `resolveLightStyles()` output - verify factors are 1.0 for style 0
   - Log lightmap texture dimensions and data in `buildBspGeometry()`

2. **Verify Shader Uniforms**:
   - Check `u_applyLightmap` value (should be true)
   - Check `u_fullbright` value (should be false for non-fullbright tests)
   - Check `u_lightStyleFactors` receives [1.0, 0.0, 0.0, 0.0] for single-style

3. **Inspect Atlas Texture**:
   - Verify lightmap atlas texture has non-zero RGB values
   - Check if test's RGB data (255, 0, 0) survives upload to GPU
   - Verify texture is bound to correct unit (1) when drawing

4. **Test UV Coordinates**:
   - Log raw lightmap UVs before and after remapping
   - Verify UVs fall within [0, 1] range for atlas sampling
   - Check if `placement.offset` and `placement.scale` are correct for test data
