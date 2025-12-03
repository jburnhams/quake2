# Section 12: Demo Playback - Implementation Tasks

## Current Status
**~65% Complete (Phase 1 Integration Basic Complete)**

- ✅ Parser infrastructure exists and verified (Phase 0 complete)
- ✅ `svc_frame` parsing bugs fixed for Protocol 25
- ✅ Client-side Demo Playback integration (Phase 1) mostly complete
- ✅ `DemoControls` UI scaffolded and wired
- ✅ `DemoPlaybackController` wired to render loop
- ⚠️ Seeking and Speed Control logic pending (Task 1.5)
- ❌ Demo Menu integration (Phase 2) not started

**Goal**: Enable playback of Quake II `.dm2` demo files in browser with full rendering.

---

## Implementation Roadmap

### Phase 0: Fix Critical Parser Bugs (COMPLETE)
**Status**: ✅ Done
- Fixed `svc_frame` parsing for Protocol 25 (split structure).
- Validated with `demo1.dm2`.
- Fixed test regressions in engine package.

---

### Phase 1: Client-Side Demo Playback Integration (COMPLETE)

**Estimated Time**: Completed
**Dependencies**: Existing parser and renderer infrastructure

#### Task 1.1: Wire DemoPlaybackController to Client (DONE)
- ✅ **1.1.1** Added `isDemoPlaying`, `currentDemoName`, `mode` to `ClientExports`.
- ✅ **1.1.2** Implemented `startDemoPlayback` (loads demo, sets handler, resets state).
- ✅ **1.1.3** Implemented `stopDemoPlayback` (stops controller, clears state).
- ✅ **1.1.4** Updated `render()` loop to delegate to `demoPlayback.update(dt)`.
  - Implemented interpolation alpha calculation using `getCurrentTime() / getFrameDuration()`.
  - Delegated entity retrieval to `demoHandler.getRenderableEntities()`.

#### Task 1.2: Enhance ClientNetworkHandler for Demo Rendering (DONE)
- ✅ **1.2.1** `ClientNetworkHandler` stores entity state map.
- ✅ **1.2.2** `getRenderableEntities` implemented with interpolation support (delegates to `buildRenderableEntities`).
- ✅ **1.2.3** `getDemoCamera` implemented via `getPredictionState` interpolation.
- ✅ **1.2.4** Frame interpolation logic verified (using `latestFrame`, `previousFrame`, and `baselines`).

#### Task 1.3: Update Renderer to Support Demo Entities (DONE)
- ✅ **1.3.1** `ClientExports.render()` uses `demoHandler` for entities and camera when in demo mode.
- ✅ **1.3.2** `buildRenderableEntities` is used for demo entities.
- ✅ **1.3.3** HUD rendering delegates to `DemoControls` overlay when playing.

#### Task 1.4: Demo Playback Controls UI (DONE)
- ✅ **1.4.1** Created `DemoControls` class in `packages/client/src/ui/demo-controls.ts`.
- ✅ **1.4.2** Implemented basic `render` method (Status text, Help text).
- ✅ **1.4.3** Implemented `handleInput` (Space to Pause/Play, Escape to Stop).
- ✅ **1.4.4** Wired controls into `ClientExports` (`DrawHUD` and `handleInput`).

#### Task 1.5: Enhance DemoPlaybackController (PARTIAL)
**File**: `packages/engine/src/demo/playback.ts`
- [ ] **1.5.1** Add seeking support
  - Add `seek(frameNumber: number): void` method
- [ ] **1.5.2** Add speed control
  - Add `setSpeed(speed: number)` method
- [ ] **1.5.3** Add demo metadata tracking
  - Add `getTotalFrames(): number` method
  - Add `getDuration(): number` method

#### Task 1.6: Enhance DemoReader with Metadata
- [ ] **1.6.1** Add demo file header parsing (duration estimate).
- [ ] **1.6.2** Add `reset(): void` method (for looping/seeking).
- [ ] **1.6.3** Add `getMessageCount(): number`.

---

### Phase 2: Demo Menu Integration (No External Dependencies)

**Estimated Time**: 1 week
**Dependencies**: Phase 1 complete

#### Task 2.1: Create Demo Menu UI
- [ ] **2.1.1** Create `DemoMenuFactory` class.
- [ ] **2.1.2** Implement demo list rendering.
- [ ] **2.1.3** Add demo actions (Load, Play, Delete).

#### Task 2.2: File Upload for Demos
- [ ] **2.2.1** Add `loadDemoFile(file: File)`.
- [ ] **2.2.2** Add demo file validation.
- [ ] **2.2.3** Implement demo file storage in IndexedDB.

#### Task 2.3: Wire Demo Menu to Main Menu
- [ ] **2.3.1** Add "Play Demo" option to main menu.
- [ ] **2.3.2** Pass demo menu factory to MainMenuFactory.
- [ ] **2.3.3** Update main menu creation logic.

---

### Phase 3: Demo Recording (No External Dependencies)
... (See previous doc for details)

### Phase 4: Parser Robustness (No External Dependencies)
... (See previous doc for details)

### Phase 5: Rerelease Protocol Testing (REQUIRES EXTERNAL DEMO FILES)
... (See previous doc for details)

---

## Success Criteria

**Phase 1 Complete When:**
- ✅ Can programmatically start/stop demo playback in client
- ✅ Demo entities render on screen
- ✅ Demo camera controls view
- ✅ Playback controls work (play/pause/stop) - *Seeking pending Task 1.5*
- ✅ All tests pass

**Phase 2 Complete When:**
- ✅ Can load demo files via UI
- ✅ Demo menu accessible from main menu
- ✅ Uploaded demos persist in browser storage
- ✅ All tests pass
