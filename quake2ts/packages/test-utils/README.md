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
const simulator = simulateNetworkCondition('slow');
// Apply logic to packets/requests
```

### Visual Regression

Capture and compare screenshots:

```typescript
import { captureGameScreenshot, compareScreenshots } from '@quake2ts/test-utils';

// Capture screenshot
const buffer = await captureGameScreenshot(page, 'map-start');

// Compare against baseline
const result = compareScreenshots(baselineBuffer, buffer);
if (!result.passed) {
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

const scenario = createStorageTestScenario('local');
scenario.localStorage.setItem('foo', 'bar');
```

## Features

- **Browser Mocks:** JSDOM enhancement, Pointer Lock, RAF, Performance.
- **Canvas/WebGL:** Mock implementations for headless testing (napi-rs/canvas backed).
- **Storage:** LocalStorage, SessionStorage, IndexedDB mocks.
- **Audio:** Basic Web Audio API mock with event capturing.
- **E2E:** Playwright wrappers, network simulation, visual regression helpers.
- **Game Factories:** Helpers for creating entities, items, and game state.

## Migration Guide

When migrating existing tests:
1. Replace `setupBrowserEnvironment` imports from local helpers to `@quake2ts/test-utils`.
2. Use `createMockCanvas` instead of `createCanvas` for better DOM compatibility.
3. Use `setupMockAudioContext` instead of custom inline mocks.
