# Section 12: Demo Playback - Implementation Tasks

## Current Status
**~80% Complete (Parsing Infrastructure Improved, Client Integration Tested, UI Updated, Menu Integration Added)**

- ✅ Parser infrastructure exists (`NetworkMessageParser`, `DemoReader`, `DemoPlaybackController`)
- ✅ **Fixed**: Frame parsing now correctly handles `svc_packetentities` inside `svc_frame`
- ✅ **Fixed**: Entity commands (22, 23) correctly mapped for legacy protocols
- ✅ **Added**: Demo file indexing, metadata retrieval (frames, duration), and seeking support
- ✅ **Tested**: Client-side demo playback integration (start/stop, mode switching, render loop)
- ✅ **Fixed**: Protocol 26 compatibility (suppressCount check)
- ✅ **Updated**: Demo Playback Controls now show time, duration, and demo name
- ✅ **Added**: Frame-by-frame stepping (forward and backward)
- ✅ **Added**: Demo Menu (Tasks 2.1, 2.3) wired to main menu
- ⚠️ Protocol 25 parsing functional for frames, but sequence number handling may still be fragile for non-frame messages
- ❌ Demo file storage (IndexedDB) and advanced file validation pending (Task 2.2)
- ❌ Rerelease Protocol 2023 unverified with real demos

**Goal**: Enable playback of Quake II `.dm2` demo files in browser with full rendering.

---

## Implementation Roadmap

### Phase 0: Fix Critical Parser Bugs (URGENT - BLOCKS ALL OTHER WORK)

**Estimated Time**: 1-2 days
**Dependencies**: None
**Priority**: CRITICAL - Must be fixed before any other demo work

#### Problem Summary

The `NetworkMessageParser.parseFrame()` method is incomplete and doesn't follow the Quake2 protocol specification. According to the original Quake2 source (`full/client/cl_ents.c:663-739`), the `svc_frame` command has this structure:

```
svc_frame (command byte 20)
  ├─ serverframe (long)
  ├─ deltaframe (long)
  ├─ suppressCount (byte)
  ├─ areabits length (byte)
  ├─ areabits data (variable)
  ├─ svc_playerinfo (byte 22)
  │  └─ [player state data]
  └─ svc_packetentities (byte 23)
     └─ [entity data until entity number 0]
```

**Our current implementation:**
- ✅ Reads frame header correctly
- ✅ Reads areabits correctly
- ✅ Reads and validates `svc_playerinfo` command byte
- ✅ Parses player state correctly
- ✅ **FIXED**: Reads `svc_packetentities` command byte inside `parseFrame`
- ✅ **FIXED**: Parses entity data inside the frame and attaches to `FrameData`
- ✅ **FIXED**: Correctly translates legacy command bytes 22 and 23

**Result**: Real demo files show hundreds of "unknown command" errors because entity data bytes are being interpreted as command bytes.

#### Task 0.1: Fix svc_frame Parsing

**File**: `packages/engine/src/demo/parser.ts:969-1013`
**Reference**: `full/client/cl_ents.c:663-739`

- [x] **0.1.1** Update `parseFrame()` to read `svc_packetentities` command after player state
  - After calling `parsePlayerState()` at line 986
  - Read next command byte: `cmd = this.stream.readByte()`
  - Translate command: `cmd = this.translateCommand(cmd)`
  - Verify it's `svc_packetentities` (not `svc_deltapacketentities` for vanilla Q2)
  - If not `svc_packetentities`, throw error with context

- [x] **0.1.2** Parse packet entities inside `parseFrame()`
  - Call `const entities = this.collectPacketEntities()`
  - Store entities in frame data passed to handler
  - Update `FrameData` interface to include entities properly

- [x] **0.1.3** Remove standalone `svc_packetentities` handling from main loop
  - In `parseMessage()` switch statement (lines 347-351)
  - *Correction*: Retained standalone handling as fallback/legacy support. Some demos or fallback scenarios (e.g. failure in parseFrame) rely on the main loop picking up `packetentities`. Removing it entirely caused regression in `real_demo.test.ts`.
  - Added comment: `// Should only happen if not inside a frame (unlikely for vanilla)`

