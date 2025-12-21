# Section 19-6: Environment Setup & E2E Utilities

**Work Stream:** Test environment setup and E2E utilities
**Priority:** LOW - Infrastructure and integration testing
**Dependencies:** Section 19-2 (WebGL mocks), Section 19-4 (input mocks)
**Parallel Status:** Can start after core utilities are stable

---

## Overview

This section covers consolidation of test environment setup code, browser environment mocking, and E2E test utilities. These utilities support integration and end-to-end testing.

---

## Tasks

### 1. Consolidate Vitest Setup Files (MEDIUM PRIORITY)

**Status:** Duplicate setup in client and engine packages
**Dependencies:** Section 19-2 Task 1 (WebGL mocks)

- [x] **1.1** Create `test-utils/src/setup/browser.ts` file

- [x] **1.2** Extract common setup from `client/vitest.setup.ts`
  - JSDOM configuration with napi-rs/canvas
  - fake-indexeddb setup
  - localStorage mock
  - Canvas createElement override
  - Image/ImageData globals
  - btoa/atob polyfills

- [x] **1.3** Extract common setup from `engine/vitest.setup.ts`
  - Similar to client setup
  - Focus on WebGL/canvas testing

- [x] **1.4** Create `setupBrowserEnvironment()` function
  - Signature: `setupBrowserEnvironment(options?: BrowserSetupOptions): void`
  - Options: `enableWebGL`, `enableCanvas`, `enableIndexedDB`, `enableLocalStorage`
  - Consolidates all browser API mocking

- [x] **1.5** Create `teardownBrowserEnvironment()` function
  - Signature: `teardownBrowserEnvironment(): void`
  - Cleanup function for afterAll hooks

- [x] **1.6** Update `client/vitest.setup.ts` to use consolidated setup
  - Import and call `setupBrowserEnvironment()` from test-utils
  - Remove duplicate code

- [x] **1.7** Update `engine/vitest.setup.ts` to use consolidated setup
  - Same pattern as client

- [x] **1.8** Create `test-utils/src/setup/node.ts` for Node-specific setup
  - Signature: `setupNodeEnvironment(options?: NodeSetupOptions): void`
  - For packages that don't need browser mocks

---

### 2. Migrate Browser Environment Utilities (MEDIUM PRIORITY)

**Status:** Exists in tests package, needs consolidation
**Dependencies:** Task 1

- [x] **2.1** Audit `tests/src/setup.ts` for reusable utilities
  - `setupBrowserEnvironment()` function (~100 lines)
  - Mock WebGL2 context setup
  - Pointer Lock API mock
  - requestAnimationFrame/cancelAnimationFrame mocks
  - Canvas API interception

- [x] **2.2** Migrate unique utilities from `tests/src/setup.ts` to `test-utils/src/setup/browser.ts`
  - Avoid duplicating Task 1 work
  - Focus on integration-specific setup

- [x] **2.3** Update `tests/src/setup.ts` to re-export from test-utils
  - Maintain backward compatibility
  - Import from `@quake2ts/test-utils`

- [x] **2.4** Update imports in `tests/src/` test files
  - Verify no breaking changes
  - Estimated files: ~5

---

### 3. Create Canvas/WebGL Test Helpers (MEDIUM PRIORITY)

**Status:** Not started
**Dependencies:** Section 19-2 Task 1 (WebGL mocks)

- [x] **3.1** Create `test-utils/src/setup/canvas.ts` file

- [x] **3.2** Add `createMockCanvas()` factory
  - Signature: `createMockCanvas(width?: number, height?: number): HTMLCanvasElement`
  - Return mock canvas with WebGL context support

- [x] **3.3** Add `createMockCanvasContext2D()` factory
  - Signature: `createMockCanvasContext2D(canvas?: HTMLCanvasElement): CanvasRenderingContext2D`
  - Mock 2D rendering context

