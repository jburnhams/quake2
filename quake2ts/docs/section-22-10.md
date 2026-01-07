**🔄 IN PROGRESS - Foundation Complete**

Status (2026-01-07):
- ✅ WebGPU camera angles test created (`tests/webgpu/visual/camera-angles.test.ts`) - 13 angle combinations
- ✅ Existing visual test infrastructure validated (17 WebGPU tests, 18 WebGL tests)
- ✅ Visual snapshot utilities working (`test-utils/src/visual/snapshots.ts`)
- ✅ GitHub Actions configured for both WebGPU and WebGL visual tests
- ⚠️ Additional test files need creation (see Remaining Work below)

**Note:** The infrastructure and patterns are established. Remaining work involves creating additional test files following the established patterns.

---

# Section 22-10: Visual Regression & Integration Tests

**Phase:** 4 (Consolidation)
**Effort:** 2 days
**Dependencies:** 22-6 (WebGPU complete), 22-8 (WebGL complete)
**Merge Safety:** Testing only, no code changes

---

## Overview

Comprehensive test suite validating both renderers produce correct output. Establishes baseline for future changes. Uses existing visual comparison framework (10% hard fail, 0.1% soft fail).

**Coverage:**
- All renderer features
- All camera angles
- Both renderers (WebGL, WebGPU)
- Comparison between renderers
- Regression against baselines

---

## Tasks

### Task 1: Comprehensive Camera Angle Tests

**File:** `packages/engine/tests/render/visual/camera-angles.test.ts` (new)

**Test all angle combinations:**

```typescript
const CAMERA_TEST_POSITIONS = [
  { pos: [0, 0, 50], angles: [0, 0, 0], label: 'origin-forward' },
  { pos: [0, 0, 50], angles: [45, 0, 0], label: 'origin-down' },
  { pos: [0, 0, 50], angles: [-45, 0, 0], label: 'origin-up' },
  { pos: [0, 0, 50], angles: [0, 45, 0], label: 'origin-right' },
  { pos: [0, 0, 50], angles: [0, -45, 0], label: 'origin-left' },
  { pos: [0, 0, 50], angles: [45, 45, 0], label: 'origin-diagonal' },
  { pos: [0, 0, 50], angles: [-45, -45, 0], label: 'origin-diagonal-neg' },
  { pos: [100, 200, 50], angles: [30, 135, 0], label: 'complex-position' },
  // ... at least 20 combinations ...
];

describe.each(['webgl', 'webgpu'] as const)('%s Camera Angles', (rendererType) => {
  test.each(CAMERA_TEST_POSITIONS)(
    '$label renders correctly',
    async ({ pos, angles, label }) => {
      const renderer = await createRenderer(rendererType);
      const camera = new Camera(800, 600);
      camera.setPosition(...pos);
      camera.setRotation(...angles);

      renderer.renderFrame({
        camera,
        cameraState: camera.toState(),
        world: testWorld,
        sky: testSky
      }, []);

      const output = await captureFramebuffer(renderer);
      await expectSnapshot(output).toMatchBaseline(
        `${rendererType}/camera-${label}.png`
      );
    }
  );
});
```

**Baselines:** Generate with logging renderer validation first

---

### Task 2: Feature Combination Tests

**File:** `packages/engine/tests/render/visual/features.test.ts` (new)

**Test feature combinations:**

```typescript
const FEATURE_COMBINATIONS = [
  { name: 'skybox-only', opts: { sky: testSky } },
  { name: 'bsp-only', opts: { world: testWorld } },
  { name: 'skybox-bsp', opts: { sky: testSky, world: testWorld } },
  { name: 'bsp-lighting', opts: { world: testWorld, dlights: [testLight] } },
  { name: 'full-scene', opts: { sky: testSky, world: testWorld, dlights: testLights }, entities: testEntities },
  // ... more combinations ...
];

describe.each(['webgl', 'webgpu'] as const)('%s Features', (rendererType) => {
  test.each(FEATURE_COMBINATIONS)(
    '$name renders correctly',
    async ({ name, opts, entities = [] }) => {
      const renderer = await createRenderer(rendererType);
      const camera = createTestCamera();

      renderer.renderFrame({
        camera,
        cameraState: camera.toState(),
        ...opts
      }, entities);

      const output = await captureFramebuffer(renderer);
      await expectSnapshot(output).toMatchBaseline(
        `${rendererType}/features-${name}.png`
      );
    }
  );
});
```

---

### Task 3: Cross-Renderer Comparison

**File:** `packages/engine/tests/render/visual/cross-renderer.test.ts` (new)

