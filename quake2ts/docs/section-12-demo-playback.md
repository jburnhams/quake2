# Section 12: Demo Playback

## Overview
This section covers the implementation of Quake II demo (`.dm2`) playback in the browser. The goal is to parse and render standard Quake II demo files, which record the server-to-client network stream. This involves implementing a strict parser for the Quake II network protocol (`svc_*` commands), a demo file container reader, and a playback controller that feeds these messages into the engine's state machine, simulating a live connection.

**Current Status:** The demo parsing infrastructure is ~70% complete. The NetworkMessageParser can parse Protocol 25 (Q2 v3.00), Protocol 34 (Q2 v3.20), and Protocol 2023 (Rerelease) formats. **Demo playback is NOT functional** - the parser exists but is not integrated into any playable demo viewer. Rerelease Protocol 2023 parsing is implemented but **UNVERIFIED** - all tests use synthetic data, no real Rerelease .dm2 files have been tested. **Critical**: No application exists to actually play demos.

## Dependencies
- **Shared Protocol**: Requires complete definition of `svc_ops_e` and `clc_ops_e` opcodes for both Vanilla and Rerelease protocols.
- **Network Message Parser**: A robust bit/byte stream reader to parse sequential network messages.
- **Client State**: Access to the client's entity and resource state to apply updates.

## Work Already Done
- ✅ Basic bitstream reading in `packages/shared`.
- ✅ Defined `ServerCommand` (`svc_*`) and `ClientCommand` (`clc_*`) enums in `packages/shared/src/protocol/ops.ts` (Vanilla only).
- ✅ Implemented `NetworkMessageParser` in `packages/engine/src/demo/parser.ts` covering standard Vanilla commands.
- ✅ Implemented `DemoReader` in `packages/engine/src/demo/demoReader.ts` for `.dm2` container format.
- ✅ Implemented `DemoPlaybackController` in `packages/engine/src/demo/playback.ts`.
- ✅ Implemented `ClientNetworkHandler` in `packages/client/src/demo/handler.ts`.
- ✅ Updated `ServerCommand` enums in `packages/shared` with Rerelease extensions (`svc_splitclient`...`svc_achievement`).
- ✅ Updated `EntityState` and `PlayerState` interfaces with Rerelease fields.
- ✅ Implemented basic parsing hooks for new `svc_*` commands in `NetworkMessageParser`.
- ✅ Updated `ClientNetworkHandler` to support the updated parser interface.
- ✅ Added unit tests for Rerelease command parsing (`svc_muzzleflash3`, `svc_level_restart`).
- ✅ Implemented parsing logic for all Rerelease `svc_*` commands, including Zlib decompression for `svc_configblast` and `svc_spawnbaselineblast`.
- ✅ Added unit tests in `packages/engine/tests/demo/` (synthetic data only, no real `.dm2` files tested).
- ✅ Verified `DemoPlaybackController` can handle larger Rerelease frames (up to 2MB).
- ✅ Updated `packages/client` to respect new entity fields `scale` and `alpha` during rendering.
- ✅ Added explicit unit tests for Protocol 2023 detection in `packages/engine/tests/demo/rerelease_protocol.test.ts`.
- ✅ Defined and implemented parsing for Rerelease entity state flags: `U_SCALE`, `U_INSTANCE_BITS`, `U_LOOP_VOLUME`, `U_LOOP_ATTENUATION`, `U_OWNER`, `U_OLD_FRAME`, and `U_ALPHA`.
- ✅ Implemented command handlers for `svc_locprint`, `svc_waitingforplayers`, and `svc_achievement`.
- ✅ Updated `ClientNetworkHandler` to support new entity fields and callbacks.
- ✅ **Implemented Synthetic Tests**: Created comprehensive synthetic tests in `packages/engine/tests/demo/synthetic_parser.test.ts` to verify parsing of Rerelease ServerData, Entity Deltas (including extensions), MuzzleFlash3, and LocPrint messages.
- ✅ **Documented Bit Flags**: Added comments in `packages/engine/src/demo/parser.ts` referencing `qcommon/qcommon.h` as the source for bit flags.
- ✅ **Validated Against Reference**: Verified `parseDelta` logic and bit flags against Quake II Rerelease source references.

