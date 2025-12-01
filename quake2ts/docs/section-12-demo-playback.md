# Section 12: Demo Playback

## Overview
This section covers the implementation of Quake II demo (`.dm2`) playback in the browser. The goal is to parse and render standard Quake II demo files, which record the server-to-client network stream. This involves implementing a strict parser for the Quake II network protocol (`svc_*` commands), a demo file container reader, and a playback controller that feeds these messages into the engine's state machine, simulating a live connection.

**Current Status:** The system implements both Vanilla Quake II (v3.20) and Rerelease (Protocol 2023) network protocol parsing. Vanilla demo playback is functional (~90% complete). Rerelease Protocol 2023 support is approximately **70% complete** with significant gaps remaining in entity state parsing and command handlers (see Known Gaps below).

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
- ⚠️ Implemented basic parsing hooks for new `svc_*` commands in `NetworkMessageParser` (some handlers incomplete - see Known Gaps).
- ✅ Updated `ClientNetworkHandler` to support the updated parser interface.
- ⚠️ Added unit tests for Rerelease command parsing (`svc_muzzleflash3`, `svc_level_restart`) - limited coverage (4 tests, 11 assertions).
- ⚠️ Implemented parsing logic for most Rerelease `svc_*` commands, including Zlib decompression for `svc_configblast` and `svc_spawnbaselineblast` (some handlers incomplete).
- ⚠️ Added unit tests in `packages/engine/tests/demo/` (synthetic data only, no real `.dm2` files tested).
- ✅ Verified `DemoPlaybackController` can handle larger Rerelease frames (up to 2MB).
- ⚠️ Updated `packages/client` to respect new entity fields `scale` and `alpha` during rendering (fields defined but not parsed from demos).
- ⚠️ Added explicit unit tests for Protocol 2023 detection in `packages/engine/tests/demo/rerelease_protocol.test.ts` (limited test coverage).

## Protocol Gaps (Rerelease / Protocol 2023)

To support modern "Rerelease" demos and servers, the following extensions must be implemented.

### 1. Protocol Version
- **Current:** Supports Protocol 34 (Vanilla).
- **Target:** Must default to Protocol 2023 (Rerelease), while maintaining legacy support for Protocol 34.

### 2. Server Commands (`svc_*`) - Implementation Status
The following Rerelease commands in `packages/engine/src/demo/parser.ts`:
- [x] `svc_splitclient` - Fully implemented
- [x] `svc_configblast` - Zlib decompression working
- [x] `svc_spawnbaselineblast` - Zlib decompression working
- [x] `svc_level_restart` - Fully implemented
- [x] `svc_damage` - Fully implemented
- [ ] `svc_locprint` - **Parsing implemented but handler not called** (parser.ts:553)
- [x] `svc_fog` - Fully implemented
- [ ] `svc_waitingforplayers` - **Count parsed but not passed to handler** (parser.ts:560-564)
- [x] `svc_bot_chat` - Fully implemented
- [x] `svc_poi` - Fully implemented
- [x] `svc_help_path` - Fully implemented
- [x] `svc_muzzleflash3` - Fully implemented
- [ ] `svc_achievement` - **Parsing implemented but handler not called** (parser.ts:600-607, type mismatch issue)

### 3. Entity State Extensions - **CRITICAL GAP**
The `EntityState` interface in `packages/shared/src/protocol/entityState.ts` includes Rerelease fields **BUT THEY ARE NOT PARSED FROM THE NETWORK STREAM**:
- ⚠️ `alpha` (float) - **Interface defined, `U_ALPHA` flag exists, but never read in `parseDelta()`**
- ⚠️ `scale` (float) - **Interface defined, but no `U_SCALE` flag or parsing logic**
- ⚠️ `instance_bits` (visibility masks) - **Interface defined, but no `U_INSTANCE_BITS` flag or parsing logic**
- ⚠️ `loop_volume`, `loop_attenuation` - **Interface defined, but no flags or parsing logic**
- ⚠️ `owner` (for client-side prediction skipping) - **Interface defined, but no `U_OWNER` flag or parsing logic**
- ⚠️ `old_frame` (for custom interpolation) - **Interface defined, but no `U_OLD_FRAME` flag or parsing logic**

**Impact:** Rerelease demos cannot display entities with transparency, scaling, looping sounds, or custom interpolation. All these fields remain at default value (0).

### 4. Player State Extensions
The `PlayerState` interface in `packages/shared/src/protocol/player-state.ts` now includes:
- ✅ `gunskin`, `gunrate`
- ✅ `damage_blend` (rgba)
- ✅ `team_id`

## Known Gaps and Required Work

### Critical Issues (Blocks Rerelease Demo Playback)

1. **Entity State Rerelease Fields Not Parsed** (`packages/engine/src/demo/parser.ts:1131-1204`)
   - `parseDelta()` function does not read any Rerelease-specific entity fields
   - Missing bit flag definitions: `U_SCALE`, `U_INSTANCE_BITS`, `U_LOOP_VOLUME`, `U_LOOP_ATTENUATION`, `U_OWNER`, `U_OLD_FRAME`
   - `U_ALPHA` flag defined but never checked or read
   - **Impact:** Entity transparency, scaling, visibility masks, sound loops, and interpolation all non-functional

