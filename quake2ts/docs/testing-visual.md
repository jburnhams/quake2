# Visual Regression Testing

## Overview

This project uses a visual regression testing framework based on:
- **Headless WebGPU**: Rendering scenes without a browser window.
- **PNG Snapshots**: Capturing the framebuffer to PNG files.
- **Pixelmatch**: Comparing the captured PNGs against baseline snapshots.

## Running Visual Tests

```bash
# Run visual tests
npm run test:visual

# Update baselines (after manual review)
npm run test:visual:update

# Watch mode for development
npm run test:visual:watch
```

## Reviewing Failures

When a visual test fails:

1. Check `tests/__snapshots__/actual/test-name.png` - what was rendered
2. Check `tests/__snapshots__/diff/test-name.png` - highlighted differences (red pixels)
3. If the change is expected (e.g., you changed rendering logic):
   - Run `npm run test:visual:update` to update the baseline.
4. If the change is unexpected (regression):
   - Fix the rendering code.
   - Re-run tests until they pass.

## Creating New Visual Tests

Visual tests are located in `packages/engine/tests/visual/`.

To create a new test:

```typescript
import { test } from '../helpers/visual-testing';

test('renders skybox correctly', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    async (device) => {
      // 1. Create resources (pipelines, buffers, etc.)
      const pipeline = device.createRenderPipeline({ ... });

      // 2. Return a render function that records commands
      return (pass) => {
        pass.setPipeline(pipeline);
        pass.draw(3);
      };
    },
    'skybox-basic'
  );
});
```

The `renderAndExpectSnapshot` helper:
1. Sets up a headless WebGPU environment (256x256).
2. Calls your setup function (allowing you to create resources).
3. Executes the returned render function within a render pass.
4. Captures the output texture.
5. Compares it against the snapshot named `'skybox-basic'`.

## Directory Structure

Snapshots are stored relative to the test file:

```
tests/visual/
├── basic-rendering.test.ts
└── __snapshots__/
    ├── baselines/       (Committed to git)
    │   └── clear-default.png
    ├── actual/          (Git ignored, generated on failure)
    └── diff/            (Git ignored, generated on failure)
```

## Infrastructure

- **`packages/test-utils/src/visual/snapshots.ts`**: Core logic for PNG capture, load, save, and comparison.
- **`packages/engine/tests/helpers/visual-testing.ts`**: Vitest fixtures and integration.