## Protocol Gaps (Rerelease / Protocol 2023)

To support modern "Rerelease" demos and servers, the following extensions must be implemented.

### 1. Protocol Version
- **Current:** Supports Protocol 34 (Vanilla).
- **Target:** Must default to Protocol 2023 (Rerelease), while maintaining legacy support for Protocol 34. (Done: Parser detects Protocol 2023 and switches modes).

### 2. Server Commands (`svc_*`) - Implementation Status
The following Rerelease commands in `packages/engine/src/demo/parser.ts` are implemented:
- [x] `svc_splitclient` - Fully implemented
- [x] `svc_configblast` - Zlib decompression working
- [x] `svc_spawnbaselineblast` - Zlib decompression working
- [x] `svc_level_restart` - Fully implemented
- [x] `svc_damage` - Fully implemented
- [x] `svc_locprint` - Fully implemented
- [x] `svc_fog` - Fully implemented
- [x] `svc_waitingforplayers` - Fully implemented
- [x] `svc_bot_chat` - Fully implemented
- [x] `svc_poi` - Fully implemented
- [x] `svc_help_path` - Fully implemented
- [x] `svc_muzzleflash3` - Fully implemented
- [x] `svc_achievement` - Fully implemented

### 3. Entity State Extensions
The `EntityState` interface in `packages/shared/src/protocol/entityState.ts` includes Rerelease fields which are now parsed from the network stream:
- [x] `alpha`
- [x] `scale`
- [x] `instance_bits`
- [x] `loop_volume`
- [x] `loop_attenuation`
- [x] `owner`
- [x] `old_frame`

### 4. Player State Extensions
The `PlayerState` interface in `packages/shared/src/protocol/player-state.ts` now includes:
- ✅ `gunskin`, `gunrate`
- ✅ `damage_blend` (rgba)
- ✅ `team_id`

## Remaining Work

### Critical Gaps (BLOCKS DEMO PLAYBACK)

1. **No Demo Viewer Application**
   - Parser and DemoPlaybackController exist but are unused
   - No UI to load demo files
   - No integration with renderer
   - No demo playback controls (play/pause/seek)
   - **Impact**: Cannot actually play demos despite parser being "complete"

2. **Missing Real Demo Testing**
   - Only tested with ONE real demo file: demo1.dm2 (Protocol 25, not even v3.20)
   - No Protocol 34 (v3.20) demos tested
   - **NO Rerelease (Protocol 2023) demos tested at all**
   - All Rerelease tests use synthetic data only
   - **Cannot verify Rerelease parsing actually works**

3. **Parser-Renderer Integration Missing**
   - Parser outputs entity states, but no code consumes them for rendering
   - Frame interpolation not implemented
   - Camera/view handling for demo playback missing
   - **Impact**: Even if parser works, cannot render the demo

## Implementation Notes
- **Reference**: The `/home/user/quake2/rerelease/` directory contains only game logic source code. **It does not contain client/server engine source code.** Client parsing reference (`cl_parse.cpp`) is located in `/home/user/quake2/full/client/` directory. Server network code is in `/home/user/quake2/full/server/`.
- **Legacy Support**: The parser should switch modes based on the `protocolVersion` received in `svc_serverdata`.

---

## Revised Completion Roadmap

**Current Reality Check:**
- ❌ Demo playback is NOT functional - parser exists but not integrated
- ❌ Rerelease demos are UNVERIFIED - only synthetic tests exist
- ❌ No demo viewer application exists
- ✅ Parser can parse Protocol 25, 34, and 2023 formats (parsing only)
- ✅ DemoPlaybackController class exists
- ✅ Tested with ONE real demo file (demo1.dm2, Protocol 25)

**Critical Path to Working Demo Playback:**

### Phase 1: Demo Viewer Application (BLOCKS EVERYTHING) - 2-3 weeks
**No demo playback without an actual viewer**

1. **Create Demo Viewer Package** (`packages/demo-viewer` or in existing client)
   - File upload UI for .dm2 files
   - Demo playback controls (play, pause, stop, seek)
   - Timeline scrubber showing demo duration
   - Speed controls (0.5x, 1x, 2x, etc.)
   - Frame-by-frame stepping

