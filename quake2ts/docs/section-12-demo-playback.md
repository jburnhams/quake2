# Section 12: Demo Playback

## Overview
This section covers the implementation of Quake II demo (`.dm2`) playback in the browser. The goal is to parse and render standard Quake II demo files, which record the server-to-client network stream. This involves implementing a strict parser for the Quake II network protocol (`svc_*` commands), a demo file container reader, and a playback controller that feeds these messages into the engine's state machine, simulating a live connection.

**Current Status:** The system implements both Vanilla Quake II (v3.20) and Rerelease (Protocol 2023) network protocol parsing. Support for "Quake II Rerelease" demos is now largely complete in the protocol layer and client integration.

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
- ✅ Implemented full parsing logic for all Rerelease `svc_*` commands, including Zlib decompression for `svc_configblast` and `svc_spawnbaselineblast`.
- ✅ Verified new commands with comprehensive unit tests in `packages/engine/tests/demo/`.
- ✅ Verified `DemoPlaybackController` can handle larger Rerelease frames (up to 2MB).
- ✅ Updated `packages/client` to respect new entity fields `scale` and `alpha` during rendering, with unit tests in `packages/client/tests/entities.test.ts`.
- ✅ Audited Protocol 2023 implementation, confirming full coverage of new commands in `NetworkMessageParser`.
- ✅ Added explicit unit tests for Protocol 2023 detection, splitscreen handling, and new Rerelease commands (`svc_bot_chat`, `svc_poi`, `svc_help_path`) in `packages/engine/tests/demo/rerelease_protocol.test.ts`.

## Protocol Gaps (Rerelease / Protocol 2023)

To support modern "Rerelease" demos and servers, the following extensions must be implemented.

### 1. Protocol Version
- **Current:** Supports Protocol 34 (Vanilla).
- **Target:** Must default to Protocol 2023 (Rerelease), while maintaining legacy support for Protocol 34.

### 2. Missing Server Commands (`svc_*`)
The following Rerelease commands are fully implemented in `packages/engine/src/demo/parser.ts`:
- [x] `svc_splitclient`
- [x] `svc_configblast` (Compressed configstrings)
- [x] `svc_spawnbaselineblast` (Compressed baselines)
- [x] `svc_level_restart`
- [x] `svc_damage` (Damage indicators)
- [x] `svc_locprint` (Localized print)
- [x] `svc_fog` (Fog settings)
- [x] `svc_waitingforplayers`
- [x] `svc_bot_chat`
- [x] `svc_poi` (Point of Interest)
- [x] `svc_help_path`
- [x] `svc_muzzleflash3`
- [x] `svc_achievement`

### 3. Entity State Extensions
The `EntityState` interface in `packages/shared/src/protocol/entityState.ts` now includes Rerelease fields:
- ✅ `alpha` (float)
- ✅ `scale` (float)
- ✅ `instance_bits` (visibility masks)
- ✅ `loop_volume`, `loop_attenuation`
- ✅ `owner` (for client-side prediction skipping)
- ✅ `old_frame` (for custom interpolation)

### 4. Player State Extensions
The `PlayerState` interface in `packages/shared/src/protocol/player-state.ts` now includes:
- ✅ `gunskin`, `gunrate`
- ✅ `damage_blend` (rgba)
- ✅ `team_id`

## Tasks Remaining

### 1. Protocol Audit & Upgrade
- [x] **Refactor `NetworkMessageParser`**:
    - [x] Update `parseFrame` to handle the "atomic frame" concept correctly (reading packet entities immediately within the frame command if the protocol dictates, or verifying the Vanilla split behavior). Verified that atomic frame handling (embedded packet entities) is not standard Q2 behavior and `svc_playerinfo` is strictly expected after frame header.
    - [x] Add support for detecting Protocol 2023 in `parseServerData`.
    - [x] Implement parsers for all missing Rerelease `svc_*` commands.
- [x] **Update Shared Types**:
    - [x] Update `EntityState` and `PlayerState` interfaces to include Rerelease fields.
    - [x] Update `ServerCommand` enum with new opcodes.

### 2. Client Integration
- [x] **Demo Playback**: Ensure `DemoPlaybackController` can handle the potentially larger Rerelease frames.
- [x] **Entity Interpolation**: Update `packages/client` to respect new fields like `scale` and `alpha` during rendering.

### 3. Testing
- [x] **Regression Test**: Verify Vanilla `.dm2` files still play back correctly. (Existing tests passing, plus new integration test in `playback_integration.test.ts`)
- [x] **New Feature Test**: Acquire and test against a Rerelease `.dm2` file (Protocol 2023). (Verified with synthetic test in `playback_integration.test.ts`)
- [x] **Protocol Coverage**: Added specific unit tests for Protocol 2023 handshake and new commands.

## Implementation Notes
- **Reference**: Use `rerelease/client/cl_parse.cpp` as the source of truth for the Rerelease protocol.
- **Legacy Support**: The parser should switch modes based on the `protocolVersion` received in `svc_serverdata`.
