# Test Utilities Refactoring: Package Split

## Motivation
The current `@quake2ts/test-utils` package is a monolithic collection of testing helpers. It bundles heavy dependencies like `jsdom`, `webgpu` (via Dawn bindings), `playwright`, and `@napi-rs/canvas`. Even though these are marked as `peerDependencies` or `optional`, importing the package in a pure Node.js test environment can inadvertently trigger module resolution for these heavy libraries, leading to:
1.  **Bloated Installs:** Dependencies being pulled in where they aren't needed.
2.  **Runtime Overhead:** Unnecessary loading of large binary modules.
3.  **Fragility:** Node.js tests failing if browser-specific environment variables or binaries are missing.

## Proposed Structure
We will split `test-utils` into five focused packages.

### 1. `@quake2ts/test-utils` (Core)
*   **Focus:** Pure Node.js utilities, shared math/logic helpers, and mocks that don't require a browser environment.
*   **Key Contents:**
    *   `src/shared/mocks.ts` (BinaryWriter, etc.)
    *   `src/shared/math.ts`
    *   `src/shared/collision.ts`
    *   `src/game/*` (Factories, Helpers, Mocks that are logic-only)
    *   `src/server/*` (Network mocks)
*   **Dependencies:** Minimal. Internal workspace references (`@quake2ts/shared`).

### 2. `@quake2ts/test-utils-dom`
*   **Focus:** Utilities for simulated browser environments using JSDOM.
*   **Key Contents:**
    *   `src/setup/browser.ts`
    *   `src/setup/canvas.ts`
    *   `src/client/mocks/input.ts`
    *   `src/engine/mocks/assets.ts` (Image/Canvas mocks)
*   **Dependencies:** `jsdom`, `@napi-rs/canvas`, `fake-indexeddb`.

### 3. `@quake2ts/test-utils-webgl`
*   **Focus:** Utilities for WebGL testing (Headless or Mocked).
*   **Key Contents:**
    *   `src/setup/headless-webgl.ts`
    *   `src/engine/helpers/webgl-rendering.ts`
    *   `src/engine/mocks/webgl.ts`
*   **Dependencies:** `gl-matrix` (and potentially `gl` for headless contexts).

### 4. `@quake2ts/test-utils-webgpu`
*   **Focus:** Utilities for WebGPU testing using node bindings.
*   **Key Contents:**
    *   `src/setup/webgpu.ts`
    *   `src/setup/webgpu-lifecycle.ts`
    *   `src/engine/helpers/webgpu-rendering.ts`
    *   `src/engine/mocks/webgpu.ts`
*   **Dependencies:** `@webgpu/types`, `webgpu`.

### 5. `@quake2ts/test-utils-browser`
*   **Focus:** End-to-End (E2E) testing utilities using real browsers via Playwright.
*   **Key Contents:**
    *   `src/e2e/playwright.ts`
    *   `src/e2e/network.ts`
    *   `src/e2e/visual.ts`
    *   `src/engine/helpers/webgl-playwright.ts`
*   **Dependencies:** `playwright`, `pixelmatch`, `pngjs`.

## Migration Steps (Future Work)

1.  **Move Code:**
    *   Systematically move files from `packages/test-utils` to the new package directories (`packages/test-utils-dom`, etc.).
    *   Preserve the `test-utils` directory for the "Core" package.

2.  **Update Imports:**
    *   Update `src/index.ts` in each new package to export the moved modules.
    *   Clean up `packages/test-utils/src/index.ts` to only export core modules.

3.  **Update Consumers:**
    *   Search and replace imports in `packages/game`, `packages/engine`, etc.
    *   Example: Change `import { setupBrowser } from '@quake2ts/test-utils'` to `import { setupBrowser } from '@quake2ts/test-utils-dom'`.

4.  **Verify:**
    *   Run tests in isolation: `pnpm --filter @quake2ts/test-utils test`.
    *   Run full workspace tests to ensure no regressions.