- [x] **0.1.4** Update `translateCommand()` for legacy protocols
  - Lines 788-791 in cl_parse.c show these are "out of place" errors
  - Ensure commands 22, 23 are recognized but only valid inside frames
  - Add comment explaining the protocol structure

**Test Case**: Update `packages/engine/tests/demo/real_demo.test.ts`
- Run against real demo1.dm2 from pak.pak
- Verify NO "unknown command" errors in console
- Verify NO parsing errors
- Verify frame count matches expected
- Verify entity count per frame > 0

#### Task 0.2: Fix Protocol 26 Compatibility

**File**: `packages/engine/src/demo/parser.ts:969-1013`
**Reference**: `full/client/cl_ents.c:679-681`

The original code has this check:
```c
// BIG HACK to let old demos continue to work
if (cls.serverProtocol != 26)
    cl.surpressCount = MSG_ReadByte (&net_message);
```

- [x] **0.2.1** Add protocol version check in `parseFrame()`
  - Lines 679-681 show suppressCount is NOT read for protocol 26
  - Add check: `if (this.protocolVersion !== 26)`
  - Only read suppressCount if protocol is not 26
  - Document why protocol 26 is special (old demo compatibility)

**Test Case**: Find or create protocol 26 demo file
- Test parsing with and without suppressCount
- Verify protocol 26 demos parse correctly
- Verify protocol 25 and 34 demos still work

#### Task 0.3: Verify Protocol 25 vs 34 Differences

**File**: `packages/engine/src/demo/parser.ts`
**Reference**: Compare `full/` and `rerelease/` source

- [ ] **0.3.1** Research protocol differences
  - Compare vanilla Q2 v3.00 (protocol 25) vs v3.20 (protocol 34)
  - Check if entity format differs
  - Check if command set differs
  - Document findings in code comments

- [ ] **0.3.2** Update `translateCommand()` if needed
  - Ensure protocol 25 and 34 handle commands correctly
  - Add any protocol-specific logic
  - Test with both protocol versions

**Test Case**:
- Test real_demo.test.ts confirms protocol 25 (demo1.dm2 from pak.pak)
- Find protocol 34 demo and test
- Compare entity counts and frame data

---

**Phase 0 Success Criteria:**
- ✅ Real demo1.dm2 (Protocol 25) parses with ZERO errors
- ✅ No "unknown command" warnings in console
- ✅ All frames have entity data
- ✅ Test suite passes
- ✅ Code matches original Quake2 protocol structure

**BLOCKER**: Phases 1-5 cannot proceed until Phase 0 is complete. The current parser is fundamentally broken and will fail on all real demo files.

---

### Phase 1: Client-Side Demo Playback Integration (No External Dependencies)

**Estimated Time**: 2-3 weeks
**Dependencies**: Existing parser and renderer infrastructure

#### Task 1.1: Wire DemoPlaybackController to Client
**File**: `packages/client/src/index.ts`
**Reference**: `full/client/cl_main.c` (CL_Frame, demo playback)

- [x] **1.1.1** Add demo playback mode state to `ClientExports`
  - Add `isDemoPlaying: boolean` property
  - Add `currentDemoName: string | null` property
  - Add enum `ClientMode { Normal, DemoPlayback, Multiplayer }`

- [x] **1.1.2** Create `startDemoPlayback(buffer: ArrayBuffer, filename: string): void` method
  - Call `demoPlayback.loadDemo(buffer)`
  - Set `demoHandler` as message handler via `demoPlayback.setHandler(demoHandler)`
  - Transition client to demo playback mode
  - [ ] Initialize demo HUD overlay

- [x] **1.1.3** Create `stopDemoPlayback(): void` method
  - Call `demoPlayback.stop()`
  - Clear demo state from `demoHandler`
  - Transition client back to normal mode
  - [ ] Clean up demo HUD overlay

- [x] **1.1.4** Update client render loop to handle demo playback
  - In `ClientExports.Sample()`, check if in demo mode
  - If demo mode, call `demoPlayback.update(dt)` instead of normal game update
  - Return camera/view from demo data instead of player state