- [x] **3.4** Add `captureCanvasDrawCalls()` helper
  - Signature: `captureCanvasDrawCalls(context: CanvasRenderingContext2D): DrawCall[]`
  - Spy on draw operations for verification

- [x] **3.5** Add `createMockImageData()` factory
  - Signature: `createMockImageData(width: number, height: number, fillColor?: [number, number, number, number]): ImageData`

- [x] **3.6** Add `createMockImage()` factory
  - Signature: `createMockImage(width?: number, height?: number, src?: string): HTMLImageElement`

---

### 4. Create RAF/Timer Test Utilities (LOW PRIORITY)

**Status:** Inline implementations exist
**Dependencies:** None

- [x] **4.1** Create `test-utils/src/setup/timing.ts` file

- [x] **4.2** Add `createMockRAF()` factory
  - Signature: `createMockRAF(): MockRAF`
  - Mock requestAnimationFrame/cancelAnimationFrame
  - Methods: `tick()`, `advance()`, `getCallbacks()`

- [x] **4.3** Add `createMockPerformance()` factory
  - Signature: `createMockPerformance(startTime?: number): Performance`
  - Mock performance.now() and performance.timing

- [x] **4.4** Add `createControlledTimer()` helper
  - Signature: `createControlledTimer(): ControlledTimer`
  - Control setTimeout/setInterval for deterministic testing
  - Methods: `tick()`, `advanceBy()`, `clear()`

- [x] **4.5** Add `simulateFrames()` helper
  - Signature: `simulateFrames(count: number, frameTime?: number, callback?: () => void): void`
  - Simulate multiple RAF frames

---

### 5. Migrate E2E Test Helpers (LOW PRIORITY)

**Status:** Specialized E2E helpers exist
**Dependencies:** None

- [x] **5.1** Audit `e2e-tests/helpers/testClient.ts` for reusable utilities
  - `launchBrowserClient()` - Playwright browser setup
  - `closeBrowser()` - Cleanup
  - `TestClient` interface
  - **Note:** `e2e-tests` directory was not found in the expected location. The functionality is now provided by `test-utils`'s Playwright helpers.

- [x] **5.2** Create `test-utils/src/e2e/playwright.ts` file

- [x] **5.3** Add `createPlaywrightTestClient()` factory
  - Signature: `createPlaywrightTestClient(options?: PlaywrightOptions): Promise<PlaywrightTestClient>`
  - Wraps browser launch and client setup
  - Methods: `navigate()`, `waitForGame()`, `injectInput()`, `screenshot()`, `close()`

- [x] **5.4** Add `waitForGameReady()` helper
  - Signature: `waitForGameReady(page: Page, timeout?: number): Promise<void>`
  - Wait for game initialization

- [x] **5.5** Add `captureGameState()` helper
  - Signature: `captureGameState(page: Page): Promise<GameStateCapture>`
  - Capture current game state from browser

- [ ] **5.6** Update `e2e-tests/helpers/testClient.ts` to use test-utils
  - Re-export from test-utils for backward compatibility
  - Estimated files: ~8
  - **Note:** Deferred. The existing implementation has specific static serving and logging logic that requires careful porting to avoid regressions. The new helper is available for new tests.

---

### 6. Create Storage Mock Utilities (LOW PRIORITY)

**Status:** Basic mocks exist in setup
**Dependencies:** None

- [x] **6.1** Create `test-utils/src/setup/storage.ts` file

- [x] **6.2** Add `createMockLocalStorage()` factory
  - Signature: `createMockLocalStorage(initialData?: Record<string, string>): Storage`
  - Full Storage API implementation

- [x] **6.3** Add `createMockSessionStorage()` factory
  - Signature: `createMockSessionStorage(initialData?: Record<string, string>): Storage`

- [x] **6.4** Add `createMockIndexedDB()` factory
  - Signature: `createMockIndexedDB(databases?: IDBDatabase[]): IDBFactory`
  - Wrap fake-indexeddb with factory pattern

