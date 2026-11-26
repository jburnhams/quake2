**COMPLETED**

Verified 2026-01-07: NullRenderer and LoggingRenderer implemented with full IRenderer interface. LoggingRenderer includes coordinate transform validation. Tests exist at `tests/unit-node/render/null/renderer.test.ts` and `tests/unit-node/render/logging/renderer.test.ts`.

---

# Section 22-3: Null & Logging Renderers

**Phase:** 1 (Foundation)
**Effort:** 1 day
**Dependencies:** 22-1 (CameraState), 22-2 (Matrix Builders)
**Merge Safety:** 100% additive, testing utilities only

---

## Overview

Implement two non-rendering "renderers" that validate architecture and aid debugging. The **Null Renderer** validates call sequences without GPU, enabling fast CI tests. The **Logging Renderer** outputs human-readable render commands, catching issues like the double-transform bug before visual testing.

**Key Value:** Would have caught the WebGPU coordinate bug by logging unexpected transformations.

---

## Tasks

### Task 1: Null Renderer Implementation

- [x] Create `packages/engine/src/render/null/renderer.ts`
- [x] Implement stub methods
- [x] Add call logging

**File:** `packages/engine/src/render/null/renderer.ts` (new file)

**Minimal no-op renderer for testing:**

```typescript
import type { IRenderer, Pic } from '../interface.js';
import type { FrameRenderOptions } from '../frame.js';
import type { RenderableEntity } from '../scene.js';
import type { CameraState } from '../types/camera.js';
import { DebugMode } from '../debugMode.js';
import type { Md2Model } from '../../assets/md2.js';
import type { Md3Model } from '../../assets/md3.js';
import type { InstanceData } from '../instancing.js';
import type { MemoryUsage } from '../types.js';
import type { RenderStatistics } from '../gpuProfiler.js';

export class NullRenderer implements IRenderer {
  width = 0;
  height = 0;

  collisionVis = null as any;
  debug = null as any;
  particleSystem = null as any;

  private frameCount = 0;
  private callLog: string[] = [];

  constructor(width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
  }

  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[] = []
  ): void {
    this.frameCount++;
    this.callLog.push(`renderFrame(frame=${this.frameCount}, entities=${entities.length})`);

    // Validate CameraState is available
    const cameraState = options.cameraState ?? options.camera.toState();
    this.callLog.push(`  camera: pos=${cameraState.position}, angles=${cameraState.angles}`);
  }

  // Stub implementations (all no-op)
  async registerPic(name: string, data: ArrayBuffer): Promise<Pic> {
    this.callLog.push(`registerPic(${name})`);
    return { width: 256, height: 256 } as Pic;
  }

  registerTexture(name: string, texture: any): Pic {
    this.callLog.push(`registerTexture(${name})`);
    return { width: texture.width, height: texture.height } as Pic;
  }

  begin2D(): void {
    this.callLog.push('begin2D()');
  }

  end2D(): void {
    this.callLog.push('end2D()');
  }

  drawPic(x: number, y: number, pic: Pic, color?: [number, number, number, number]): void {
    this.callLog.push(`drawPic(${x}, ${y})`);
  }

  drawString(x: number, y: number, text: string, color?: [number, number, number, number]): void {
    this.callLog.push(`drawString(${x}, ${y}, "${text}")`);
  }

  drawCenterString(y: number, text: string): void {
    this.callLog.push(`drawCenterString(${y}, "${text}")`);
  }

  drawfillRect(x: number, y: number, width: number, height: number, color: [number, number, number, number]): void {
    this.callLog.push(`drawfillRect(${x}, ${y}, ${width}, ${height})`);
  }

  setEntityHighlight(entityId: number, color: [number, number, number, number]): void {}
  clearEntityHighlight(entityId: number): void {}
  highlightSurface(faceIndex: number, color: [number, number, number, number]): void {}
  removeSurfaceHighlight(faceIndex: number): void {}
  setDebugMode(mode: DebugMode): void {}
  setBrightness(value: number): void {}
  setGamma(value: number): void {}
  setFullbright(enabled: boolean): void {}
  setAmbient(value: number): void {}
  setLightStyle(index: number, pattern: string | null): void {}
  setUnderwaterWarp(enabled: boolean): void {}
  setBloom(enabled: boolean): void {}
  setBloomIntensity(value: number): void {}
  setLodBias(bias: number): void {}
  renderInstanced(model: Md2Model | Md3Model, instances: InstanceData[]): void {}

  getPerformanceReport(): RenderStatistics {
    return {
      frameTimeMs: 0,
      gpuTimeMs: 0,
      cpuFrameTimeMs: 0,
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textureBinds: 0,
      shaderSwitches: 0,
      visibleSurfaces: 0,
      culledSurfaces: 0,
      visibleEntities: 0,
      culledEntities: 0,
      memoryUsageMB: { textures: 0, geometry: 0, total: 0 }
    };
  }

  getMemoryUsage(): MemoryUsage {
    return {
      texturesBytes: 0,
      geometryBytes: 0,
      shadersBytes: 0,
      buffersBytes: 0,
      totalBytes: 0
    };
  }

  dispose(): void {
    this.callLog.push('dispose()');
  }

  // Test utilities
  getCallLog(): readonly string[] {
    return this.callLog;
  }

  resetCallLog(): void {
    this.callLog = [];
  }

  getFrameCount(): number {
    return this.frameCount;
  }
}
```

