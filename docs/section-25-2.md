# Section 25-2: Winding & Polygon Math

## Overview

Implement polygon (winding) operations in `@quake2ts/shared`. Windings are convex polygons used throughout BSP compilation for clipping, splitting, and face generation.

**Estimated Tasks**: 15
**Dependencies**: Section 25-1 (package setup)
**Can Parallelize With**: Section 25-3 (Map Parser), Section 25-4 (Primitives)

---

## 1. Winding Data Structure

### 1.1 Core Types

- [x] Create `packages/shared/src/math/winding.ts`
- [x] Define `Winding` interface
- [x] Define `WindingPoint` type

**File: `packages/shared/src/math/winding.ts`**
```typescript
import type { Vec3 } from './vec3';

/** A convex polygon in 3D space */
export interface Winding {
  points: Vec3[];
  numPoints: number;
}

/** Maximum points per winding (from q2tools/src/polylib.h:26) */
export const MAX_POINTS_ON_WINDING = 64;

/** Side classification for point/winding vs plane */
export const SIDE_FRONT = 0;
export const SIDE_BACK = 1;
export const SIDE_ON = 2;
export const SIDE_CROSS = 3;  // Winding spans plane
```

**Reference**: `q2tools/src/polylib.h` lines 22-35

### 1.2 Creation Functions

- [x] Implement `createWinding(numPoints: number): Winding`
- [x] Implement `copyWinding(w: Winding): Winding`
- [x] Implement `freeWinding(w: Winding): void` (no-op in JS, for API parity)

**Signatures:**
```typescript
export function createWinding(numPoints: number): Winding;
export function copyWinding(src: Winding): Winding;
export function reverseWinding(w: Winding): Winding;
```

**Reference**: `q2tools/src/polylib.c` lines 40-80

---

## 2. Base Winding from Plane

### 2.1 Create Large Winding on Plane

- [x] Implement `baseWindingForPlane(normal: Vec3, dist: number): Winding`

Creates a very large (MAX_WORLD_COORD) square winding lying on the given plane. This is the starting point before clipping to brush bounds.

**Signature:**
```typescript
export function baseWindingForPlane(normal: Vec3, dist: number): Winding;
```

**Algorithm** (from `q2tools/src/polylib.c:92-145`):
1. Find the axis with largest normal component
2. Create perpendicular vectors using cross products
3. Generate 4-point square at `MAX_WORLD_COORD` (8192) distance

**Reference**: `q2tools/src/polylib.c` lines 92-145 (`BaseWindingForPlane`)

### 2.2 Tests

- [x] Test: Axis-aligned plane (X, Y, Z) produces correct winding
- [x] Test: Angled plane produces valid convex quad
- [x] Test: Winding points are coplanar with input plane

---

## 3. Plane-Based Operations

### 3.1 Classify Winding Against Plane

- [x] Implement `windingOnPlaneSide(w: Winding, normal: Vec3, dist: number): number`

Returns `SIDE_FRONT`, `SIDE_BACK`, `SIDE_ON`, or `SIDE_CROSS`.

**Signature:**
```typescript
export function windingOnPlaneSide(
  w: Winding,
  normal: Vec3,
  dist: number,
  epsilon?: number
): number;
```

**Reference**: `q2tools/src/polylib.c` lines 425-465 (`WindingOnPlaneSide`)

### 3.2 Clip Winding to Plane

- [x] Implement `clipWindingEpsilon(w: Winding, normal: Vec3, dist: number, epsilon: number, front: boolean): Winding | null`

Clips a winding to one side of a plane. Returns the portion on the specified side, or null if entirely clipped away.

**Signature:**
```typescript
export function clipWindingEpsilon(
  w: Winding,
  normal: Vec3,
  dist: number,
  epsilon: number,
  keepFront: boolean
): Winding | null;

// Convenience wrapper with default epsilon
export function clipWinding(
  w: Winding,
  normal: Vec3,
  dist: number,
  keepFront: boolean
): Winding | null;
```

**Algorithm** (from `q2tools/src/polylib.c:252-350`):
1. Classify each point as front/back/on
2. Count points on each side
3. If all on one side, return copy or null
4. Walk edges, generating new points at intersections
5. Return clipped winding

**Reference**: `q2tools/src/polylib.c` lines 252-350 (`ClipWindingEpsilon`)

### 3.3 Split Winding by Plane

- [x] Implement `splitWinding(w: Winding, normal: Vec3, dist: number): { front: Winding | null, back: Winding | null }`

Splits winding into front and back portions.

**Signature:**
```typescript
export interface WindingSplit {
  front: Winding | null;
  back: Winding | null;
}

export function splitWinding(
  w: Winding,
  normal: Vec3,
  dist: number,
  epsilon?: number
): WindingSplit;
```

**Reference**: `q2tools/src/polylib.c` lines 352-423 (similar to clip but returns both sides)

### 3.4 Tests

