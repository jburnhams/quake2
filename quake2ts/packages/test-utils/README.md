# @quake2ts/test-utils

Shared test utilities, mocks, and setup helpers for Quake 2 TypeScript.

## Usage

### Browser Environment Setup

In your `vitest.setup.ts`:

```typescript
import { setupBrowserEnvironment } from '@quake2ts/test-utils';

setupBrowserEnvironment({
  url: 'http://localhost',
  enableWebGL2: true,
  enablePointerLock: true
});
```

### WebGL/Canvas Mocks

```typescript
import { createMockCanvas, createMockWebGL2Context } from '@quake2ts/test-utils';

const canvas = createMockCanvas(800, 600);
const gl = createMockWebGL2Context(canvas);
```

### Playwright E2E Helpers

```typescript
import { createPlaywrightTestClient } from '@quake2ts/test-utils';

const client = await createPlaywrightTestClient();
await client.navigate('http://localhost:3000');
await client.waitForGame();
```

### Visual Regression

```typescript
import { createVisualTestScenario } from '@quake2ts/test-utils';

const visual = createVisualTestScenario(page, 'map-start');
const snapshot = await visual.capture('initial-view');
```

## Features

- **Browser Mocks:** JSDOM enhancement, Pointer Lock, RAF, Performance.
- **Canvas/WebGL:** Mock implementations for headless testing.
- **Storage:** LocalStorage, SessionStorage, IndexedDB mocks.
- **Audio:** Basic Web Audio API mock.
- **E2E:** Playwright wrappers, network simulation, visual regression helpers.
- **Game Factories:** Helpers for creating entities, items, and game state.