2. **Incomplete Command Handlers**
   - `svc_locprint` (line 553): Handler not invoked (TODO comment present)
   - `svc_waitingforplayers` (lines 560-564): Parsed count not passed to handler
   - `svc_achievement` (lines 600-607): Handler not invoked due to type mismatch (reads string, handler expects number)

3. **No Real Demo File Testing**
   - All tests use synthetic programmatically-generated data
   - No actual `.dm2` files (vanilla or rerelease) tested
   - Cannot verify correctness against real-world demos

### Testing Gaps

1. **Limited Test Coverage**
   - Only 4 test cases with 11 assertions for Protocol 2023 features
   - No integration tests with actual demo files
   - No tests validating entity state field parsing

2. **Missing Test Assets**
   - Need vanilla Quake II `.dm2` demo files for regression testing
   - Need Rerelease `.dm2` demo files for Protocol 2023 validation
   - Need demo files exercising all entity state features (transparency, scaling, etc.)

## Subtasks to Complete Demo Playback

### Phase 1: Fix Rerelease Entity State Parsing (Critical)
**Location:** `packages/engine/src/demo/parser.ts`

1. **Define Missing Bit Flags** (after line 23)
   ```typescript
   export const U_SCALE            = (1 << 28);  // Or appropriate bit position
   export const U_INSTANCE_BITS    = (1 << 29);
   export const U_LOOP_VOLUME      = (1 << 30);
   export const U_LOOP_ATTENUATION = (1 << 31);
   export const U_OWNER            = /* next available bit in extended flags */;
   export const U_OLD_FRAME        = /* next available bit */;
   ```
   **Reference:** Check `/home/user/quake2/full/` source for correct bit positions

2. **Update `parseDelta()` Function** (lines 1131-1204)
   - Add checks for new bit flags
   - Read corresponding fields from stream when flags are set:
     - If `U_ALPHA`: read `entity.alpha = stream.readByte() / 255.0`
     - If `U_SCALE`: read `entity.scale = stream.readFloat()` or appropriate format
     - If `U_INSTANCE_BITS`: read `entity.instanceBits = stream.readLong()`
     - If `U_LOOP_VOLUME`: read `entity.loopVolume = stream.readByte()`
     - If `U_LOOP_ATTENUATION`: read `entity.loopAttenuation = stream.readByte()`
     - If `U_OWNER`: read `entity.owner = stream.readShort()`
     - If `U_OLD_FRAME`: read `entity.oldFrame = stream.readByte()` or `readShort()`

3. **Verify Bit Flag Ordering**
   - Ensure flags are checked in correct protocol order
   - Match exact order from reference source to avoid stream desync

### Phase 2: Fix Incomplete Command Handlers

1. **Fix `svc_locprint`** (parser.ts:553)
   - Update handler interface to accept localization key string
   - Call handler with parsed data: `this.handlers.onLocPrint?.(locKey);`

2. **Fix `svc_waitingforplayers`** (parser.ts:560-564)
   - Pass count to handler: `this.handlers.onWaitingForPlayers?.(count);`

3. **Fix `svc_achievement`** (parser.ts:600-607)
   - Determine correct type: Does handler need string ID or numeric ID?
   - If string: Update handler interface to accept string
   - If numeric: Add mapping from achievement string ID to number
   - Call handler with appropriate data

### Phase 3: Comprehensive Testing

1. **Acquire Real Demo Files**
   - Obtain vanilla Quake II `.dm2` demo (any version)
   - Obtain Rerelease `.dm2` demo from Protocol 2023 game
   - Place in `packages/engine/tests/fixtures/` directory

2. **Create Real Demo File Tests**
   - Test: Load and parse vanilla `.dm2` without errors
   - Test: Load and parse Rerelease `.dm2` without errors
   - Test: Verify entity count, frame count match expected values
   - Test: Verify specific entities have correct Rerelease fields (alpha, scale)

3. **Add Entity State Parsing Tests**
   - Unit test: Verify `parseDelta()` reads `alpha` when `U_ALPHA` flag set
   - Unit test: Verify `parseDelta()` reads `scale` when `U_SCALE` flag set
   - Unit test: Verify all Rerelease entity fields parsed correctly
   - Integration test: Parse synthetic demo with known entity states, verify values

4. **Expand Protocol 2023 Test Coverage**
   - Currently: 4 tests, 11 assertions
   - Target: 20+ tests covering all Rerelease commands
   - Add tests for edge cases (max values, compressed data, etc.)

### Phase 4: Documentation and Validation

1. **Document Bit Flag Sources**
   - Add comments in code indicating which source file defines each flag
   - Document any differences between vanilla and Rerelease flag usage

2. **Validate Against Reference Source**
   - Compare `parseDelta()` logic to `/home/user/quake2/full/client/cl_parse.cpp`
   - Ensure 1:1 correspondence of all field parsing
   - Document any intentional deviations

3. **Update This Document**
   - Move completed items from "Subtasks" to "Work Already Done"
   - Update "Current Status" percentage
   - Remove "Known Gaps" as they are resolved

## Implementation Notes
- **Reference**: The `/home/user/quake2/rerelease/` directory contains only game logic source code (G_*.cpp, AI, monsters, items, triggers). **It does not contain client/server engine source code.** Client parsing reference (`cl_parse.cpp`) is located in `/home/user/quake2/full/client/` directory. Server network code is in `/home/user/quake2/full/server/`.
- **Legacy Support**: The parser should switch modes based on the `protocolVersion` received in `svc_serverdata`.