**Test Case**: Create unit test in `packages/client/tests/demo-playback-integration.test.ts`
- [x] Mock DemoPlaybackController
- [x] Call startDemoPlayback with synthetic buffer
- [x] Verify mode transition
- [x] Verify update loop calls demoPlayback.update
- [x] Call stopDemoPlayback, verify cleanup

#### Task 1.2: Enhance ClientNetworkHandler for Demo Rendering
**File**: `packages/client/src/demo/handler.ts`
**Reference**: `full/client/cl_ents.c` (CL_AddPacketEntities)

- [x] **1.2.1** Add entity storage to `ClientNetworkHandler`
  - Add `private demoEntities: Map<number, EntityState>`
  - Add `private currentServerFrame: number`
  - Update `onFrame` to store entity states from frame data

- [x] **1.2.2** Implement `getEntitiesForRendering(): EntityState[]` method
  - Return array of current entity states
  - Filter out removed entities
  - Sort by entity number for consistent rendering
  - Note: Implemented as `getRenderableEntities` returning `RenderableEntity[]` using interpolation.

- [x] **1.2.3** Implement `getDemoCamera(): { origin: Vec3, angles: Vec3, fov: number }` method
  - Extract camera from player state in last frame
  - Return camera position, angles, FOV for renderer

- [x] **1.2.4** Add frame interpolation support
  - Store last 2 frames in ring buffer (`latestFrame`, `previousFrame`)
  - Add `previousEntities` map for entity interpolation
  - Implement interpolation logic in `getRenderableEntities` and `getPredictionState`

**Test Case**: Unit test in `packages/client/tests/demo/handler.test.ts`
- Create synthetic frame with entities
- Call onFrame handler
- Verify entities stored in map
- Call getEntitiesForRendering, verify correct entities returned
- Test interpolation with two frames at different times

#### Task 1.3: Update Renderer to Support Demo Entities
**File**: `packages/client/src/index.ts` (render path)
**Reference**: `full/client/cl_view.c` (V_RenderView)

- [x] **1.3.1** Modify `Sample()` method to use demo entities when in demo mode
  - Check `isDemoPlaying` flag
  - If true, call `demoHandler.getRenderableEntities()` instead of game entities
  - Call `demoHandler.getDemoCamera()` for camera position

- [x] **1.3.2** Update `buildRenderableEntities()` call in demo mode
  - Pass demo entities to `buildRenderableEntities`
  - Use demo configstrings for model lookups
  - Handle missing models gracefully (demo might reference models not loaded)

- [x] **1.3.3** Update HUD rendering for demo mode
  - Show demo playback controls overlay
  - Display demo time / total time
  - Show demo filename
  - Hide player-specific HUD elements

**Test Case**: Integration test in `packages/client/tests/demo-render-integration.test.ts`
- Mock renderer and demo handler
- Set demo mode active
- Call Sample
- Verify demo entities used instead of game entities
- Verify demo camera used
- Verify HUD overlay shown

#### Task 1.4: Demo Playback Controls UI
**File**: Create `packages/client/src/ui/demo-controls.ts`
**Reference**: UI patterns from existing menus

- [x] **1.4.1** Create `DemoControls` class
  - Add play/pause button state
  - Add current time / total time display
  - Add progress bar for seeking
  - Add speed selector (0.25x, 0.5x, 1x, 2x, 4x)

- [x] **1.4.2** Implement `render(ctx: CanvasRenderingContext2D): void` method
  - Draw transparent overlay at bottom of screen
  - Draw play/pause button icon
  - Draw timeline with current position marker
  - Draw time text (MM:SS / MM:SS format)
  - Draw speed indicator

- [x] **1.4.3** Implement `handleInput(key: string, down: boolean): boolean` method
  - Space: toggle play/pause
  - [x] Left/Right arrows: seek backward/forward 5 seconds (Implemented as frame stepping for now)
  - [x] [ and ]: decrease/increase playback speed
  - Escape: stop demo and return to menu
  - Return true if input consumed

