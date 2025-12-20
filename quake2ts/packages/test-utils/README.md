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

### Server Testing Utilities

The library includes comprehensive mocks and helpers for testing server logic without needing a full network stack.

#### Network Transport Mocks
```typescript
import { createMockTransport, createMockUDPSocket } from '@quake2ts/test-utils';

// Mock transport for direct message injection/capture
const transport = createMockTransport();
transport.send(new Uint8Array([0x01]));
const msg = transport.receive();

// Mock UDP socket
const socket = createMockUDPSocket();
```

#### Server State & Simulation
```typescript
import {
  createMockServer,
  createMockServerState,
  simulateServerTick
} from '@quake2ts/test-utils';

// Create a mock server instance
const server = createMockServer();

// Initialize state
server.state = createMockServerState();

// Simulate a game loop tick
simulateServerTick(server, 0.1);
```

#### Multiplayer Helpers
```typescript
import {
  createMultiplayerTestScenario,
  simulatePlayerJoin,
  simulatePlayerInput
} from '@quake2ts/test-utils';

// Setup a scenario with connected players
const scenario = createMultiplayerTestScenario(4);

// Simulate a new player joining
const newClient = await simulatePlayerJoin(scenario.server, { name: 'Player 5' });

// Simulate input
simulatePlayerInput(newClient, {
  angles: { x: 0, y: 90, z: 0 },
  forwardmove: 200
});
```

#### Snapshot Utilities
```typescript
import { createServerSnapshot, measureSnapshotSize } from '@quake2ts/test-utils';

const snapshot = createServerSnapshot(server.state, 0);
console.log('Snapshot size:', measureSnapshotSize(snapshot));
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
await simulateNetworkCondition('slow').applyCondition(page);

// Throttle bandwidth specifically
const throttle = throttleBandwidth(100 * 1024); // 100 KB/s
await throttle.applyCondition(page);
```

### Visual Regression

Capture and compare screenshots:

```typescript
import { captureGameScreenshot, compareScreenshots } from '@quake2ts/test-utils';

// Capture screenshot
const buffer = await captureGameScreenshot(page, 'initial-view');

// Compare against baseline (buffer)
const result = await compareScreenshots(baselineBuffer, buffer);
if (!result.match) {
    console.warn('Visual regression detected');
}
```

### Audio Testing

Mock and capture audio events:

```typescript
import { setupMockAudioContext, captureAudioEvents } from '@quake2ts/test-utils';

setupMockAudioContext();
// @ts-ignore
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
scenario.localStorage.setItem('key', 'value');
```

## Features

- **Browser Mocks:** JSDOM enhancement, Pointer Lock, RAF, Performance.
- **Server Utilities:** Network mocks, Server state factories, Multiplayer simulation, Snapshot analysis.
- **Canvas/WebGL:** Mock implementations for headless testing.
- **Storage:** LocalStorage, SessionStorage, IndexedDB mocks.
- **Audio:** Basic Web Audio API mock with event capturing.
- **E2E:** Playwright wrappers, network simulation, visual regression helpers.
- **Game Factories:** Helpers for creating entities, items, and game state.