2. **Integrate Parser with Renderer**
   - Feed parsed entity states to renderer
   - Implement frame interpolation for smooth playback
   - Handle camera/view updates from demo
   - Render HUD elements from demo data
   - Handle configstring updates (models, sounds)

3. **Add Demo Controls to Main Menu**
   - "Play Demo" menu option
   - Demo browser showing available demos
   - Recently played demos list

### Phase 2: Real Demo Testing (CRITICAL FOR VALIDATION) - 1 week
**Cannot claim "support" without testing real demos**

1. **Acquire Test Demos**
   - Find/create Protocol 34 (v3.20) demo files
   - Find/create Protocol 2023 (Rerelease) demo files
   - Get demos with various features (transparency, scaling, etc.)

2. **Test Vanilla Demos (Protocol 34)**
   - Test parsing without errors
   - Verify entity states match expected values
   - Verify visual rendering matches original Quake II
   - Test long demos (>10 minutes)
   - Test demos with many entities

3. **Test Rerelease Demos (Protocol 2023)**
   - **THIS HAS NEVER BEEN DONE**
   - Verify all new svc_* commands parse correctly
   - Verify entity extensions (alpha, scale) work
   - Verify compression (configblast, spawnbaselineblast) works
   - Compare frame-by-frame with original Rerelease

4. **Create Demo Regression Suite**
   - Add real .dm2 files to test assets
   - Automated tests that verify parsing output
   - Visual regression tests comparing rendered frames

### Phase 3: Parser Robustness - 1 week
**Handle edge cases and errors gracefully**

1. **Error Handling**
   - Gracefully handle corrupted demo files
   - Detect truncated demos
   - Handle unknown commands (forward compatibility)
   - Add detailed error messages

2. **Performance Optimization**
   - Profile parser performance on large demos
   - Optimize entity delta parsing
   - Add parsing progress indicator
   - Implement demo streaming (don't load entire file)

3. **Advanced Features**
   - Demo recording support
   - Demo editing (cut, trim, concat)
   - Demo metadata extraction
   - Demo statistics (map, duration, kills, etc.)

### Phase 4: Rerelease Feature Verification - 1 week
**Ensure Rerelease features work correctly**

1. **Entity Extensions**
   - Verify alpha transparency renders correctly
   - Verify entity scaling works
   - Verify instance bits handled
   - Verify loop sounds work

2. **New Commands**
   - Test all fog types
   - Test POI markers
   - Test bot chat
   - Test achievements
   - Test level_restart

3. **Compression**
   - Verify zlib decompression works on real data
   - Test large compressed baselines
   - Test compressed configstrings

**Total Time to Working Demo Playback: 5-6 weeks**

**Success Criteria:**
- ✅ Can load and play .dm2 files from file picker
- ✅ Demo renders correctly with proper camera/entities/effects
- ✅ Playback controls work (play/pause/seek/speed)
- ✅ Protocol 34 demos work perfectly
- ✅ Protocol 2023 demos work with all Rerelease features
- ✅ Tested with at least 10 different real demo files
- ✅ Parser handles errors without crashing
- ✅ Performance is acceptable (60 FPS playback)

---

## Concise Subtask List for Completion

**Section 12 - Demo Playback (5-6 weeks)**

1. **Demo Viewer UI** (1 week)
   - File upload for .dm2
   - Playback controls (play/pause/seek)
   - Speed controls
   - Timeline scrubber

2. **Parser-Renderer Integration** (1-2 weeks)
   - Feed entity states to renderer
   - Frame interpolation
   - Camera handling
   - Configstring application

3. **Real Demo Testing** (1 week)
   - Acquire Protocol 34 demos
   - Acquire Protocol 2023 demos
   - Test and fix issues
   - Create regression suite

4. **Rerelease Verification** (1 week)
   - Test with real Rerelease demos
   - Verify all extensions work
   - Fix any parsing issues
   - Document any limitations

5. **Polish** (1 week)
   - Error handling
   - Performance optimization
   - Demo browser UI
   - Documentation