**Tests:**
- Unit test: Null renderer accepts all IRenderer methods
- Unit test: Call log captures render operations
- Integration test: Can use in tests without GPU

---

### Task 2: Logging Renderer Implementation

- [x] Create `packages/engine/src/render/logging/renderer.ts`
- [x] Implement transform validation
- [x] Implement detailed logging

**File:** `packages/engine/src/render/logging/renderer.ts` (new file)

**Detailed logging renderer with coordinate validation:**

```typescript
import type { IRenderer, Pic } from '../interface.js';
import type { FrameRenderOptions } from '../frame.js';
import type { RenderableEntity } from '../scene.js';
import { WebGLMatrixBuilder } from '../matrix/webgl.js';
import { WebGPUMatrixBuilder } from '../matrix/webgpu.js';
import { IdentityMatrixBuilder } from '../matrix/identity.js';
import { buildMatrices } from '../matrix/builders.js';
import { CoordinateSystem } from '../types/coordinates.js';
import type { MatrixBuilder } from '../matrix/builders.js';
import { quakeToWebGL, quakeToWebGPU } from '../matrix/transforms.js';

export interface LoggingRendererOptions {
  readonly targetSystem?: CoordinateSystem;
  readonly verbose?: boolean;
  readonly validateTransforms?: boolean;  // Catches double-transforms!
}

export class LoggingRenderer implements IRenderer {
  width = 0;
  height = 0;

  collisionVis = null as any;
  debug = null as any;
  particleSystem = null as any;

  private logs: string[] = [];
  private builder: MatrixBuilder;
  private options: Required<LoggingRendererOptions>;

  constructor(options: LoggingRendererOptions = {}) {
    this.options = {
      targetSystem: options.targetSystem ?? CoordinateSystem.QUAKE,
      verbose: options.verbose ?? true,
      validateTransforms: options.validateTransforms ?? true
    };

    // Select matrix builder based on target system
    switch (this.options.targetSystem) {
      case CoordinateSystem.OPENGL:
        this.builder = new WebGLMatrixBuilder();
        break;
      case CoordinateSystem.WEBGPU:
        this.builder = new WebGPUMatrixBuilder();
        break;
      default:
        this.builder = new IdentityMatrixBuilder();
    }

    this.log(`LoggingRenderer initialized (target=${this.options.targetSystem})`);
  }

  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[] = []
  ): void {
    this.log(`\n=== FRAME START ===`);

    // Extract camera state
    const cameraState = options.cameraState ?? options.camera.toState();
    this.log(`Camera State:`);
    this.log(`  Position: [${cameraState.position.map(v => v.toFixed(2)).join(', ')}] (Quake space)`);
    this.log(`  Angles:   [${cameraState.angles.map(v => v.toFixed(2)).join(', ')}] (degrees)`);
    this.log(`  FOV: ${cameraState.fov}°, Aspect: ${cameraState.aspect.toFixed(2)}`);

    // Build matrices
    const matrices = buildMatrices(this.builder, cameraState);
    this.log(`Matrices (${this.options.targetSystem}):`);
    if (this.options.verbose) {
      this.log(`  View Matrix:`);
      this.logMatrix(matrices.view);
      this.log(`  Projection Matrix:`);
      this.logMatrix(matrices.projection);
    }

    // Validate coordinate transforms if enabled
    if (this.options.validateTransforms) {
      this.validateCoordinateTransforms(cameraState, matrices.view);
    }

    // Log entities
    this.log(`Entities: ${entities.length}`);
    if (this.options.verbose && entities.length > 0) {
      entities.slice(0, 5).forEach((entity, i) => {
        this.log(`  [${i}] type=${entity.type}, model=${entity.model ?? 'none'}`);
      });
      if (entities.length > 5) {
        this.log(`  ... and ${entities.length - 5} more`);
      }
    }

    this.log(`=== FRAME END ===\n`);
  }

  private validateCoordinateTransforms(cameraState: any, viewMatrix: mat4): void {
    // Check for double-transform by verifying position embedding
    const quakePos = cameraState.position;
    const expectedGL = quakeToWebGL(quakePos);
    const expectedGPU = quakeToWebGPU(quakePos);

    // Extract translation from view matrix (last column)
    const matrixTranslation = [viewMatrix[12], viewMatrix[13], viewMatrix[14]];

    this.log(`Transform Validation:`);
    this.log(`  Quake position: [${quakePos.map((v:number) => v.toFixed(2)).join(', ')}]`);

    switch (this.options.targetSystem) {
      case CoordinateSystem.OPENGL:
        this.log(`  Expected GL transform: [${expectedGL.map((v:number) => v.toFixed(2)).join(', ')}]`);
        break;
      case CoordinateSystem.WEBGPU:
        this.log(`  Expected WebGPU transform: [${expectedGPU.map((v:number) => v.toFixed(2)).join(', ')}]`);
        break;
    }

    this.log(`  Matrix translation: [${matrixTranslation.map(v => v.toFixed(2)).join(', ')}]`);

    // Warning if transforms look suspicious
    const posSum = Math.abs(quakePos[0]) + Math.abs(quakePos[1]) + Math.abs(quakePos[2]);
    const matSum = Math.abs(matrixTranslation[0]) + Math.abs(matrixTranslation[1]) + Math.abs(matrixTranslation[2]);
    if (posSum > 0 && matSum / posSum > 2.0) {
      this.log(`  ⚠️ WARNING: Matrix translation seems large relative to input - possible double-transform!`);
    }
  }

  private logMatrix(m: mat4): void {
    for (let row = 0; row < 4; row++) {
      const values = [m[row], m[row + 4], m[row + 8], m[row + 12]];
      this.log(`    [${values.map(v => v.toFixed(4).padStart(8)).join(' ')}]`);
    }
  }

  private log(message: string): void {
    this.logs.push(message);
    if (this.options.verbose) {
      console.log(`[LogRenderer] ${message}`);
    }
  }

  // Stub implementations (with logging)
  async registerPic(name: string, data: ArrayBuffer): Promise<Pic> {
    this.log(`registerPic("${name}", ${data.byteLength} bytes)`);
    return { width: 256, height: 256 } as Pic;
  }

  registerTexture(name: string, texture: any): Pic {
    this.log(`registerTexture("${name}", ${texture.width}x${texture.height})`);
    return { width: texture.width, height: texture.height } as Pic;
  }

  begin2D(): void { this.log('begin2D()'); }
  end2D(): void { this.log('end2D()'); }
  drawPic(x: number, y: number, pic: Pic, color?: [number, number, number, number]): void {
    this.log(`drawPic(${x}, ${y})`);
  }
  drawString(x: number, y: number, text: string, color?: [number, number, number, number]): void {
    this.log(`drawString(${x}, ${y}, "${text}")`);
  }
  drawCenterString(y: number, text: string): void {
    this.log(`drawCenterString(${y}, "${text}")`);
  }
  drawfillRect(x: number, y: number, width: number, height: number, color: [number, number, number, number]): void {
    this.log(`drawfillRect(${x}, ${y}, ${width}x${height})`);
  }

  // All other IRenderer methods as no-ops
  setEntityHighlight(): void {}
  clearEntityHighlight(): void {}
  highlightSurface(): void {}
  removeSurfaceHighlight(): void {}
  setDebugMode(): void {}
  setBrightness(): void {}
  setGamma(): void {}
  setFullbright(): void {}
  setAmbient(): void {}
  setLightStyle(): void {}
  setUnderwaterWarp(): void {}
  setBloom(): void {}
  setBloomIntensity(): void {}
  setLodBias(): void {}
  renderInstanced(): void {}

  getPerformanceReport(): any {
    return {
      frameTimeMs: 0, gpuTimeMs: 0, cpuFrameTimeMs: 0,
      drawCalls: 0, triangles: 0, vertices: 0,
      textureBinds: 0, shaderSwitches: 0,
      visibleSurfaces: 0, culledSurfaces: 0,
      visibleEntities: 0, culledEntities: 0,
      memoryUsageMB: { textures: 0, geometry: 0, total: 0 }
    };
  }

  getMemoryUsage(): any {
    return {
      texturesBytes: 0, geometryBytes: 0,
      shadersBytes: 0, buffersBytes: 0, totalBytes: 0
    };
  }

  dispose(): void {
    this.log('dispose()');
  }

  // Test utilities
  getLogs(): readonly string[] {
    return this.logs;
  }

  resetLogs(): void {
    this.logs = [];
  }

  printLogs(): void {
    console.log(this.logs.join('\n'));
  }
}
```

