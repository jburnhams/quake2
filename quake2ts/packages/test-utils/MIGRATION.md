# Migration Guide: Moving to @quake2ts/test-utils

This guide explains how to migrate existing test setups in the `quake2ts` workspace to use the consolidated `@quake2ts/test-utils` package.

## 1. Browser Environment Setup

If your package's `vitest.setup.ts` manually mocks browser APIs (JSDOM, Canvas, LocalStorage, etc.), replace those implementations with `setupBrowserEnvironment`.

### Before

```typescript
// packages/my-package/vitest.setup.ts
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Manual mocks...
const canvas = require('canvas');
global.HTMLCanvasElement = ...
global.window = ...
```

### After

```typescript
// packages/my-package/vitest.setup.ts
import { setupBrowserEnvironment } from '@quake2ts/test-utils';

setupBrowserEnvironment({
  enableWebGL2: true,   // If you need WebGL contexts
  enableCanvas: true,  // If you need Canvas 2D
  enableIndexedDB: true,
  enableLocalStorage: true,
});
```

## 2. Node Environment Setup

For packages that run strictly in Node.js but need some shared polyfills or setup:

```typescript
// packages/server/vitest.setup.ts
import { setupNodeEnvironment } from '@quake2ts/test-utils';

setupNodeEnvironment();
```

## 3. WebGL Mocks

Replace manual WebGL mocking with the shared factory.

### Before

```typescript
const gl = {
  createShader: vi.fn(),
  // ... endless mocks
};
```

### After

```typescript
import { createMockWebGL2Context } from '@quake2ts/test-utils';

const gl = createMockWebGL2Context();
```

## 4. E2E Tests (Playwright)

Use `PlaywrightTestClient` for consistent browser handling.

```typescript
import { createPlaywrightTestClient } from '@quake2ts/test-utils';

const client = await createPlaywrightTestClient({
  browserType: 'chromium',
  headless: true
});

await client.navigate('http://localhost:3000');
await client.waitForGame();
```