- [x] **1.4.4** Wire controls to DemoPlaybackController
  - Call `demoPlayback.play()` on play button
  - Call `demoPlayback.pause()` on pause button
  - Call `demoPlayback.setSpeed(speed)` on speed change
  - Seeking requires DemoPlaybackController enhancement (see Task 1.5)

**Test Case**: Unit test in `packages/client/tests/ui/demo-controls.test.ts`
- Create DemoControls instance
- Mock canvas context
- Call render, verify drawing calls
- Test input handling (space, arrows, etc.)
- Verify state changes

#### Task 1.5: Enhance DemoPlaybackController
**File**: `packages/engine/src/demo/playback.ts`
**Reference**: `full/client/cl_main.c` (CL_Stop, CL_Pause)

- [x] **1.5.1** Add seeking support
  - Add `seek(frameNumber: number): void` method
  - Reset `DemoReader` to beginning
  - Parse frames sequentially until target frame reached
  - Update current position state

- [x] **1.5.2** Add speed control
  - Modify `playbackSpeed` property (already exists)
  - Ensure `update()` respects speed multiplier
  - Clamp speed to reasonable range (0.1x to 16x)

- [x] **1.5.3** Add demo metadata tracking
  - Add `getTotalFrames(): number` method (requires DemoReader enhancement)
  - Add `getCurrentFrame(): number` method
  - Add `getDuration(): number` method (frames * frame time)

- [x] **1.5.4** Add frame-by-frame stepping
  - [x] Add `stepForward(): void` method (advance 1 frame)
  - [x] Add `stepBackward(): void` method (seek to current - 1)

**Test Case**: Unit test in `packages/engine/tests/demo/playback.test.ts`
- Create mock DemoReader with known frame count
- Test seek to specific frame
- Test speed changes affect update timing
- Test frame stepping forward/backward
- Test duration calculation

#### Task 1.6: Enhance DemoReader with Metadata
**File**: `packages/engine/src/demo/demoReader.ts`
**Reference**: Quake II demo file format documentation

- [x] **1.6.1** Add demo file header parsing (Implemented via file scanning)
  - Parse demo format version
  - Store total message count (if available)
  - Store demo duration estimate

- [x] **1.6.2** Add `reset(): void` method
  - Reset read position to beginning of demo data
  - Clear any cached state
  - Prepare for replay from start

- [x] **1.6.3** Add `getMessageCount(): number` method
  - Return total number of messages in demo
  - Used for seek progress calculation

**Test Case**: Update `packages/engine/tests/demo/demoReader.test.ts`
- Use existing demo1.dm2 test file
- Verify header parsing
- Test reset functionality
- Verify message count accuracy

---

### Phase 2: Demo Menu Integration (No External Dependencies)

**Estimated Time**: 1 week
**Dependencies**: Phase 1 complete, existing menu system

#### Task 2.1: Create Demo Menu UI
**File**: Create `packages/client/src/ui/menu/demo.ts`
**Reference**: `packages/client/src/ui/menu/maps.ts` (similar list-based menu)

- [x] **2.1.1** Create `DemoMenuFactory` class
  - Constructor takes `MenuSystem` and `ClientExports` references
  - Implement `createDemoMenu(): Menu` method
  - Return menu with demo list and controls

- [x] **2.1.2** Implement demo list rendering
  - Show list of available demos (initially just file upload option)
  - Show demo name, duration (if parsed), file size
  - Highlight selected demo

- [x] **2.1.3** Add demo actions
  - "Load Demo File" - triggers file picker
  - "Play Demo" - starts selected demo
  - "Delete Demo" - removes from list (browser storage)
  - "Back" - return to main menu

**Test Case**: Unit test in `packages/client/tests/ui/menu/demo.test.ts`
- Create DemoMenuFactory
- Verify menu structure
- Test demo selection
- Test action callbacks

#### Task 2.2: File Upload for Demos
**File**: `packages/client/src/ui/pakLoader.ts` (adapt existing file loading)
**Reference**: Existing PAK loader pattern

- [ ] **2.2.1** Add `loadDemoFile(file: File): Promise<ArrayBuffer>` method
  - Read file as ArrayBuffer
  - Validate it's a .dm2 file (check header)
  - Return buffer for playback
  - Note: Initial implementation uses inline loading in DemoMenuFactory.