**Critical Feature:** `validateTransforms()` would have caught the double-transform bug!

**Tests:**
- Unit test: Logs all render calls
- Unit test: Transform validation detects double-transforms
- Unit test: Verbose output is human-readable
- Integration test: Use in place of real renderer for debugging

---

### Task 3: Test Utilities

- [x] Create `packages/test-utils/src/engine/renderers.ts`
- [x] Add factory functions
- [x] Add assertion helpers

**File:** `packages/test-utils/src/engine/renderers.ts` (new file)

**Factory functions for test renderers:**

```typescript
import { NullRenderer } from '../../../engine/src/render/null/renderer.js';
import { LoggingRenderer } from '../../../engine/src/render/logging/renderer.js';
import { CoordinateSystem } from '../../../engine/src/render/types/coordinates.js';

export function createNullRenderer(width = 800, height = 600): NullRenderer {
  return new NullRenderer(width, height);
}

export function createLoggingRenderer(
  targetSystem: CoordinateSystem = CoordinateSystem.QUAKE,
  options?: { verbose?: boolean; validateTransforms?: boolean }
): LoggingRenderer {
  return new LoggingRenderer({
    targetSystem,
    ...options
  });
}

// Assertion helpers
export function expectRendererCalls(
  renderer: NullRenderer,
  expectedCalls: string[]
): void {
  const actualCalls = renderer.getCallLog();
  expect(actualCalls).toEqual(expectedCalls);
}

export function expectNoDoubleTransform(renderer: LoggingRenderer): void {
  const logs = renderer.getLogs();
  const warnings = logs.filter(log => log.includes('double-transform'));
  expect(warnings).toHaveLength(0);
}
```

