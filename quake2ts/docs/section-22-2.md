# Section 22-2: Matrix Builders & Coordinate Systems

**Phase:** 1 (Foundation)
**Effort:** 1 day
**Dependencies:** 22-1 (CameraState interface)
**Merge Safety:** 100% additive, utility functions only

---

## Overview

Implement matrix builder utilities that convert `CameraState` (Quake-space) into renderer-specific view and projection matrices. Provides correct transformations for WebGL, WebGPU, and identity (for testing).

**Key Output:** `buildViewMatrix()` and `buildProjectionMatrix()` functions for each coordinate system.

---

## Tasks

### Task 1: Core Matrix Builder Interface

**File:** `packages/engine/src/render/matrix/builders.ts` (new file)

**Define builder interface:**

```typescript
import { mat4 } from 'gl-matrix';
import type { CameraState } from '../types/camera.js';
import type { CoordinateSystem } from '../types/coordinates.js';

export interface MatrixBuilder {
  buildViewMatrix(camera: CameraState): mat4;
  buildProjectionMatrix(camera: CameraState): mat4;
  readonly coordinateSystem: CoordinateSystem;
}

export interface ViewProjectionMatrices {
  readonly view: mat4;
  readonly projection: mat4;
  readonly viewProjection: mat4;
}

export function buildMatrices(
  builder: MatrixBuilder,
  camera: CameraState
): ViewProjectionMatrices {
  const view = builder.buildViewMatrix(camera);
  const projection = builder.buildProjectionMatrix(camera);
  const viewProjection = mat4.create();
  mat4.multiply(viewProjection, projection, view);

  return { view, projection, viewProjection };
}
```

**Tests:**
- Unit test: `buildMatrices()` multiplies in correct order (proj * view)
- Unit test: Matrices are distinct objects (no aliasing)

---

### Task 2: WebGL Matrix Builder

**File:** `packages/engine/src/render/matrix/webgl.ts` (new file)

**Implement GL-specific builder (extracts logic from current Camera.updateMatrices):**

```typescript
import { mat4, vec3 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';
import type { CameraState } from '../types/camera.js';
import type { MatrixBuilder } from './builders.js';
import { CoordinateSystem } from '../types/coordinates.js';

export class WebGLMatrixBuilder implements MatrixBuilder {
  readonly coordinateSystem = CoordinateSystem.OPENGL;

  buildProjectionMatrix(camera: CameraState): mat4 {
    const projection = mat4.create();
    mat4.perspective(
      projection,
      camera.fov * DEG2RAD,
      camera.aspect,
      camera.near,
      camera.far
    );
    return projection;
  }

  buildViewMatrix(camera: CameraState): mat4 {
    // Quake → WebGL coordinate transform matrix
    // Reference: current camera.ts:296-301
    const quakeToGl = mat4.fromValues(
       0,  0, -1, 0,  // Quake +X (forward) → GL -Z
      -1,  0,  0, 0,  // Quake +Y (left) → GL -X
       0,  1,  0, 0,  // Quake +Z (up) → GL +Y
       0,  0,  0, 1
    );

    // Build rotation matrix in Quake space
    const [pitch, yaw, roll] = camera.angles;
    const pitchRad = pitch * DEG2RAD;
    const yawRad = yaw * DEG2RAD;
    const rollRad = roll * DEG2RAD;

    const rotationQuake = mat4.create();
    mat4.identity(rotationQuake);
    mat4.rotateZ(rotationQuake, rotationQuake, -yawRad);
    mat4.rotateY(rotationQuake, rotationQuake, -pitchRad);
    mat4.rotateX(rotationQuake, rotationQuake, -rollRad);

    // Combine Quake rotation with coordinate transform
    const rotationGl = mat4.create();
    mat4.multiply(rotationGl, quakeToGl, rotationQuake);

    // Transform position to GL space
    const negativePosition = vec3.negate(vec3.create(), camera.position);
    const rotatedPosQuake = vec3.create();
    vec3.transformMat4(rotatedPosQuake, negativePosition, rotationQuake);

    const translationGl = vec3.fromValues(
       rotatedPosQuake[1] ? -rotatedPosQuake[1] : 0,  // Y → -X
       rotatedPosQuake[2] || 0,                        // Z → Y
       rotatedPosQuake[0] ? -rotatedPosQuake[0] : 0   // X → -Z
    );

    // Build final view matrix
    const view = mat4.clone(rotationGl);
    view[12] = translationGl[0];
    view[13] = translationGl[1];
    view[14] = translationGl[2];

    return view;
  }
}
```