- [ ] **2.2.2** Add demo file validation
  - Check file extension is .dm2
  - Verify demo header magic bytes
  - Verify minimum file size
  - Return error message if invalid

- [ ] **2.2.3** Implement demo file storage in IndexedDB
  - Store uploaded demos for quick access
  - Key by filename
  - Store metadata (upload date, size, duration estimate)

**Test Case**: Unit test in `packages/client/tests/ui/pakLoader.test.ts`
- Create synthetic .dm2 file buffer
- Test loadDemoFile with valid file
- Test validation with invalid files
- Test IndexedDB storage/retrieval

#### Task 2.3: Wire Demo Menu to Main Menu
**File**: `packages/client/src/ui/menu/main.ts`
**Reference**: Existing menu wiring

- [x] **2.3.1** Add "Play Demo" option to main menu
  - Insert after "New Game" or "Load Game"
  - Create menu item with action that pushes demo menu

- [x] **2.3.2** Pass demo menu factory to MainMenuFactory
  - Update constructor to accept `DemoMenuFactory`
  - Store reference for menu creation

- [x] **2.3.3** Update main menu creation logic
  - Add demo menu factory to options
  - Wire "Play Demo" action to push demo menu

**Test Case**: Integration test in `packages/client/tests/ui/menu/integration.test.ts`
- Create full menu system with demo menu
- Verify "Play Demo" option present
- Click option, verify demo menu pushed
- Verify navigation works

---

### Phase 3: Demo Recording (No External Dependencies)

**Estimated Time**: 1 week
**Dependencies**: Phase 1 complete (need working playback to verify recording)

#### Task 3.1: Create DemoRecorder Class
**File**: Create `packages/engine/src/demo/recorder.ts`
**Reference**: `full/client/cl_main.c` (CL_Record, CL_WriteDemoMessage)

- [ ] **3.1.1** Create `DemoRecorder` class structure
  - Add `private isRecording: boolean`
  - Add `private messageBuffer: BinaryWriter`
  - Add `private startTime: number`
  - Add `private frameCount: number`

- [ ] **3.1.2** Implement `startRecording(filename: string): void` method
  - Initialize binary writer
  - Write demo header
  - Set isRecording flag
  - Record start time

- [ ] **3.1.3** Implement `recordMessage(data: Uint8Array): void` method
  - Write message length (4 bytes)
  - Write message data
  - Increment frame count

- [ ] **3.1.4** Implement `stopRecording(): Uint8Array` method
  - Finalize demo file
  - Return complete demo buffer
  - Clear recording state

**Test Case**: Unit test in `packages/engine/tests/demo/recorder.test.ts`
- Start recording
- Record several synthetic messages
- Stop recording
- Parse resulting buffer with DemoReader
- Verify messages match

#### Task 3.2: Integrate DemoRecorder with Client
**File**: `packages/client/src/index.ts`
**Reference**: Recording trigger points

- [ ] **3.2.1** Add DemoRecorder instance to client
  - Create `private demoRecorder: DemoRecorder` in createClient
  - Add `startRecording(name: string): void` to ClientExports
  - Add `stopRecording(): void` to ClientExports

- [ ] **3.2.2** Hook recording into network message flow
  - In multiplayer mode, record all `svc_*` messages received
  - In `MultiplayerConnection.handleMessage`, call `demoRecorder.recordMessage(data)`
  - Only record when multiplayer mode active and recording enabled

- [ ] **3.2.3** Add recording controls to UI
  - Add "Record Demo" button to multiplayer menu
  - Show recording indicator when active
  - Add "Stop Recording" button
  - Save demo file to IndexedDB when stopped

**Test Case**: Integration test in `packages/client/tests/demo-recording-integration.test.ts`
- Mock multiplayer connection
- Start recording
- Send synthetic server messages
- Stop recording
- Verify demo file created
- Play back demo, verify messages match

---

### Phase 4: Parser Robustness (No External Dependencies)

**Estimated Time**: 1 week
**Dependencies**: None (improvements to existing parser)