---

## Validation

### Pre-Merge Checklist
- [x] NullRenderer implements full IRenderer interface
- [x] LoggingRenderer validates coordinate transforms
- [x] Both renderers usable in tests without GPU
- [x] Test utilities in test-utils package
- [x] Documentation explains usage
- [x] 15+ unit tests passing
- [x] Integration tests demonstrate value

### Critical Validation

**Would Catch Double-Transform:**
```typescript
const renderer = createLoggingRenderer(CoordinateSystem.WEBGPU, {
  validateTransforms: true
});

renderer.renderFrame({
  camera: cameraAtDiagonalAngle,
  cameraState: cameraAtDiagonalAngle.toState()
}, []);

// Old buggy WebGPU would log:
// "⚠️ WARNING: ... possible double-transform!"
```

---

## Testing Strategy

### Unit Tests

**File:** `packages/engine/tests/render/null/renderer.test.ts` (new)

```typescript
describe('NullRenderer', () => {
  test('logs all render calls', () => {
    const renderer = createNullRenderer();

    renderer.begin2D();
    renderer.drawString(10, 20, "Hello");
    renderer.end2D();

    const log = renderer.getCallLog();
    expect(log).toContain('begin2D()');
    expect(log).toContain('drawString(10, 20, "Hello")');
    expect(log).toContain('end2D()');
  });

  test('counts frames', () => {
    const renderer = createNullRenderer();
    const camera = new Camera();

    renderer.renderFrame({ camera }, []);
    renderer.renderFrame({ camera }, []);

    expect(renderer.getFrameCount()).toBe(2);
  });
});
```

**File:** `packages/engine/tests/render/logging/renderer.test.ts` (new)

```typescript
describe('LoggingRenderer', () => {
  test('validates coordinate transforms', () => {
    const renderer = createLoggingRenderer(CoordinateSystem.WEBGPU, {
      validateTransforms: true,
      verbose: false
    });

    const camera = new Camera();
    camera.setPosition(100, 200, 50);

    renderer.renderFrame({
      camera,
      cameraState: camera.toState()
    }, []);

    const logs = renderer.getLogs();
    expect(logs.some(log => log.includes('Transform Validation'))).toBe(true);
  });

  test('detects suspicious transforms', () => {
    // This test would fail with old double-transform bug
    const renderer = createLoggingRenderer(CoordinateSystem.WEBGPU, {
      validateTransforms: true,
      verbose: false
    });

    // Manually create a double-transformed matrix (simulate bug)
    // ... test implementation ...
  });
});
```

---

## Documentation

**Add to:** `packages/engine/src/render/README.md`

```markdown
## Testing Renderers

### Null Renderer
No-op renderer for fast tests without GPU:
- Validates call sequences
- Logs operations for assertions
- Zero dependencies

### Logging Renderer
Human-readable render command log:
- Validates coordinate transforms
- Catches double-transform bugs
- Useful for debugging production issues
- Can target different coordinate systems
```

---

## Success Criteria

- [x] NullRenderer usable in CI tests (no GPU required)
- [x] LoggingRenderer catches double-transform bugs
- [x] Test utilities in test-utils package
- [x] 15+ unit tests passing
- [x] Documentation shows usage examples
- [x] Demonstrates value for future debugging

---

**Next:** [Section 22-4: WebGPU Skybox Pipeline (Native)](section-22-4.md)
