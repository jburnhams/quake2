# WebGL Lightmap Rendering Issue

## ✅ RESOLVED

**Status**: Fixed (January 2026)

**Root Cause**: Lightmap UV coordinate calculation produced texel-space coordinates instead of normalized [0, 1] coordinates, causing incorrect atlas remapping.

**Fix Applied**: Modified `createBspSurfaces()` in `quake2ts/packages/engine/src/render/bsp.ts` to output properly normalized lightmap UV coordinates.

---

## Root Cause Analysis

### The Problem

When lightmaps were present, surfaces rendered as tiny dots (~2 pixels) instead of properly-sized geometry, even though:
- Vertex positions were correct
- MVP matrix was correct
- Lightmap colors were correct (visible in the tiny dots)

### The Bug

The issue was in the lightmap UV coordinate calculation in `createBspSurfaces()`:

```typescript
// OLD CODE (incorrect):
lightmapCoords[k] = (textureCoords[k] / 16) - floorMinS + 0.5;
lightmapCoords[k+1] = (textureCoords[k+1] / 16) - floorMinT + 0.5;
```

This formula produced **texel-space coordinates** (e.g., 1.0 to 2.0 for a 3-texel lightmap) instead of **normalized [0, 1] coordinates**.

When these texel-space UVs were passed to `remapLightmapCoords()`:
```typescript
remapped = offset + coords * scale
// With texel-space coords [1.0, 2.0] and scale ~0.003:
// remapped = [0.004, 0.007] - pointing to WRONG atlas location!
```

The resulting atlas UVs pointed to positions 4-7 in the atlas, but the lightmap was actually at positions 1-3.

### The Fix

The UV calculation now produces properly normalized coordinates:

```typescript
// NEW CODE (correct):
const texRangeS = maxS - minS;
const texRangeT = maxT - minT;
for (let k = 0; k < lightmapCoords.length; k+=2) {
    // Normalize texture coord to [0, 1] within the surface's range
    const sNorm = texRangeS > 0 ? (textureCoords[k] - minS) / texRangeS : 0;
    const tNorm = texRangeT > 0 ? (textureCoords[k+1] - minT) / texRangeT : 0;
    // Map to texel centers, then normalize to [0, 1]
    lightmapCoords[k] = (0.5 + sNorm * (lmWidth - 1)) / lmWidth;
    lightmapCoords[k+1] = (0.5 + tNorm * (lmHeight - 1)) / lmHeight;
}
```

This produces:
- UV coordinates in normalized [0, 1] range
- Proper half-texel offset for sampling texel centers
- Correct linear interpolation across the surface

### Verification

For a 16×16 unit quad with a 3×3 lightmap:
- **Before fix**: UVs ranged [1.0, 2.0], atlas UVs pointed to pixels 4-7 (wrong!)
- **After fix**: UVs range [0.167, 0.833], atlas UVs point to pixels 1.5-3.5 (correct!)

All tests now pass:
- 64 WebGL visual tests ✅
- 229 unit tests ✅

---

## Technical Details

### Lightmap UV Coordinate Space

The Quake 2 lightmap system uses 1/16th resolution sampling:
- Texture coordinates are divided by 16 to get lightmap coordinates
- The `+0.5` offset centers samples on texel centers
- `floorMinS/T` accounts for the surface's position in lightmap space

### Atlas Remapping

Lightmaps are packed into atlas textures. The `remapLightmapCoords()` function expects normalized [0, 1] input:
```typescript
remapped = offset + coords * scale
```
Where:
- `offset` = position of lightmap in atlas (with padding)
- `scale` = size of lightmap in atlas (lmWidth/atlasSize)

### Why Geometry Appeared Tiny

The bug didn't actually make geometry tiny - the vertex positions were always correct. However, because the lightmap UVs pointed to the wrong atlas location (sampling padding/empty space), the rendered fragments showed incorrect/minimal color, making the surface appear as a tiny dot of color in the center where some valid lightmap data happened to be sampled.

---

## Files Changed

- `quake2ts/packages/engine/src/render/bsp.ts` - Fixed lightmap UV calculation
- `quake2ts/packages/engine/tests/webgl/__snapshots__/baselines/*.png` - Updated baselines

---

## Historical Investigation Notes

The investigation identified several red herrings before finding the root cause:

1. ❌ **Vertex positions** - Verified correct, positions copied unchanged
2. ❌ **MVP matrix** - Verified identical between lightmap/non-lightmap cases
3. ❌ **VAO layout** - Verified stride/offset configuration correct
4. ❌ **Light style factors** - Added defaults, but didn't fix geometry
5. ❌ **Lightmap dimensions** - Various test sizes tried, issue persisted
6. ✅ **UV coordinate calculation** - ROOT CAUSE FOUND

The key insight was that lightmap colors were correct (visible in tiny dots), proving the shader sampling worked - only the UV coordinates were wrong.