#### Task 4.1: Error Handling in NetworkMessageParser
**File**: `packages/engine/src/demo/parser.ts`
**Reference**: `full/client/cl_parse.c` (error handling patterns)

- [ ] **4.1.1** Add error recovery for corrupted data
  - Wrap `parseMessage()` in try-catch
  - On error, log detailed state (offset, command, protocol version)
  - Attempt to skip to next message boundary
  - Add `private errorCount: number` to track issues

- [ ] **4.1.2** Add unknown command handling
  - When encountering unknown `svc_*` command, log warning
  - Skip command gracefully (don't crash)
  - Allow forward compatibility with newer protocols

- [ ] **4.1.3** Add buffer overflow protection
  - Verify read position doesn't exceed buffer length
  - Add bounds checking before all reads
  - Throw specific error type for truncated data

- [ ] **4.1.4** Add detailed error messages
  - Include context: protocol version, current command, buffer offset
  - Create custom error types: `ParseError`, `TruncatedDemoError`, `UnknownCommandError`
  - Return error details to caller for UI display

**Test Case**: Update `packages/engine/tests/demo/parser.test.ts`
- Test with corrupted data (invalid commands)
- Test with truncated buffer
- Test with unknown command IDs
- Verify error messages contain useful context
- Verify parser doesn't crash

#### Task 4.2: Performance Optimization
**File**: `packages/engine/src/demo/parser.ts`
**Reference**: Profiling and optimization patterns

- [ ] **4.2.1** Profile entity delta parsing
  - Add timing instrumentation to `parseDelta` method
  - Identify hot paths in bit flag checking
  - Optimize field parsing (minimize object allocations)

- [ ] **4.2.2** Optimize BinaryStream reads
  - File: `packages/shared/src/protocol/binary.ts`
  - Cache frequently accessed data
  - Reduce bounds checking overhead where safe
  - Use typed arrays efficiently

- [ ] **4.2.3** Add parsing progress tracking
  - Add `getProgress(): { current: number, total: number }` to DemoReader
  - Update during parsing for UI progress bar
  - Return percentage for user feedback

**Test Case**: Performance test in `packages/engine/tests/demo/parser-performance.test.ts`
- Create large synthetic demo (1000+ frames)
- Measure parse time
- Verify parsing completes in reasonable time (<100ms for 1000 frames)
- No memory leaks (run multiple times, check memory)

---

### Phase 5: Rerelease Protocol Testing (REQUIRES EXTERNAL DEMO FILES)

**Estimated Time**: 2 weeks
**Dependencies**: Access to real Rerelease demo files

#### Task 5.1: Acquire Test Demo Files
**Location**: External - requires Quake II Rerelease installation
**Reference**: Typical demo location in Rerelease

- [ ] **5.1.1** Obtain Protocol 34 (v3.20) demos
  - Source from Quake II v3.20 installation or community
  - Need at least 3 demos: short, medium, long duration
  - Prefer demos with variety of weapons, monsters, effects

- [ ] **5.1.2** Obtain Protocol 2023 (Rerelease) demos
  - Source from Quake II Rerelease installation
  - Need demos using new features: fog, transparency, scaling
  - Need demos with compression (large maps)

- [ ] **5.1.3** Document demo file sources
  - Create `packages/engine/tests/demo/test-assets/README.md`
  - List each demo file with source, protocol version, features
  - Add to `.gitignore` if copyrighted

#### Task 5.2: Create Real Demo Regression Tests
**File**: Update `packages/engine/tests/demo/real_demo.test.ts`
**Reference**: Existing test structure

- [ ] **5.2.1** Add Protocol 34 demo tests
  - Test parsing completes without errors
  - Verify protocol version detected as 34
  - Verify frame count matches expected
  - Verify entity count reasonable
  - Verify configstrings parsed

- [ ] **5.2.2** Add Protocol 2023 demo tests (**CRITICAL - NEVER TESTED**)
  - Test parsing completes without errors
  - Verify protocol version detected as 2023
  - Verify new `svc_*` commands encountered and parsed
  - Verify entity extensions (alpha, scale) present in data
  - Verify compression commands work

- [ ] **5.2.3** Add long demo stress tests
  - Test demos >10 minutes duration
  - Verify no memory leaks
  - Verify no slowdown over time
  - Test seeking to various positions

**Test Case**: Real demo tests (skip if files not available)
- Load each acquired demo file
- Parse completely
- Verify expected metadata
- Compare rendered frames to screenshots from original Quake II (visual regression)

#### Task 5.3: Verify Rerelease Features
**File**: `packages/engine/tests/demo/rerelease_features.test.ts`
**Reference**: Rerelease feature list

- [ ] **5.3.1** Test fog rendering
  - Load demo with fog
  - Verify fog parameters parsed from `svc_fog`
  - Verify renderer receives fog settings
  - Visual check: fog renders correctly

- [ ] **5.3.2** Test entity transparency
  - Load demo with transparent entities
  - Verify `alpha` field parsed from entity state
  - Verify renderer uses alpha for transparency
  - Visual check: entities are translucent

- [ ] **5.3.3** Test entity scaling
  - Load demo with scaled entities
  - Verify `scale` field parsed from entity state
  - Verify renderer applies scale transform
  - Visual check: entities are scaled

- [ ] **5.3.4** Test compression
  - Load demo using `svc_configblast` or `svc_spawnbaselineblast`
  - Verify zlib decompression succeeds
  - Verify decompressed data matches expected format
  - Compare entity count before/after compression

**Test Case**: Feature-specific tests (requires appropriate demo files)
- Each test needs specific demo file with that feature
- Document which demo file tests which feature
- Skip test if demo file not available

#### Task 5.4: Visual Regression Testing
**File**: Create `packages/engine/tests/demo/visual-regression.test.ts`
**Reference**: Image comparison testing patterns

- [ ] **5.4.1** Set up visual regression framework
  - Use headless browser (Puppeteer)
  - Capture screenshots at specific demo frames
  - Compare to baseline images from original Quake II

- [ ] **5.4.2** Create baseline images
  - Run demos in original Quake II Rerelease
  - Capture screenshots at specific times (0s, 10s, 30s, 60s)
  - Store as baseline PNGs

- [ ] **5.4.3** Implement comparison tests
  - Play demo in quake2ts
  - Capture screenshots at same times
  - Compare pixel-by-pixel with baseline
  - Allow threshold for minor differences (95% match)

- [ ] **5.4.4** Document visual differences
  - If differences found, document expected vs actual
  - Determine if differences are acceptable (rendering engine differences)
  - Create issues for unacceptable differences

**Test Case**: Visual regression suite (manual setup required)
- Requires baseline images
- Requires working renderer
- Expensive test - run on CI only
- Skip if baselines not available

---

## Success Criteria

**Phase 1 Complete When:**
- ✅ Can programmatically start/stop demo playback in client
- ✅ Demo entities render on screen
- ✅ Demo camera controls view
- ✅ Playback controls work (play/pause/seek/speed)
- ✅ All tests pass

**Phase 2 Complete When:**
- ✅ Can load demo files via UI
- ✅ Demo menu accessible from main menu
- ✅ Uploaded demos persist in browser storage
- ✅ All tests pass

**Phase 3 Complete When:**
- ✅ Can record demos during multiplayer
- ✅ Recorded demos play back correctly
- ✅ All tests pass

**Phase 4 Complete When:**
- ✅ Parser handles all error cases gracefully
- ✅ Performance meets targets (>60 FPS playback)
- ✅ All tests pass

**Phase 5 Complete When:**
- ✅ Protocol 34 demos verified working
- ✅ Protocol 2023 demos verified working
- ✅ Rerelease features verified working
- ✅ Visual regression tests pass or differences documented
- ✅ All tests pass

---

## Dependencies Summary

**Phase 1 → 2**: Demo playback must work before menu integration useful
**Phase 1 → 3**: Playback must work to verify recording
**Phase 1 → 5**: Parser must work before testing with real files
**Phase 5**: Requires external demo files (obtain separately)

**No Blockers for Phases 1-4** - All can be implemented with existing code and synthetic tests.