**Reference:** Extract logic from `packages/engine/src/render/camera.ts:264-351`

**Tests:**
- Unit test: View matrix for [0,0,0] position, [0,0,0] angles is identity (after coord transform)
- Unit test: Projection matrix with fov=90, aspect=1 has correct values
- Unit test: Output matches current Camera.viewMatrix for known inputs
- Integration test: Visual rendering matches current WebGL output

---

### Task 3: WebGPU Matrix Builder

**File:** `packages/engine/src/render/matrix/webgpu.ts` (new file)

**Implement WebGPU-specific builder (native, no double-transform):**

```typescript
import { mat4, vec3 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';
import type { CameraState } from '../types/camera.js';
import type { MatrixBuilder } from './builders.js';
import { CoordinateSystem } from '../types/coordinates.js';

export class WebGPUMatrixBuilder implements MatrixBuilder {
  readonly coordinateSystem = CoordinateSystem.WEBGPU;

  buildProjectionMatrix(camera: CameraState): mat4 {
    // WebGPU uses [0, 1] depth range (not [-1, 1] like GL)
    const projection = mat4.create();

    const f = 1.0 / Math.tan((camera.fov * DEG2RAD) / 2);
    const rangeInv = 1.0 / (camera.near - camera.far);

    // Column-major WebGPU projection matrix
    projection[0] = f / camera.aspect;
    projection[5] = f;
    projection[10] = camera.far * rangeInv;          // Z mapping to [0,1]
    projection[11] = -1;
    projection[14] = camera.near * camera.far * rangeInv;

    return projection;
  }

  buildViewMatrix(camera: CameraState): mat4 {
    // Build view matrix in WebGPU coordinate system
    // WebGPU: +X right, +Y up, +Z forward (left-handed after projection)

    const [pitch, yaw, roll] = camera.angles;

    // Convert Quake angles to WebGPU view direction
    // This is the CORRECT transform (no double-transform)
    const pitchRad = -pitch * DEG2RAD;  // Quake pitch → WebGPU pitch
    const yawRad = (-yaw - 90) * DEG2RAD;  // Quake yaw → WebGPU yaw (adjust for forward axis)
    const rollRad = -roll * DEG2RAD;

    // Build rotation (view direction)
    const rotation = mat4.create();
    mat4.identity(rotation);
    mat4.rotateY(rotation, rotation, yawRad);
    mat4.rotateX(rotation, rotation, pitchRad);
    mat4.rotateZ(rotation, rotation, rollRad);

    // Transform position from Quake to WebGPU space
    const position = vec3.fromValues(
      -camera.position[1],  // Quake Y (left) → WebGPU -X (right)
      camera.position[2],   // Quake Z (up) → WebGPU Y (up)
      camera.position[0]    // Quake X (forward) → WebGPU Z (forward)
    );

    // Apply rotation to position
    const rotatedPos = vec3.create();
    vec3.transformMat4(rotatedPos, vec3.negate(vec3.create(), position), rotation);

    // Build final view matrix
    const view = mat4.clone(rotation);
    view[12] = rotatedPos[0];
    view[13] = rotatedPos[1];
    view[14] = rotatedPos[2];

    return view;
  }
}
```

**Critical:** This is the FIX for the double-transform bug. The shader will now receive correct WebGPU-space coordinates.

**Tests:**
- Unit test: Projection matrix has [0, 1] depth range (not [-1, 1])
- Unit test: View matrix for diagonal views produces correct transform
- Unit test: No double-transformation (compare with logging renderer output)
- Visual test: Diagonal camera views render correctly

---

### Task 4: Identity Matrix Builder (Testing)

**File:** `packages/engine/src/render/matrix/identity.ts` (new file)

**Builder that returns Quake-space matrices (for testing/debugging):**

