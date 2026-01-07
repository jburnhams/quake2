**NOT STARTED**

Verified 2026-01-07:
- No `render/utils/` directory exists
- No shared geometry utilities extracted
- No shared lighting utilities extracted
- No shared texture resolution utilities extracted

**Blocked by:** Section 22-6 (WebGPU complete) and 22-8 (WebGL complete)

---

# Section 22-9: Pipeline Utilities & Shared Code

**Phase:** 4 (Consolidation)
**Effort:** 1-2 days
**Dependencies:** 22-6 (WebGPU complete), 22-8 (WebGL native)
**Merge Safety:** Refactoring, not behavior changes

---

## Overview

Extract shared utilities from WebGL and WebGPU pipelines. Reduce code duplication while maintaining API-specific implementations.

**Goal:** DRY up common code (geometry processing, texture management, shader compilation helpers) without coupling renderers.

---

## Tasks

### Task 1: Shared Geometry Utilities

**File:** `packages/engine/src/render/utils/geometry.ts` (new)

**Extract common geometry operations:**

```typescript
// Frustum culling (already exists, ensure both use it)
export { extractFrustumPlanes } from '../culling.js';
export { gatherVisibleFaces } from '../bspTraversal.js';

// Sorting utilities
export function sortFrontToBack(faces: VisibleFace[]): VisibleFace[] {
  return [...faces].sort((a, b) => b.sortKey - a.sortKey);
}

export function sortBackToFront(faces: VisibleFace[]): VisibleFace[] {
  return [...faces].sort((a, b) => a.sortKey - b.sortKey);
}

// Bounding calculations
export function computeBoundingSphere(positions: Float32Array): {
  center: vec3;
  radius: number;
} {
  // ... implementation ...
}
```

**Reference:** Currently duplicated in WebGL and WebGPU frame renderers

---

### Task 2: Shared Lighting Utilities

**File:** `packages/engine/src/render/utils/lighting.ts` (new)

**Light culling and management:**

```typescript
export { cullLights } from '../lightCulling.js';

export function evaluateLightStyle(pattern: string, time: number): number {
  if (!pattern) return 1.0;
  const frame = Math.floor(time * 10) % pattern.length;
  const charCode = pattern.charCodeAt(frame);
  return (charCode - 97) / 12.0;
}

export function prepareLightStyles(
  baseLightStyles: ReadonlyArray<number>,
  overrides?: Map<number, string>,
  timeSeconds: number = 0
): ReadonlyArray<number> {
  if (!overrides || overrides.size === 0) {
    return baseLightStyles;
  }

  const styles = [...baseLightStyles];
  for (const [index, pattern] of overrides) {
    while (styles.length <= index) styles.push(1.0);
    styles[index] = evaluateLightStyle(pattern, timeSeconds);
  }
  return styles;
}
```

**Reference:** Duplicated in WebGL and WebGPU frame renderers

---

### Task 3: Texture Resolution Utilities

**File:** `packages/engine/src/render/utils/textures.ts` (new)

**Material and texture lookups:**

```typescript
export interface TextureResolutionResult {
  diffuse?: any;  // Texture2D type (API-specific)
  lightmap?: any;
  refraction?: any;
}

export function resolveSurfaceTextures(
  geometry: BspSurfaceGeometry,
  materials: MaterialManager | undefined,
  textures: ReadonlyMap<string, any> | undefined,
  lightmaps: ReadonlyArray<any> | undefined,
  refractionTexture?: any
): TextureResolutionResult {
  // Try material system first
  const material = materials?.getMaterial(geometry.texture);
  let diffuse = material?.texture;

  // Fallback to static lookup
  if (!diffuse) {
    diffuse = textures?.get(geometry.texture);
  }

  // Resolve lightmap
  const lightmapIndex = geometry.lightmap?.atlasIndex;
  const lightmap = lightmapIndex !== undefined
    ? lightmaps?.[lightmapIndex]?.texture
    : undefined;

  return { diffuse, lightmap, refraction: refractionTexture };
}
```

**Reference:** Duplicated in WebGL and WebGPU BSP rendering

---

### Task 4: Viewport and Scissor Utilities

**File:** `packages/engine/src/render/utils/viewport.ts` (new)

**Common viewport calculations:**

```typescript
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeViewport(
  canvasWidth: number,
  canvasHeight: number,
  options?: {
    letterbox?: boolean;
    targetAspect?: number;
  }
): Viewport {
  // ... letterboxing logic if needed ...
  return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
}
```

---

### Task 5: Update Renderers to Use Shared Utilities

**WebGL Frame Renderer:**
```typescript
import { sortFrontToBack, sortBackToFront } from '../utils/geometry.js';
import { prepareLightStyles } from '../utils/lighting.js';
import { resolveSurfaceTextures } from '../utils/textures.js';

// Use shared functions instead of local implementations
const sortedOpaque = sortFrontToBack(opaqueFaces);
const effectiveLightStyles = prepareLightStyles(
  world.lightStyles,
  lightStyleOverrides,
  timeSeconds
);
```

**WebGPU Frame Renderer:**
```typescript
// Same imports, same usage
const sortedOpaque = sortFrontToBack(opaqueFaces);
```

---

### Task 6: Measure Code Reduction

**Metrics to track:**
- Lines of code before/after
- Number of duplicated functions eliminated
- Test coverage maintained

**Target:** Reduce duplication by >20%

---

## Validation

### Pre-Merge Checklist
- [ ] Shared utilities extracted
- [ ] Both renderers use shared code
- [ ] No behavior changes (refactoring only)
- [ ] Unit tests for shared utilities
- [ ] Integration tests still pass
- [ ] Code duplication reduced >20%

### Critical Tests

**Shared utilities must work for both renderers:**

```typescript
describe('Shared Lighting Utilities', () => {
  test('prepareLightStyles works for WebGL', () => {
    const styles = prepareLightStyles([1.0, 1.0, 1.0], new Map([[1, 'abcdefghijk']]), 0.5);
    // Use in WebGL renderer
  });

  test('prepareLightStyles works for WebGPU', () => {
    const styles = prepareLightStyles([1.0, 1.0, 1.0], new Map([[1, 'abcdefghijk']]), 0.5);
    // Use in WebGPU renderer
  });

  test('both produce same results', () => {
    // Validate consistency
  });
});
```

---

## Success Criteria

- [ ] Shared utilities extracted to `utils/`
- [ ] Both renderers use shared code
- [ ] No visual regressions
- [ ] Code duplication reduced >20%
- [ ] Test coverage maintained
- [ ] Documentation updated

---

**Next:** [Section 22-10: Visual Regression & Integration Tests](section-22-10.md)
