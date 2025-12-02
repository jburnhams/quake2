# Section 12: Demo Playback

## Overview
This section covers the implementation of Quake II demo (`.dm2`) playback in the browser. The goal is to parse and render standard Quake II demo files, which record the server-to-client network stream. This involves implementing a strict parser for the Quake II network protocol (`svc_*` commands), a demo file container reader, and a playback controller that feeds these messages into the engine's state machine, simulating a live connection.

**Current Status:** The system implements both Vanilla Quake II (v3.20) and Rerelease (Protocol 2023) network protocol parsing. Vanilla demo playback is functional. Rerelease Protocol 2023 support is complete, with entity state extensions and all new commands implemented and verified via synthetic tests.

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

### Testing Gaps

1. **Missing Test Assets**
   - Need vanilla Quake II `.dm2` demo files for regression testing (Deferred: Using synthetic tests)
   - Need Rerelease `.dm2` demo files for Protocol 2023 validation (Deferred: Using synthetic tests)
   - Need demo files exercising all entity state features (transparency, scaling, etc.) (Deferred: Using synthetic tests)

## Implementation Notes
- **Reference**: The `/home/user/quake2/rerelease/` directory contains only game logic source code. **It does not contain client/server engine source code.** Client parsing reference (`cl_parse.cpp`) is located in `/home/user/quake2/full/client/` directory. Server network code is in `/home/user/quake2/full/server/`.
- **Legacy Support**: The parser should switch modes based on the `protocolVersion` received in `svc_serverdata`.
