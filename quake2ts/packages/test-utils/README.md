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

### Network Simulation

Simulate network conditions in E2E tests:

```typescript
import { simulateNetworkCondition, throttleBandwidth } from '@quake2ts/test-utils';

// Simulate a slow connection
await simulateNetworkCondition('slow').apply(page);

// Throttle bandwidth specifically
await throttleBandwidth(page, 100 * 1024); // 100 KB/s
```

### Visual Regression

Capture and compare screenshots:

```typescript
import { createVisualTestScenario } from '@quake2ts/test-utils';

const visual = createVisualTestScenario(page, 'map-start');

// Capture screenshot
const snapshot = await visual.capture('initial-view');

// Compare against baseline
const result = await visual.compare('initial-view', './test/screenshots/baselines');
if (!result.matched) {
    console.warn('Visual regression detected');
}
```

### Audio Testing

Mock and capture audio events:

```typescript
import { setupMockAudioContext, captureAudioEvents } from '@quake2ts/test-utils';

setupMockAudioContext();
const context = new AudioContext();

// Run code that uses audio...

const events = captureAudioEvents(context);
// Verify calls like createOscillator, start, etc.
```

### Storage Testing

Helper for storage scenarios (Local, Session, IndexedDB):

```typescript
import { createStorageTestScenario } from '@quake2ts/test-utils';

const scenario = createStorageTestScenario('indexed');
await scenario.populate({ 'save_1': JSON.stringify(saveData) });
const exists = await scenario.verify('save_1', JSON.stringify(saveData));
```

## Features

- **Browser Mocks:** JSDOM enhancement, Pointer Lock, RAF, Performance.
- **Canvas/WebGL:** Mock implementations for headless testing.
- **Storage:** LocalStorage, SessionStorage, IndexedDB mocks.
- **Audio:** Basic Web Audio API mock with event capturing.
- **E2E:** Playwright wrappers, network simulation, visual regression helpers.
- **Game Factories:** Helpers for creating entities, items, and game state.
