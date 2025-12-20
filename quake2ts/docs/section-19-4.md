# Section 19-4: Client Utilities Migration

**Work Stream:** Client-side test utilities
**Priority:** MEDIUM - Client testing functionality
**Dependencies:** Section 19-2 (renderer mocks), Section 19-1 (math helpers)
**Parallel Status:** Can start in parallel with Section 19-3

---

## Overview

This section covers migration of client-specific test utilities including input system mocks, view/camera utilities, HUD testing helpers, and client state management mocks.

---

## Tasks

### 1. Migrate Input System Mocks (HIGH PRIORITY)

**Status:** Completed
**Dependencies:** None

- [x] **1.1** Create `test-utils/src/client/mocks/input.ts` file

- [x] **1.2** Migrate `MockPointerLock` class from `tests/src/mocks/input.ts`
  - Class implementing PointerLock API
  - Methods: `request()`, `exit()`, `isLocked()`
  - Properties: `element`, `locked`

- [x] **1.3** Migrate `InputInjector` class from `tests/src/mocks/input.ts`
  - Class for simulating input events (~110 lines)
  - Methods: `keyDown()`, `keyUp()`, `mouseMove()`, `mouseButton()`, `mouseWheel()`
  - Support for keyboard, mouse, and wheel events

- [x] **1.4** Add factory functions for input mocks
  - `createMockPointerLock(element?: HTMLElement): MockPointerLock`
  - `createInputInjector(target?: EventTarget): InputInjector`

- [x] **1.5** Add `createMockKeyboardEvent()` factory
  - Signature: `createMockKeyboardEvent(key: string, type?: 'keydown' | 'keyup', modifiers?: KeyModifiers): KeyboardEvent`

- [x] **1.6** Add `createMockMouseEvent()` factory
  - Signature: `createMockMouseEvent(type: string, options?: MouseEventInit): MouseEvent`

- [x] **1.7** Add `createMockWheelEvent()` factory
  - Signature: `createMockWheelEvent(deltaX?: number, deltaY?: number): WheelEvent`

- [x] **1.8** Update imports in `tests/src/` directory
  - Replace `import { MockPointerLock, InputInjector } from './mocks/input'`
  - With `import { createMockPointerLock, createInputInjector } from '@quake2ts/test-utils'`
  - Estimated files: ~5

- [x] **1.9** Update imports in `client/tests/input/` directory
  - Same pattern for any input tests
  - Estimated files: ~8

- [x] **1.10** Delete `tests/src/mocks/input.ts` after migration

---

### 2. Create View/Camera Test Utilities (HIGH PRIORITY)

**Status:** In Progress
**Dependencies:** Section 19-1 Task 3 (math helpers)

- [x] **2.1** Create `test-utils/src/client/helpers/view.ts` file

- [x] **2.2** Add `createMockCamera()` factory
  - Signature: `createMockCamera(overrides?: Partial<Camera>): Camera`
  - Include: position, rotation, fov, near, far planes

- [x] **2.3** Add `createMockViewState()` factory
  - Signature: `createMockViewState(overrides?: Partial<ViewState>): ViewState`
  - Include: camera, viewport, refdef

- [x] **2.4** Add `createMockRefDef()` factory
  - Signature: `createMockRefDef(overrides?: Partial<RefDef>): RefDef`
  - Include: vieworg, viewangles, fov_x, fov_y, time

- [x] **2.5** Add `createViewTestScenario()` helper
  - Signature: `createViewTestScenario(scenarioType: 'firstPerson' | 'thirdPerson' | 'spectator'): ViewScenario`
  - Return pre-configured camera and view state

- [x] **2.6** Add `simulateCameraMovement()` helper
  - Signature: `simulateCameraMovement(camera: Camera, input: CameraInput, deltaTime: number): Camera`
  - Simulate camera movement based on input

- [ ] **2.7** Cleanup view tests in `client/tests/view/` directory
  - Replace inline camera/view mocks
  - Estimated files: ~12

---

### 3. Create HUD/UI Test Utilities (MEDIUM PRIORITY)

**Status:** Not started
**Dependencies:** None

- [ ] **3.1** Create `test-utils/src/client/helpers/hud.ts` file

- [ ] **3.2** Add `createMockHudState()` factory
  - Signature: `createMockHudState(overrides?: Partial<HudState>): HudState`
  - Include: health, armor, ammo, weapons, items

- [ ] **3.3** Add `createMockScoreboard()` factory
  - Signature: `createMockScoreboard(players?: PlayerInfo[]): Scoreboard`
  - Include player list, scores, pings

- [ ] **3.4** Add `createMockChatMessage()` factory
  - Signature: `createMockChatMessage(text: string, sender?: string, timestamp?: number): ChatMessage`

- [ ] **3.5** Add `createMockNotification()` factory
  - Signature: `createMockNotification(type: string, message: string, duration?: number): Notification`

- [ ] **3.6** Cleanup HUD tests in `client/tests/hud/` directory
  - Replace inline HUD mocks
  - Estimated files: ~8

---

### 4. Create Client State Management Mocks (MEDIUM PRIORITY)

**Status:** Not started
**Dependencies:** Section 19-3 Task 1 (entity factories)

- [ ] **4.1** Create `test-utils/src/client/mocks/state.ts` file

- [ ] **4.2** Add `createMockClientState()` factory
  - Signature: `createMockClientState(overrides?: Partial<ClientState>): ClientState`
  - Include: playerNum, serverTime, parseEntities, frame

- [ ] **4.3** Add `createMockFrame()` factory
  - Signature: `createMockFrame(overrides?: Partial<Frame>): Frame`
  - Include: serverFrame, deltaFrame, valid, entities

