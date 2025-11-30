# Section 12: Demo Playback

## Overview
This section covers the implementation of Quake II demo (`.dm2`) playback in the browser. The goal is to parse and render standard Quake II demo files, which record the server-to-client network stream. This involves implementing a strict parser for the Quake II network protocol (`svc_*` commands), a demo file container reader, and a playback controller that feeds these messages into the engine's state machine, simulating a live connection.

**Current Status:** The system partially implements Vanilla Quake II (v3.20) demo playback. Support for "Quake II Rerelease" (Protocol 2023) demos is currently missing and requires significant updates to the protocol layer.

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

## Protocol Gaps (Rerelease / Protocol 2023)

To support modern "Rerelease" demos and servers, the following extensions must be implemented.

### 1. Protocol Version
- **Current:** Supports Protocol 34 (Vanilla).
- **Target:** Must default to Protocol 2023 (Rerelease), while maintaining legacy support for Protocol 34.

### 2. Missing Server Commands (`svc_*`)
The following Rerelease commands are missing from `packages/shared/src/protocol/ops.ts` and `packages/engine/src/demo/parser.ts`:
- [ ] `svc_splitclient`
- [ ] `svc_configblast` (Compressed configstrings)
- [ ] `svc_spawnbaselineblast` (Compressed baselines)
- [ ] `svc_level_restart`
- [ ] `svc_damage` (Damage indicators)
- [ ] `svc_locprint` (Localized print)
- [ ] `svc_fog` (Fog settings)
- [ ] `svc_waitingforplayers`
- [ ] `svc_bot_chat`
- [ ] `svc_poi` (Point of Interest)
- [ ] `svc_help_path`
- [ ] `svc_muzzleflash3` (Muzzleflash with short ID)
- [ ] `svc_achievement`

### 3. Entity State Extensions
The `EntityState` interface in `packages/shared/src/protocol/entityState.ts` is missing Rerelease fields:
- [ ] `alpha` (float)
- [ ] `scale` (float)
- [ ] `instance_bits` (visibility masks)
- [ ] `loop_volume`, `loop_attenuation`
- [ ] `owner` (for client-side prediction skipping)
- [ ] `old_frame` (for custom interpolation)

### 4. Player State Extensions
The `PlayerState` interface in `packages/shared/src/protocol/player-state.ts` is missing:
- [ ] `gunskin`, `gunrate`
- [ ] `damage_blend` (rgba)
- [ ] `team_id`

## Tasks Remaining

### 1. Protocol Audit & Upgrade
- [ ] **Refactor `NetworkMessageParser`**:
    - [ ] Update `parseFrame` to handle the "atomic frame" concept correctly (reading packet entities immediately within the frame command if the protocol dictates, or verifying the Vanilla split behavior).
    - [ ] Add support for detecting Protocol 2023 in `parseServerData`.
    - [ ] Implement parsers for all missing Rerelease `svc_*` commands.
- [ ] **Update Shared Types**:
    - [ ] Update `EntityState` and `PlayerState` interfaces to include Rerelease fields.
    - [ ] Update `ServerCommand` enum with new opcodes.

### 2. Client Integration
- [ ] **Demo Playback**: Ensure `DemoPlaybackController` can handle the potentially larger Rerelease frames.
- [ ] **Entity Interpolation**: Update `packages/client` to respect new fields like `scale` and `alpha` during rendering.

### 3. Testing
- [ ] **Regression Test**: Verify Vanilla `.dm2` files still play back correctly.
- [ ] **New Feature Test**: Acquire and test against a Rerelease `.dm2` file (Protocol 2023).

## Implementation Notes
- **Reference**: Use `rerelease/client/cl_parse.cpp` as the source of truth for the Rerelease protocol.
- **Legacy Support**: The parser should switch modes based on the `protocolVersion` received in `svc_serverdata`.