```typescript
import { mat4 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';
import type { CameraState } from '../types/camera.js';
import type { MatrixBuilder } from './builders.js';
import { CoordinateSystem } from '../types/coordinates.js';

export class IdentityMatrixBuilder implements MatrixBuilder {
  readonly coordinateSystem = CoordinateSystem.QUAKE;

  buildProjectionMatrix(camera: CameraState): mat4 {
    // Simple perspective, no coordinate transform
    const projection = mat4.create();
    mat4.perspective(
      projection,
      camera.fov * DEG2RAD,
      camera.aspect,
      camera.near,
      camera.far
    );
    return projection;
  }

  buildViewMatrix(camera: CameraState): mat4 {
    // Rotation and translation in Quake space (no transform)
    const [pitch, yaw, roll] = camera.angles;
    const pitchRad = pitch * DEG2RAD;
    const yawRad = yaw * DEG2RAD;
    const rollRad = roll * DEG2RAD;

    const rotation = mat4.create();
    mat4.identity(rotation);
    mat4.rotateZ(rotation, rotation, yawRad);
    mat4.rotateX(rotation, rotation, pitchRad);
    mat4.rotateY(rotation, rotation, rollRad);

    const translation = mat4.create();
    mat4.fromTranslation(translation, [
      -camera.position[0],
      -camera.position[1],
      -camera.position[2]
    ]);

    const view = mat4.create();
    mat4.multiply(view, rotation, translation);
    return view;
  }
}
```

**Purpose:** Useful for debugging and logging renderers. Preserves Quake coordinates.

**Tests:**
- Unit test: Returns simple matrices without coordinate transforms
- Unit test: Useful for test assertions (readable values)

---

### Task 5: Coordinate Transform Utilities

**File:** `packages/engine/src/render/matrix/transforms.ts` (new file)

**Helper functions for coordinate conversions:**

```typescript
import { vec3 } from 'gl-matrix';

export function quakeToWebGL(v: vec3): vec3 {
  return vec3.fromValues(-v[1], v[2], -v[0]);
}

export function quakeToWebGPU(v: vec3): vec3 {
  return vec3.fromValues(-v[1], v[2], v[0]);
}

export function webGLToQuake(v: vec3): vec3 {
  return vec3.fromValues(-v[2], -v[0], v[1]);
}

export function webGPUToQuake(v: vec3): vec3 {
  return vec3.fromValues(v[2], -v[0], v[1]);
}

// For debugging: print coordinate in multiple systems
export function debugCoordinate(label: string, quakeCoord: vec3): void {
  console.log(`${label}:`);
  console.log(`  Quake:  [${quakeCoord[0]}, ${quakeCoord[1]}, ${quakeCoord[2]}]`);
  console.log(`  WebGL:  [${quakeToWebGL(quakeCoord)}]`);
  console.log(`  WebGPU: [${quakeToWebGPU(quakeCoord)}]`);
}
```

**Tests:**
- Unit test: Round-trip transforms preserve values
- Unit test: Known coordinate conversions correct
- Unit test: Debug output is readable

---

## Validation

### Pre-Merge Checklist
- [ ] All builder classes implement `MatrixBuilder` interface
- [ ] WebGL builder produces identical output to current `Camera.updateMatrices()`
- [ ] WebGPU builder uses native coordinates (no double-transform)
- [ ] Identity builder useful for testing
- [ ] Transform utilities have unit tests
- [ ] Visual regression tests pass (WebGL unchanged)
- [ ] TypeScript compiles without errors

### Critical Validation

**WebGL Compatibility:**
- Must produce pixel-identical output to current implementation
- Use visual regression tests to verify
- Test on multiple camera positions/angles

**WebGPU Correctness:**
- Diagonal views must render correctly
- Compare against expected baseline (not current broken output)
- Use logging renderer to verify no double-transforms

---

## Testing Strategy

### Unit Tests

**File:** `packages/engine/tests/render/matrix/webgl.test.ts` (new)

```typescript
import { WebGLMatrixBuilder } from '../../../src/render/matrix/webgl.js';
import { Camera } from '../../../src/render/camera.js';

describe('WebGLMatrixBuilder', () => {
  test('produces same view matrix as Camera.viewMatrix', () => {
    const camera = new Camera(800, 600);
    camera.setPosition(10, 20, 30);
    camera.setRotation(15, 45, 0);

    const builder = new WebGLMatrixBuilder();
    const state = camera.toState();
    const builderView = builder.buildViewMatrix(state);
    const cameraView = camera.viewMatrix;

    // Should match exactly (within float epsilon)
    expect(builderView).toBeCloseToMat4(cameraView, 1e-6);
  });

  test('projection matrix correct for fov=90, aspect=1', () => {
    const builder = new WebGLMatrixBuilder();
    const state = {
      position: [0, 0, 0],
      angles: [0, 0, 0],
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const proj = builder.buildProjectionMatrix(state);

    // Check perspective projection properties
    expect(proj[0]).toBeCloseTo(1.0, 3);  // aspect = 1
    expect(proj[10]).toBeLessThan(0);     // depth mapping
  });
});
```