- [x] Test: Clip square winding by diagonal plane produces triangle
- [x] Test: Clip winding entirely in front returns copy
- [x] Test: Clip winding entirely behind returns null
- [x] Test: Split produces two valid convex polygons
- [ ] Test: Split preserves total area (front + back = original)

---

## 4. Geometric Properties

### 4.1 Area Calculation

- [x] Implement `windingArea(w: Winding): number`

**Signature:**
```typescript
export function windingArea(w: Winding): number;
```

**Algorithm**: Sum of triangle fan areas from first vertex.

**Reference**: `q2tools/src/polylib.c` lines 159-180 (`WindingArea`)

### 4.2 Bounds Calculation

- [x] Implement `windingBounds(w: Winding): Bounds3`

**Signature:**
```typescript
export function windingBounds(w: Winding): Bounds3;
```

**Reference**: `q2tools/src/polylib.c` lines 182-195 (`WindingBounds`)

### 4.3 Center Point

- [x] Implement `windingCenter(w: Winding): Vec3`

**Signature:**
```typescript
export function windingCenter(w: Winding): Vec3;
```

**Reference**: `q2tools/src/polylib.c` lines 197-210 (`WindingCenter`)

### 4.4 Plane from Winding

- [x] Implement `windingPlane(w: Winding): { normal: Vec3, dist: number }`

Derives the plane equation from winding points.

**Signature:**
```typescript
export function windingPlane(w: Winding): { normal: Vec3; dist: number };
```

**Reference**: `q2tools/src/polylib.c` lines 212-230 (`WindingPlane`)

### 4.5 Tests

- [x] Test: Unit square area = 1.0
- [x] Test: Known triangle area matches formula
- [x] Test: Bounds contains all points
- [x] Test: Center is centroid
- [x] Test: Derived plane matches original (for baseWindingForPlane output)

---

## 5. Winding Validation

### 5.1 Point-in-Winding Test

- [x] Implement `pointInWinding(point: Vec3, w: Winding, normal: Vec3): boolean`

**Signature:**
```typescript
export function pointInWinding(point: Vec3, w: Winding, normal: Vec3): boolean;
```

### 5.2 Validate Winding

- [x] Implement `validateWinding(w: Winding): ValidationResult`

Checks for:
- Minimum 3 points
- All points coplanar
- Convex polygon
- No degenerate edges (zero length)
- No collinear consecutive points

**Signature:**
```typescript
export interface WindingValidation {
  valid: boolean;
  errors: string[];
}

export function validateWinding(w: Winding): WindingValidation;
```

### 5.3 Tests

- [x] Test: Valid triangle passes
- [x] Test: Valid quad passes
- [x] Test: Concave polygon fails
- [ ] Test: Degenerate (2 points) fails
- [ ] Test: Non-coplanar points fail

---

## 6. Advanced Operations

### 6.1 Chop Winding by Brush

- [ ] Implement `chopWindingInPlace(w: Winding, brush: MapBrush): Winding | null`

Clips winding against all planes of a brush (intersection).

**Signature:**
```typescript
export function chopWindingByPlanes(
  w: Winding,
  planes: Array<{ normal: Vec3; dist: number }>,
  epsilon?: number
): Winding | null;
```

**Reference**: `q2tools/src/brushbsp.c` uses this pattern extensively

### 6.2 Remove Colinear Points

- [ ] Implement `removeColinearPoints(w: Winding): Winding`

Simplifies winding by removing unnecessary points on straight edges.

**Signature:**
```typescript
export function removeColinearPoints(w: Winding, epsilon?: number): Winding;
```

**Reference**: `q2tools/src/polylib.c` lines 470-510 (`RemoveColinearPoints`)

### 6.3 Tests

- [ ] Test: Chop square by box leaves square (if inside)
- [ ] Test: Chop square by box clips corners (if overlapping)
- [ ] Test: Remove colinear reduces point count
- [ ] Test: Remove colinear preserves shape

---

## 7. Export from Shared

### 7.1 Update Exports

- [ ] Export winding functions from `packages/shared/src/math/index.ts`
- [ ] Export winding functions from `packages/shared/src/index.ts`

**File: `packages/shared/src/math/index.ts`**
```typescript
export * from './winding';
```

---

## 8. Integration Tests

### 8.1 Round-Trip Tests

- [ ] Test: Create base winding → clip to box → verify convex
- [ ] Test: Split winding → combine → equals original area
- [ ] Test: Multiple clips preserve validity

### 8.2 WASM Comparison Tests

- [ ] Compare `baseWindingForPlane` output with C implementation
- [ ] Compare `clipWinding` output with C implementation
- [ ] Compare `windingArea` output with C implementation

---

## Verification Checklist

- [ ] All winding functions exported from `@quake2ts/shared`
- [ ] Unit tests pass for all functions
- [ ] Integration tests pass for compound operations
- [ ] WASM comparison tests pass within epsilon tolerance
- [ ] No memory leaks (check with allocation tracking)
- [ ] Performance acceptable (<1ms for typical operations)