- [ ] **4.4** Add `createMockClientInfo()` factory
  - Signature: `createMockClientInfo(overrides?: Partial<ClientInfo>): ClientInfo`
  - Include: name, skin, model, icon

- [ ] **4.5** Add `createMockConnectionState()` factory
  - Signature: `createMockConnectionState(state?: ConnectionState): MockConnectionState`
  - States: disconnected, connecting, connected, active

- [ ] **4.6** Cleanup client state tests in `client/tests/state/` directory
  - Replace inline state mocks
  - Estimated files: ~10

---

### 5. Create Prediction/Interpolation Helpers (MEDIUM PRIORITY)

**Status:** Not started
**Dependencies:** Section 19-1 Task 3 (math helpers), Section 19-3 Task 1 (entity factories)

- [ ] **5.1** Create `test-utils/src/client/helpers/prediction.ts` file

- [ ] **5.2** Add `createPredictionTestScenario()` helper
  - Signature: `createPredictionTestScenario(lagMs?: number): PredictionScenario`
  - Include: client state, server snapshots, lag simulation

- [ ] **5.3** Add `simulateClientPrediction()` helper
  - Signature: `simulateClientPrediction(state: ClientState, input: Input, deltaTime: number): ClientState`

- [ ] **5.4** Add `createInterpolationTestData()` helper
  - Signature: `createInterpolationTestData(startState: EntityState, endState: EntityState, steps?: number): EntityState[]`
  - Generate intermediate states for interpolation testing

- [ ] **5.5** Add `verifySmoothing()` helper
  - Signature: `verifySmoothing(states: EntityState[]): SmoothingAnalysis`
  - Analyze state transitions for smoothness

- [ ] **5.6** Cleanup prediction tests in `client/tests/prediction/` directory
  - Replace inline prediction setup
  - Estimated files: ~6

---

### 6. Create Client Network Mocks (MEDIUM PRIORITY)

**Status:** Not started
**Dependencies:** Section 19-1 Task 2 (network mocks)

- [ ] **6.1** Create `test-utils/src/client/mocks/network.ts` file

- [ ] **6.2** Add `createMockServerMessage()` factory
  - Signature: `createMockServerMessage(type: number, data?: Uint8Array): ServerMessage`

- [ ] **6.3** Add `createMockSnapshot()` factory
  - Signature: `createMockSnapshot(frameNum: number, entities?: EntityState[]): Snapshot`

- [ ] **6.4** Add `createMockDeltaFrame()` factory
  - Signature: `createMockDeltaFrame(from: number, to: number, changes?: EntityDelta[]): DeltaFrame`

- [ ] **6.5** Add `simulateNetworkDelay()` helper
  - Signature: `simulateNetworkDelay(messages: Message[], delayMs: number): Promise<Message[]>`

- [ ] **6.6** Add `simulatePacketLoss()` helper
  - Signature: `simulatePacketLoss(messages: Message[], lossPercent: number): Message[]`

- [ ] **6.7** Cleanup network tests in `client/tests/network/` directory
  - Replace inline network mocks
  - Estimated files: ~8

---

### 7. Create Download/Precache Mocks (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Section 19-2 Task 4 (asset mocks)

- [ ] **7.1** Create `test-utils/src/client/mocks/download.ts` file

- [ ] **7.2** Add `createMockDownloadManager()` factory
  - Signature: `createMockDownloadManager(overrides?: Partial<DownloadManager>): DownloadManager`
  - Methods: `download()`, `cancel()`, `getProgress()`

- [ ] **7.3** Add `createMockPrecacheList()` factory
  - Signature: `createMockPrecacheList(models?: string[], sounds?: string[], images?: string[]): PrecacheList`

- [ ] **7.4** Add `simulateDownload()` helper
  - Signature: `simulateDownload(url: string, progressCallback?: (percent: number) => void): Promise<ArrayBuffer>`

- [ ] **7.5** Cleanup download tests in `client/tests/download/` directory
  - Estimated files: ~4

---

### 8. Create Console/Command Mocks (LOW PRIORITY)

**Status:** Not started
**Dependencies:** None

- [ ] **8.1** Create `test-utils/src/client/mocks/console.ts` file

- [ ] **8.2** Add `createMockConsole()` factory
  - Signature: `createMockConsole(overrides?: Partial<Console>): MockConsole`
  - Methods: `print()`, `exec()`, `addCommand()`, `getCvar()`

- [ ] **8.3** Add `createMockCommand()` factory
  - Signature: `createMockCommand(name: string, handler: CommandHandler): Command`

- [ ] **8.4** Add `createMockCvarRegistry()` factory
  - Signature: `createMockCvarRegistry(cvars?: Record<string, string>): CvarRegistry`

- [ ] **8.5** Cleanup console tests in `client/tests/console/` directory
  - Estimated files: ~5

---

### 9. Documentation and Exports (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Tasks 1-8

- [ ] **9.1** Add JSDoc comments to all client utilities
  - Include usage examples for input injection, view setup, prediction testing

- [ ] **9.2** Update `test-utils/README.md` with client utilities section
  - Document: input mocks, view helpers, HUD utilities, client state mocks

- [ ] **9.3** Verify all client utilities exported from `test-utils/src/index.ts`
  - Organized by category: `client/mocks/*`, `client/helpers/*`

- [ ] **9.4** Add TypeScript type exports
  - Export all mock types and helper interfaces

---

## Summary

**Total Tasks:** 9
**Total Subtasks:** 57
**Estimated Impact:** ~70+ test files updated, ~500 lines of new utilities
**Critical Path:** Task 1 (input mocks) is independent; Task 2 (view utilities) blocks Task 5
**Parallel Opportunities:** Tasks 1, 3, 4, 6, 7, 8 can all run in parallel; Task 5 requires Task 2