**WebGL vs WebGPU parity:**

```typescript
describe('WebGL vs WebGPU Parity', () => {
  test.each(SHARED_TEST_SCENES)(
    '$name produces similar output',
    async ({ name, scene, camera }) => {
      const webglRenderer = await createWebGLRenderer();
      const webgpuRenderer = await createWebGPURenderer();

      // Render same scene with both
      const webglOutput = await renderScene(webglRenderer, scene, camera);
      const webgpuOutput = await renderScene(webgpuRenderer, scene, camera);

      // Should be very close (allow minor FP differences)
      expect(webgpuOutput).toMatchImageSnapshot(webglOutput, {
        threshold: 0.001  // 0.1% soft fail
      });

      // Also check against baselines
      await expectSnapshot(webglOutput).toMatchBaseline(`webgl/${name}.png`);
      await expectSnapshot(webgpuOutput).toMatchBaseline(`webgpu/${name}.png`);
    }
  );
});
```

**Goal:** Verify both renderers produce visually equivalent output

---

### Task 4: Diagonal View Regression Tests

**File:** `packages/engine/tests/render/visual/diagonal-regression.test.ts` (new)

**Specific tests for the original bug:**

```typescript
describe('Diagonal View Bug Regression', () => {
  test('WebGPU diagonal view fixed', async () => {
    const renderer = await createWebGPURenderer();
    const camera = new Camera(800, 600);
    camera.setPosition(0, 0, 50);
    camera.setRotation(45, 45, 0);  // The problematic angle

    renderer.renderFrame({
      camera,
      cameraState: camera.toState(),
      sky: createColoredCubemap({
        right: [1, 0, 0, 1],   // Red
        left: [0, 1, 0, 1],    // Green
        top: [0, 0, 1, 1],     // Blue
        bottom: [1, 1, 0, 1],  // Yellow
        front: [1, 0, 1, 1],   // Magenta
        back: [0, 1, 1, 1]     // Cyan
      })
    }, []);

    const output = await captureFramebuffer(renderer);

    // Should show blend of correct faces (magenta/cyan/blue)
    // Old bug would show wrong faces
    await expectSnapshot(output).toMatchBaseline('webgpu/diagonal-45-45-fixed.png');

    // Verify no double-transform artifacts
    const centerPixel = getPixel(output, 400, 300);
    expect(centerPixel).not.toEqual([0, 0, 0, 255]);  // Not black (wrong transform)
  });

  test('all diagonal angles correct', async () => {
    const diagonalAngles = [
      [30, 30], [45, 45], [60, 60],
      [30, 45], [45, 30], [60, 45]
    ];

    for (const [pitch, yaw] of diagonalAngles) {
      const renderer = await createWebGPURenderer();
      const camera = new Camera(800, 600);
      camera.setRotation(pitch, yaw, 0);

      renderer.renderFrame({
        camera,
        cameraState: camera.toState(),
        sky: createColoredCubemap()
      }, []);

      const output = await captureFramebuffer(renderer);
      await expectSnapshot(output).toMatchBaseline(
        `webgpu/diagonal-${pitch}-${yaw}.png`
      );
    }
  });
});
```

---

### Task 5: Integration Test Suite

**File:** `packages/engine/tests/render/integration/full-renderer.test.ts` (new)

**Complex multi-feature tests:**

```typescript
describe('Full Renderer Integration', () => {
  test('complex scene with all features', async () => {
    const renderer = await createWebGPURenderer();

    const scene = {
      world: loadTestBspMap('complex'),
      sky: loadTestSkybox('space'),
      dlights: [
        createLight([100, 100, 50], [1, 0.8, 0.6], 200),
        createLight([200, 150, 40], [0.6, 0.8, 1.0], 150)
      ],
      entities: [
        createMD2Entity('player', [100, 100, 0]),
        createMD3Entity('weapon', [100, 100, 50])
      ],
      particles: createParticleSystem(100)
    };

    // Render from multiple viewpoints
    const viewpoints = [
      [100, 100, 50, 0, 0, 0],
      [200, 200, 100, -30, 135, 0],
      [150, 150, 30, 45, 225, 0]
    ];

    for (const [x, y, z, pitch, yaw, roll] of viewpoints) {
      const camera = new Camera(800, 600);
      camera.setPosition(x, y, z);
      camera.setRotation(pitch, yaw, roll);

      renderer.renderFrame({
        camera,
        cameraState: camera.toState(),
        ...scene
      }, scene.entities);

      const output = await captureFramebuffer(renderer);
      await expectSnapshot(output).toMatchBaseline(
        `integration/complex-${x}-${y}-${z}-${pitch}-${yaw}-${roll}.png`
      );
    }
  });
});
```

