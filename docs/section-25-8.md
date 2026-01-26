# Section 25-8: Lighting & Lightmaps

## Overview

Compute direct and indirect lighting, generate lightmaps, and pack them into the BSP.

**Estimated Tasks**: 20
**Dependencies**: Section 25-6 (BSP Tree)
**Can Parallelize With**: Section 25-7 (Visibility)

---

## 1. Lighting Concepts

### 1.1 Light Types

| Type | Entity | Description |
|------|--------|-------------|
| **Point** | `light` | Omnidirectional point light |
| **Spot** | `light` + `target` | Directed cone light |
| **Surface** | `light` + `_surface` | Emissive surface |
| **Sun** | `light` + `_sun` | Parallel directional light |
| **Sky** | Sky texture | Ambient sky contribution |

### 1.2 Lighting Pipeline

```
Lights + Faces → Direct Lighting → Lightmaps
                       ↓
              Radiosity Patches → Bounce Lighting
                       ↓
              Final Lightmaps → BSP Lighting Lump
```

**Reference**: `q2tools/src/lightmap.c`, `q2tools/src/rad.c`

---

## 2. Light Entities

### 2.1 Parse Light Entities

- [ ] Create `src/lighting/lights.ts`
- [ ] Implement light entity parsing

**File: `src/lighting/lights.ts`**
```typescript
export interface Light {
  type: 'point' | 'spot' | 'surface' | 'sun';
  origin: Vec3;
  intensity: number;
  color: Vec3;  // RGB, 0-1

  // Spot light
  direction?: Vec3;
  innerCone?: number;  // degrees
  outerCone?: number;  // degrees

  // Attenuation
  falloff?: 'linear' | 'inverse' | 'inverse_square';

  // Surface light
  surface?: string;  // Texture name for surface emission
}

/**
 * Extract lights from entity definitions
 */
export function parseLights(entities: EntityDef[]): Light[];
```

**Key Entity Properties:**
- `light` - Intensity value
- `_color` - RGB color (0-1 range)
- `target` - Makes it a spotlight (points at target entity)
- `_cone` - Spotlight cone angle
- `_sun` - Sun/directional flag
- `_surface` - Surface emission texture

**Reference**: `q2tools/src/rad.c` lines 200-400 (`MakeLights`)

### 2.2 Tests

- [ ] Test: Parse point light
- [ ] Test: Parse spotlight with target
- [ ] Test: Parse colored light
- [ ] Test: Default values applied

---

## 3. Ray Tracing

### 3.1 Ray-BSP Intersection

- [ ] Create `src/lighting/trace.ts`
- [ ] Implement ray tracing through BSP

**File: `src/lighting/trace.ts`**
```typescript
export interface TraceResult {
  hit: boolean;
  fraction: number;  // 0-1, where hit occurred
  hitPoint?: Vec3;
  hitNormal?: Vec3;
  hitContents?: number;
}

/**
 * Trace a ray through the BSP tree
 */
export function traceRay(
  start: Vec3,
  end: Vec3,
  tree: TreeElement,
  planes: CompilePlane[]
): TraceResult;
```

**Algorithm:**
1. Start at root node
2. Classify start/end against split plane
3. If both same side, recurse to that child
4. If different sides, check near child, then far child
5. Check against brush contents in leaves

**Reference**: `q2tools/src/lightmap.c` lines 300-450 (`TestLine`)

### 3.2 Shadow Testing

- [ ] Implement shadow ray testing

```typescript
/**
 * Test if a point is in shadow from a light
 */
export function isInShadow(
  point: Vec3,
  light: Light,
  tree: TreeElement,
  planes: CompilePlane[]
): boolean;
```

### 3.3 Tests

- [ ] Test: Ray through empty space returns no hit
- [ ] Test: Ray into solid returns hit
- [ ] Test: Shadow ray blocked by solid
- [ ] Test: Shadow ray passes through empty

---

## 4. Lightmap UVs

### 4.1 Calculate Lightmap Size

- [ ] Create `src/lighting/lightmap.ts`
- [ ] Implement lightmap sizing

**File: `src/lighting/lightmap.ts`**
```typescript
export interface LightmapInfo {
  width: number;
  height: number;
  mins: [number, number];  // UV mins
  maxs: [number, number];  // UV maxs
  luxelSize: number;  // World units per lightmap pixel
}

/**
 * Calculate lightmap dimensions for a face
 */
export function calculateLightmapSize(
  face: CompileFace,
  texInfo: BspTexInfo,
  luxelSize?: number
): LightmapInfo;
```