- [x] **6.5** Add `createStorageTestScenario()` helper
  - Signature: `createStorageTestScenario(storageType: 'local' | 'session' | 'indexed'): StorageScenario`
  - Pre-configured storage for testing

---

### 7. Create Audio Context Test Utilities (LOW PRIORITY)

**Status:** Some audio mocks in Section 19-2
**Dependencies:** Section 19-2 Task 2 (audio mocks)

- [x] **7.1** Create `test-utils/src/setup/audio.ts` file

- [x] **7.2** Add `setupMockAudioContext()` helper
  - Signature: `setupMockAudioContext(): void`
  - Replace global AudioContext with mock

- [x] **7.3** Add `teardownMockAudioContext()` helper
  - Signature: `teardownMockAudioContext(): void`
  - Restore original AudioContext

- [x] **7.4** Add `captureAudioEvents()` helper
  - Signature: `captureAudioEvents(context: AudioContext): AudioEvent[]`
  - Track audio operations for verification

---

### 8. Create Network Condition Simulators (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Section 19-1 Task 2 (network mocks)

- [x] **8.1** Create `test-utils/src/e2e/network.ts` file

- [x] **8.2** Add `simulateNetworkCondition()` helper
  - Signature: `simulateNetworkCondition(condition: 'good' | 'slow' | 'unstable' | 'offline'): NetworkSimulator`
  - Presets for common network conditions

- [x] **8.3** Add `createCustomNetworkCondition()` helper
  - Signature: `createCustomNetworkCondition(latency: number, jitter: number, packetLoss: number): NetworkSimulator`

- [x] **8.4** Add `throttleBandwidth()` helper
  - Signature: `throttleBandwidth(bytesPerSecond: number): void`
  - For Playwright network throttling

---

### 9. Create Screenshot/Visual Testing Utilities (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Task 5 (E2E helpers)

- [x] **9.1** Create `test-utils/src/e2e/visual.ts` file

- [x] **9.2** Add `captureGameScreenshot()` helper
  - Signature: `captureGameScreenshot(page: Page, name: string): Promise<Buffer>`
  - Capture and save game screenshot

- [x] **9.3** Add `compareScreenshots()` helper
  - Signature: `compareScreenshots(baseline: Buffer, current: Buffer, threshold?: number): VisualDiff`
  - Pixel-by-pixel comparison

- [x] **9.4** Add `createVisualTestScenario()` helper
  - Signature: `createVisualTestScenario(sceneName: string): VisualScenario`
  - Setup for visual regression testing

---

### 10. Documentation and Exports (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Tasks 1-9

- [x] **10.1** Add JSDoc comments to all setup/E2E utilities
  - Include usage examples for browser setup, E2E testing

- [x] **10.2** Update `test-utils/README.md` with setup/E2E utilities section
  - Document: browser setup, canvas mocks, RAF helpers, E2E utilities

- [x] **10.3** Create migration guide for vitest.setup.ts files
  - Document how to migrate existing setup files

- [x] **10.4** Verify all setup/E2E utilities exported from `test-utils/src/index.ts`
  - Organized by category: `setup/*`, `e2e/*`

- [x] **10.5** Add TypeScript type exports
  - Export all setup options and E2E interfaces

- [x] **10.6** Create example test files demonstrating setup usage
  - Example unit test with browser setup
  - Example E2E test with Playwright
  - Example integration test with full environment

---

## Summary

**Total Tasks:** 10
**Total Subtasks:** 56
**Estimated Impact:** ~30+ test files updated, ~400 lines of new utilities
**Critical Path:** Task 1 (vitest setup consolidation) should complete first
**Parallel Opportunities:** Tasks 3-9 can mostly run in parallel after Task 1; Task 2 depends on Task 1
**Note:** This section has lower priority - complete after core utilities are stable
