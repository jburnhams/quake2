# WebGL Visual Tests

This directory contains visual regression tests for the WebGL renderer. These tests render frames headlessly using **Playwright** (running Chromium in headless mode) and compare them against baseline images to ensure visual consistency.

## Methodology

The tests utilize the `testWebGLRenderer` helper from `@quake2ts/test-utils`. This helper:
1.  Spinning up a local static server to serve the engine assets and build artifacts.
2.  Launching a headless Chromium instance via Playwright.
3.  Injecting the test code into the browser context.
4.  Executing the rendering commands using the actual `Quake2Engine` build.
5.  Capturing the canvas output and comparing it with baseline snapshots.

## Prerequisites

The tests require Playwright browsers to be installed:

```bash
pnpm exec playwright install chromium --with-deps
```

(Note: This is automatically handled in CI, but may be needed locally).

## Writing New Tests

Create new test files in `packages/engine/tests/webgl/visual/` (or subdirectories like `2d/`) ending in `.test.ts`.

### Basic Pattern

```typescript
import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup snapshot directory path relative to this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('my feature: renders correctly', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    // 1. Setup scene or clear background
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 2. Use the renderer API (available as 'renderer' in this scope)
    renderer.begin2D();
    renderer.drawfillRect(50, 50, 100, 100, [0, 1, 0, 1]); // Green box
    renderer.end2D();
  `, {
    name: 'my-feature-snapshot',
    description: 'Description of what is being tested',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
```

### Key Parameters
- **code**: The first argument to `testWebGLRenderer`. A string containing the JavaScript/TypeScript code to execute **inside the browser context**.
- **name**: The name of the snapshot file (e.g., `my-feature-snapshot.png`).
- **width/height**: Dimensions of the framebuffer.
- **snapshotDir**: Absolute path to where snapshots should be stored/compared.

## Running Tests

Run all WebGL visual tests:
```bash
pnpm test:webgl
```

**Updating Baselines:**
If intentional changes cause failures, update the baselines:
```bash
pnpm test:webgl:update
```
or
```bash
UPDATE_VISUAL=1 pnpm test:webgl
```

## Debugging

Since tests run in a headless browser, `console.log` inside the test string will be forwarded to the Node.js console with a `[Browser]` prefix.

Errors in the browser context will be reported as test failures.