---

## Validation

### Pre-Merge Checklist
- [ ] 50+ visual regression baselines created
- [ ] All camera angles tested
- [ ] All feature combinations tested
- [ ] Cross-renderer comparison tests
- [ ] Diagonal view regression tests
- [ ] Integration tests cover complex scenes
- [ ] Baselines reviewed and approved
- [ ] Tests run in CI

### Baseline Generation Process

1. Run tests with logging renderer to validate no double-transforms
2. Generate images from both renderers
3. Manual review of images for correctness
4. Commit baselines to repo
5. Future runs compare against baselines

---

## Success Criteria

- [ ] 50+ visual regression tests passing
- [ ] WebGL and WebGPU produce similar output
- [ ] Diagonal view bug verified fixed
- [ ] All tests run in <5 minutes (headless)
- [ ] Baselines committed and documented
- [ ] CI configured to run visual tests

---

---

## Remaining Work

### Immediate Next Steps

1. **Create WebGL camera angles test** - Mirror the WebGPU test at `tests/webgl/visual/camera-angles.test.ts`
   - Use `testWebGLRenderer` helper from `@quake2ts/test-utils`
   - Follow pattern from existing WebGL visual tests
   - Use same camera positions array for consistency

2. **Create feature combination tests** - Both renderers need `features.test.ts`
   - Start with basic combinations (skybox-only, bsp-only, combined)
   - Add lighting combinations (dlights, lightmaps)
   - Add entity rendering combinations (MD2, MD3, particles)

3. **Create cross-renderer comparison** - `tests/render/visual/cross-renderer.test.ts`
   - Requires creating test scenes that work with both renderers
   - Use same camera and scene setup for both
   - Compare outputs with relaxed thresholds (allow minor FP differences)

4. **Extend diagonal regression tests** - Build on existing `skybox-diagonal.test.ts`
   - Add more diagonal angle combinations
   - Test with BSP geometry, not just skybox
   - Verify no double-transform artifacts

### Implementation Patterns Established

**WebGPU Visual Test Pattern:**
```typescript
import { initHeadlessWebGPU, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import { Camera } from '../../../src/render/camera.js';

// 1. Initialize headless WebGPU
const { device } = await initHeadlessWebGPU();

// 2. Create pipeline(s)
const pipeline = new SomeRenderer(device, format);

// 3. Setup camera
const camera = new Camera(width, height);
camera.setPosition(x, y, z);
camera.setRotation(pitch, yaw, roll);

// 4. Render using cameraState
pipeline.draw(passEncoder, {
  cameraState: camera.toState(), // ← Key: uses CameraState interface
  // ... other options
});

// 5. Capture and verify
const result = await captureTexture(device, texture, width, height);
await expectSnapshot(result, { name, width, height, snapshotDir });

// 6. Cleanup
pipeline.destroy();
device.destroy();
```

**WebGL Visual Test Pattern:**
```typescript
import { testWebGLRenderer } from '@quake2ts/test-utils';

await testWebGLRenderer(`
  // Code runs in browser context
  const camera = new Camera(256, 256);
  camera.setPosition(0, 0, 50);
  camera.setRotation(45, 45, 0);

  renderer.renderFrame({
    camera,
    cameraState: camera.toState(), // ← Key: uses CameraState interface
    sky: testSky,
    world: testWorld
  }, []);
`, {
  name: 'test-name',
  width: 256,
  height: 256,
  snapshotDir
});
```

### Baseline Generation

When ready to generate baselines:
```bash
# WebGPU baselines
UPDATE_VISUAL=1 pnpm test:webgpu tests/webgpu/visual/

# WebGL baselines
UPDATE_VISUAL=1 pnpm test:webgl tests/webgl/visual/

# Or use the specific GitHub Actions env var
ALWAYS_SAVE_SNAPSHOTS=1 pnpm test:webgpu
ALWAYS_SAVE_SNAPSHOTS=1 pnpm test:webgl
```

### Test Coverage Targets

- **Camera angles:** 13+ orientations per renderer (✅ Done for WebGPU)
- **Features:** 10+ feature combinations per renderer
- **Cross-renderer:** 5+ shared test scenes
- **Diagonal regression:** 6+ diagonal angles (complement existing test)
- **Integration:** 3+ complex multi-feature scenes

**Total:** 50+ visual regression baselines (currently ~35 exist, need ~20 more)

---

**Next:** [Section 22-11: Performance Validation](section-22-11.md)
