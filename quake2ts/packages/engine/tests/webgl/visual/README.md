# WebGL Visual Tests

This directory contains visual regression tests for the WebGL renderer. These tests render frames headlessly using the production WebGL renderer and compare them against baseline images to ensure visual consistency.

## Overview

Unlike the WebGPU visual tests which require a GPU or software emulation (SwiftShader), the WebGL tests use `headless-gl` (the `gl` npm package) to provide a WebGL 1.0 context in Node.js. This allows them to run on most standard CI runners (like `ubuntu-latest`) without special configuration.

The goal is to verify that the WebGL renderer produces the correct visual output for:
- 2D HUD elements
- 3D world geometry (BSP)
- Models (MD2)
- Particles and effects
- Dynamic lighting

## Prerequisites

The tests run in Node.js (version 20+ recommended). The `gl` package is a native dependency that handles OpenGL calls.

### System Dependencies

**Linux (Ubuntu/Debian):**
Most CI environments have these, but locally you may need:
```bash
sudo apt-get install -y build-essential libxi-dev libglu1-mesa-dev libglew-dev pkg-config
```

**macOS / Windows:**
Typically works out of the box with standard build tools installed.

## Running Tests Locally

Run all WebGL visual tests:
```bash
pnpm test:webgl
```

Run in watch mode:
```bash
pnpm test:webgl:watch
```

**Updating Baselines:**
If you have made intentional changes to the rendering pipeline, you can update the baseline snapshots:
```bash
pnpm test:webgl:update
```
or
```bash
UPDATE_VISUAL=1 pnpm test:webgl
```

## Writing New Tests

Create new test files in `packages/engine/tests/webgl/visual/` ending in `.test.ts`.

Example pattern:
```typescript
import { describe, it, expect } from 'vitest';
import { createWebGLTestContext } from '../setup'; // Helper you will need to create

describe('MyFeature', () => {
  it('renders correctly', async () => {
    const { renderer, snapshot } = await createWebGLTestContext();

    // Setup scene
    // ...

    // Render frame
    renderer.render(scene, camera);

    // Compare snapshot
    await expect(snapshot('my-feature')).resolves.toBeMatchingBaseline();
  });
});
```

## Test Organization

- `__snapshots__/`: Contains the baseline PNG images.
- `__snapshots__/stats/`: Contains JSON results for report generation.
- `actual/`: (Generated during run) Contains the rendered output.
- `diff/`: (Generated on failure) Contains the visual difference.

## CI/CD

These tests run automatically on GitHub Actions via the `WebGL Visual Tests` workflow.
Results are aggregated and deployed to GitHub Pages alongside WebGPU results.

## Debugging Failed Tests

1. Check the `diff` directory in artifacts or local folder.
2. Red pixels indicate mismatch.
3. If the change is expected, run with `UPDATE_VISUAL=1`.