**Default luxel size**: 16 world units (from original Q2)

**Reference**: `q2tools/src/lightmap.c` lines 100-200 (`CalcFaceExtents`)

### 4.2 Sample Points

- [ ] Implement sample point generation

```typescript
/**
 * Generate world-space sample points for lightmap pixels
 */
export function generateSamplePoints(
  face: CompileFace,
  lightmapInfo: LightmapInfo,
  texInfo: BspTexInfo
): Vec3[];  // One per lightmap pixel
```

**Reference**: `q2tools/src/lightmap.c` lines 200-300 (`CalcPoints`)

### 4.3 Tests

- [ ] Test: Small face gets minimum lightmap size
- [ ] Test: Large face gets proportional size
- [ ] Test: Sample points lie on face plane

---

## 5. Direct Lighting

### 5.1 Calculate Direct Light

- [ ] Implement direct lighting calculation

```typescript
export interface LightSample {
  color: Vec3;  // RGB, can exceed 1.0
}

/**
 * Calculate direct lighting at a sample point
 */
export function calculateDirectLight(
  point: Vec3,
  normal: Vec3,
  lights: Light[],
  tree: TreeElement,
  planes: CompilePlane[]
): LightSample;
```

**Algorithm:**
1. For each light:
   - Calculate direction and distance
   - Apply attenuation
   - Test shadow ray
   - If not blocked, add contribution
   - Apply N·L (Lambert) factor

**Reference**: `q2tools/src/lightmap.c` lines 500-700 (`LightFace`)

### 5.2 Apply to Face

- [ ] Implement face lighting

```typescript
/**
 * Calculate lighting for all samples on a face
 */
export function lightFace(
  face: CompileFace,
  lightmapInfo: LightmapInfo,
  texInfo: BspTexInfo,
  lights: Light[],
  tree: TreeElement,
  planes: CompilePlane[]
): LightSample[];
```

### 5.3 Tests

- [ ] Test: Point directly under light is brightest
- [ ] Test: Points in shadow are dark
- [ ] Test: Light falls off with distance
- [ ] Test: Facing away from light is dark

---

## 6. Radiosity (Indirect Lighting)

### 6.1 Patch Subdivision

- [ ] Create `src/lighting/radiosity.ts`
- [ ] Implement patch creation

**File: `src/lighting/radiosity.ts`**
```typescript
export interface Patch {
  winding: Winding;
  origin: Vec3;  // Center point
  normal: Vec3;
  area: number;
  emissive: Vec3;  // Initial emission (for lights/sky)
  totalLight: Vec3;  // Accumulated light
  numTransfers: number;
  transfers: PatchTransfer[];
}

export interface PatchTransfer {
  patchIndex: number;
  formFactor: number;  // How much light transfers
}

/**
 * Subdivide faces into radiosity patches
 */
export function createPatches(
  faces: CompileFace[],
  patchSize?: number
): Patch[];
```

**Default patch size**: 64 world units

**Reference**: `q2tools/src/patches.c` lines 100-300 (`MakePatches`)

### 6.2 Form Factors

- [ ] Implement form factor computation

```typescript
/**
 * Calculate form factor between two patches
 * (How much light transfers from one to another)
 */
export function calculateFormFactor(
  source: Patch,
  dest: Patch,
  tree: TreeElement,
  planes: CompilePlane[]
): number;
```

**Algorithm:**
1. Calculate vector between centers
2. Check visibility (shadow ray)
3. Apply distance attenuation
4. Apply angle factors (both surface normals)
5. Scale by areas

**Reference**: `q2tools/src/patches.c` lines 400-600 (`MakeTransfers`)

### 6.3 Light Bounce

- [ ] Implement iterative light bouncing

```typescript
export interface RadiosityOptions {
  bounces: number;  // Number of bounce iterations
  threshold: number;  // Minimum energy to continue
  onProgress?: (bounce: number, energy: number) => void;
}

/**
 * Compute radiosity with light bouncing
 */
export function computeRadiosity(
  patches: Patch[],
  options?: RadiosityOptions
): void;  // Modifies patches in place
```

**Algorithm:**
```
for each bounce:
  for each patch:
    gather light from all visible patches via form factors
  check if total energy below threshold
```

**Reference**: `q2tools/src/rad.c` lines 500-700 (`BounceLight`)

### 6.4 Tests

