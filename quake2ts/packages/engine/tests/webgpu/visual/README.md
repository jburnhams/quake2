# WebGPU Visual Tests

Visual regression tests for WebGPU renderer functionality. These tests render to headless textures and compare against baseline PNGs.

## Prerequisites

**Required for headless rendering:**
```bash
# Ubuntu/Debian
sudo apt-get install -y --no-install-recommends mesa-vulkan-drivers
```

This provides lavapipe, a CPU-based Vulkan implementation. See `CLAUDE.md` in project root for detailed setup.

## Writing Visual Tests

### Pattern: Full WebGPURenderer Tests

Test the complete renderer API (recommended for integration testing):

```typescript
import { test, beforeAll } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer';
import { Camera } from '../../../src/render/camera';
import { mat4 } from 'gl-matrix';
import { captureTexture, initHeadlessWebGPU, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

const snapshotDir = path.join(__dirname, '__snapshots__');
const updateBaseline = process.env.UPDATE_VISUAL === '1';

beforeAll(async () => {
  await initHeadlessWebGPU();
});

test('feature: description', async () => {
  const renderer = await createWebGPURenderer(undefined, {
    width: 256,
    height: 256,
    headless: true
  });

  const camera = new Camera(mat4.create());
  const frameRenderer = (renderer as any).frameRenderer;

  renderer.renderFrame({
    camera,
    clearColor: [0, 0, 0, 1],
    onDraw2D: () => {
      renderer.begin2D();
      // Your drawing calls here
      renderer.drawfillRect(64, 64, 128, 128, [1, 0, 0, 1]);
      renderer.end2D();
    }
  });

  const pixels = await captureTexture(
    renderer.device,
    frameRenderer.headlessTarget,
    256,
    256
  );

  await expectSnapshot(pixels, {
    name: 'feature-description',
    width: 256,
    height: 256,
    updateBaseline,
    snapshotDir
  });

  renderer.dispose();
});
```

### Pattern: Low-Level Pipeline Tests

Test individual rendering pipelines (for unit testing):

```typescript
import { test } from '../../helpers/visual-testing';
import { SpriteRenderer } from '../../../src/render/webgpu/pipelines/sprite';

test('pipeline: feature', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    async (device, format, encoder, view) => {
      const renderer = new SpriteRenderer(device, format);
      renderer.setProjection(256, 256);

      renderer.begin(encoder, view);
      renderer.drawSolidRect(64, 64, 128, 128, [1, 0, 0, 1]);
      renderer.end();
    },
    'pipeline-feature'
  );
});
```

## Baseline Management

### Creating/Updating Baselines

```bash
# Generate new baseline PNGs
UPDATE_VISUAL=1 pnpm test:webgpu tests/webgpu/visual/

# Update specific test
UPDATE_VISUAL=1 pnpm test:webgpu tests/webgpu/visual/2d-renderer.test.ts
```

### Running Tests

```bash
# Run all visual tests (compares against baselines)
pnpm test:webgpu tests/webgpu/visual/

# Run specific test file
pnpm test:webgpu tests/webgpu/visual/2d-renderer.test.ts
```

## Test Organization

- **2d-renderer.test.ts** - Full WebGPURenderer 2D API (drawPic, drawfillRect, etc.)
- **visual-sprite.test.ts** - SpriteRenderer pipeline tests
- **basic-rendering.test.ts** - Fundamental rendering primitives

## Snapshot Directory Structure

```
__snapshots__/
├── baselines/         # Reference images (checked into git)
├── actual/            # Failed test outputs (gitignored)
├── diff/              # Visual diffs (gitignored)
└── stats/             # Comparison statistics (gitignored)
```

## Best Practices

1. **Use full renderer tests for API validation** - Tests how users interact with the renderer
2. **Use pipeline tests for implementation details** - Tests low-level rendering logic
3. **256x256 is standard test size** - Balances detail vs. performance
4. **Descriptive test names** - Use format `component: what-it-tests`
5. **Test one feature per snapshot** - Makes failures easier to diagnose
6. **Include visual variety** - Colors, shapes, blending modes
7. **Always dispose resources** - Call `renderer.dispose()` at end of test

## Debugging Failed Tests

When a test fails:

1. Check `__snapshots__/diff/[test-name].png` for visual diff
2. Review `__snapshots__/actual/[test-name].png` for what was rendered
3. Compare with `__snapshots__/baselines/[test-name].png` for expected output
4. Check `__snapshots__/stats/[test-name].json` for pixel difference metrics

Acceptable difference threshold: 0.1% (configurable in expectSnapshot options)