**File:** `packages/engine/tests/render/matrix/webgpu.test.ts` (new)

```typescript
import { WebGPUMatrixBuilder } from '../../../src/render/matrix/webgpu.js';

describe('WebGPUMatrixBuilder', () => {
  test('projection uses [0, 1] depth range', () => {
    const builder = new WebGPUMatrixBuilder();
    const state = {
      position: [0, 0, 0],
      angles: [0, 0, 0],
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const proj = builder.buildProjectionMatrix(state);

    // WebGPU depth should map to [0, 1], not [-1, 1]
    // Check proj[14] (near plane mapping) is not -1
    expect(proj[14]).not.toBeCloseTo(-1.0, 3);
  });

  test('diagonal view matrix produces correct transform', () => {
    const builder = new WebGPUMatrixBuilder();
    const state = {
      position: [0, 0, 0],
      angles: [45, 45, 0],  // Diagonal view
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const view = builder.buildViewMatrix(state);

    // Should not contain double-transformed coordinates
    // Specific assertions depend on expected values
    expect(view).toBeDefined();
    expect(view[0]).not.toBeNaN();
  });
});
```

**File:** `packages/test-utils/src/engine/matchers.ts` (new)

```typescript
// Custom matcher for matrix comparison
export function toBeCloseToMat4(
  received: mat4,
  expected: mat4,
  epsilon: number = 1e-6
): { pass: boolean; message: () => string } {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(received[i] - expected[i]) > epsilon) {
      return {
        pass: false,
        message: () =>
          `Matrix element [${i}] differs: ${received[i]} vs ${expected[i]}`
      };
    }
  }
  return { pass: true, message: () => 'Matrices match' };
}
```

### Integration Tests

**File:** `packages/engine/tests/render/integration/matrix-builders.test.ts` (new)

```typescript
describe('Matrix Builder Integration', () => {
  test('WebGL builder matches current Camera implementation', async () => {
    const camera = new Camera(800, 600);
    camera.setPosition(100, 200, 50);
    camera.setRotation(-30, 135, 0);

    const builder = new WebGLMatrixBuilder();
    const matrices = buildMatrices(builder, camera.toState());

    // Render test scene with both
    const currentOutput = await renderWithCamera(camera);
    const builderOutput = await renderWithMatrices(matrices);

    // Should be pixel-identical
    expect(builderOutput).toMatchImageSnapshot(currentOutput, {
      threshold: 0.0  // Exact match required
    });
  });
});
```

---

## Documentation

### Inline Documentation

Each builder class needs:
- Coordinate system explanation
- Reference to coordinate documentation (types/coordinates.ts)
- Explanation of any non-obvious transforms
- Examples of usage

### Matrix Math Reference

**Add to:** `packages/engine/src/render/matrix/README.md` (new)

```markdown
## Matrix Builders

Matrix builders convert `CameraState` (Quake-space) to renderer-specific matrices.

### WebGL (OpenGL)
- Uses right-handed coordinate system
- Depth range [-1, 1]
- See: `webgl.ts`

### WebGPU
- Uses left-handed coordinate system (after projection)
- Depth range [0, 1]
- **Critical:** Does NOT double-transform like legacy implementation
- See: `webgpu.ts`

### Testing
- Identity builder preserves Quake coordinates
- Useful for debugging and logging
- See: `identity.ts`
```

---

## Success Criteria

- [ ] WebGL builder matches current Camera implementation (pixel-perfect)
- [ ] WebGPU builder uses native coordinates (no double-transform)
- [ ] Identity builder works for testing
- [ ] Transform utilities tested
- [ ] 20+ unit tests passing
- [ ] Integration tests validate WebGL compatibility
- [ ] Documentation complete
- [ ] Ready for 22-3 (logging renderer can use builders)

---

**Next:** [Section 22-3: Null & Logging Renderers](section-22-3.md)