- [ ] Test: Emissive patch illuminates neighbors
- [ ] Test: Light bounces off bright surfaces
- [ ] Test: Energy conserved (doesn't explode)
- [ ] Test: Converges after reasonable bounces

---

## 7. Lightmap Assembly

### 7.1 HDR to LDR Conversion

- [ ] Implement tone mapping

```typescript
/**
 * Convert HDR light values to 8-bit lightmap
 */
export function toneMapLightmap(
  samples: LightSample[],
  width: number,
  height: number,
  exposure?: number
): Uint8Array;  // RGB bytes
```

### 7.2 Lightmap Packing

- [ ] Implement lightmap atlas packing

```typescript
export interface PackedLightmaps {
  data: Uint8Array;  // All lightmap data
  faceOffsets: number[];  // Offset into data for each face
}

/**
 * Pack all face lightmaps into lighting lump
 */
export function packLightmaps(
  faces: Array<{
    lightmapInfo: LightmapInfo;
    samples: LightSample[];
  }>
): PackedLightmaps;
```

**Reference**: `q2tools/src/writebsp.c` lines 500-600

### 7.3 Tests

- [ ] Test: Lightmaps packed contiguously
- [ ] Test: Face offsets point to correct data
- [ ] Test: No buffer overflow

---

## 8. Light Styles

### 8.1 Multiple Light Styles

- [ ] Support multiple light styles per face

```typescript
export const MAX_LIGHTMAPS = 4;  // Per face

export interface FaceLighting {
  styles: number[];  // Up to 4 style indices
  lightmaps: Uint8Array[];  // One lightmap per style
}
```

Light styles allow animated/switchable lights.

**Reference**: `q2tools/src/lightmap.c` lines 50-80

### 8.2 Tests

- [ ] Test: Face with single style
- [ ] Test: Face with multiple styles
- [ ] Test: Style index matches entity

---

## 9. Lighting Options

### 9.1 Lighting Configuration

- [ ] Implement lighting options

```typescript
export interface LightingOptions {
  /** Lightmap resolution (default 16) */
  luxelSize?: number;

  /** Number of radiosity bounces (default 2) */
  bounces?: number;

  /** Enable indirect lighting */
  radiosity?: boolean;

  /** Sun light parameters */
  sun?: {
    direction: Vec3;
    color: Vec3;
    intensity: number;
  };

  /** Ambient light */
  ambient?: Vec3;

  /** Progress callback */
  onProgress?: (stage: string, percent: number) => void;
}
```

### 9.2 Fast Lighting Mode

- [ ] Implement fast lighting (direct only, no radiosity)

```typescript
/**
 * Quick lighting pass - direct light only
 */
export function computeFastLighting(
  faces: CompileFace[],
  texInfos: BspTexInfo[],
  lights: Light[],
  tree: TreeElement,
  planes: CompilePlane[]
): PackedLightmaps;
```

---

## 10. Integration

### 10.1 Add to Compiler

- [ ] Integrate lighting into BspCompiler

```typescript
// In BspCompiler.compile():
if (!options.noLighting) {
  const lights = parseLights(entities);
  const lighting = options.fastLighting
    ? computeFastLighting(faces, texInfos, lights, tree, planes)
    : computeFullLighting(faces, texInfos, lights, tree, planes, {
        bounces: options.radiosity ? 2 : 0,
        onProgress: (s, p) => options.onProgress?.(`lighting: ${s}`, p)
      });
  result.lighting = lighting;
}
```

### 10.2 Tests

- [ ] Test: Compiled BSP has lighting data
- [ ] Test: Engine renders lightmaps correctly

---

## 11. WASM Verification

### 11.1 Lightmap Comparison

- [ ] Compare lightmap dimensions per face
- [ ] Compare average brightness per face
- [ ] Compare total lighting data size

### 11.2 Visual Comparison

- [ ] Render same viewpoint with both BSPs
- [ ] Compare screenshots for major differences

---

## Verification Checklist

- [ ] Light entity parsing correct
- [ ] Ray tracing produces correct hits
- [ ] Shadow testing blocks correctly
- [ ] Lightmap sizing correct
- [ ] Sample points on face plane
- [ ] Direct lighting calculation correct
- [ ] Radiosity converges
- [ ] Tone mapping produces valid output
- [ ] Lightmap packing correct
- [ ] Light styles supported
- [ ] WASM comparison reasonable (lighting varies by implementation)
- [ ] Engine renders lightmaps correctly
