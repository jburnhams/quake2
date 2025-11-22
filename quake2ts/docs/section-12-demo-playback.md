# Section 12: Demo Playback

## Overview
This section covers the implementation of Quake II demo (`.dm2`) playback in the browser. The goal is to parse and render standard Quake II demo files, which record the server-to-client network stream. This involves implementing a strict parser for the Quake II network protocol (`svc_*` commands), a demo file container reader, and a playback controller that feeds these messages into the engine's state machine, simulating a live connection.

## Dependencies
- **Shared Protocol**: Requires complete definition of `svc_ops_e` and `clc_ops_e` opcodes and their packet structures (currently missing).
- **Network Message Parser**: A robust bit/byte stream reader to parse the sequential network messages.
- **Client State**: Access to the client's entity and resource state to apply updates from the demo stream.

## Work Already Done
- ✅ Basic bitstream reading capabilities in `packages/shared` (used for BSP/Map parsing, can be adapted).
- ✅ Entity system and renderer capable of displaying the game state.
- ✅ Defined `ServerCommand` (`svc_*`) and `ClientCommand` (`clc_*`) enums in `packages/shared/src/protocol/ops.ts`.
- ✅ Implemented `NetworkMessageParser` in `packages/engine/src/demo/parser.ts` covering all standard `svc_` commands.
- ✅ Implemented `DemoReader` in `packages/engine/src/demo/demoReader.ts` for `.dm2` container format.
- ✅ Implemented `DemoPlaybackController` in `packages/engine/src/demo/playback.ts` for timing and loop control.
- ✅ Exposed `DemoPlaybackController` in `packages/client` exports.

## Tasks Remaining

### 1. Protocol Definition & Parsers (`packages/shared/src/protocol`)
- [x] Define `ServerCommand` enum (`svc_*`) matching original `qcommon.h`.
- [x] Define `ClientCommand` enum (`clc_*`) for completeness (though primarily reading `svc_` for playback).
- [x] Implement typed parsers for each server command:
  - `svc_serverdata`: Protocol version, server count, game dir, player num, map name.
  - `svc_configstring`: Updates to model/sound/image indices.
  - `svc_spawnbaseline`: Baseline entity states.
  - `svc_frame`: Delta compressed frame data (player state, packet entities).
  - `svc_stufftext`, `svc_print`, `svc_centerprint`: Text messages.
  - `svc_sound`: Spatialized audio events.
  - `svc_temp_entity`: Temporary visual effects (particles, lights).
  - `svc_muzzleflash`: Weapon firing effects.
  - `svc_layout`, `svc_inventory`: HUD and inventory updates.
  - `svc_disconnect`, `svc_reconnect`: Connection state management.

### 2. Demo File Container (`packages/engine/src/demo`)
- [x] Implement `DemoReader` class to handle the `.dm2` file structure.
  - Format: Sequence of `[Length (4 bytes)] + [Message Block (Length bytes)]`.
  - Support async streaming or buffered reading of the demo file (ArrayBuffer).
  - Error handling for truncated or corrupt blocks.

### 3. Playback System (`packages/engine/src/demo`)
- [x] Create `DemoPlaybackController`.
  - Maintains playback state: `Paused`, `Playing`, `Finished`.
  - Handles the "read loop":
    1. Read next block length.
    2. Read block data.
    3. Dispatch to `NetworkMessageParser` (simulating `CL_ParseServerMessage`).
  - **Timing Control**:
    - Demos record *server frames*. We must interpolate between them for smooth 60fps+ rendering.
    - Implement a virtual clock that advances based on demo frames (usually 10Hz) vs real time.
    - Support playback speed control (0.5x, 1x, 2x, Max).

### 4. Client Integration (`packages/client`)
- [ ] Abstract the "Network Source" in the client.
  - Current client likely pulls from a simulated local server or future WebSocket.
  - Interface `NetworkSource` should support both "Live Connection" and "Demo Stream".
- [ ] Hook up `DemoPlaybackController` as a `NetworkSource`.
- [ ] Ensure `CL_ParseServerMessage` logic (or its TypeScript equivalent) effectively handles the parsed packets to update:
  - `cl.configstrings`
  - `cl.entities` (via delta decompression against baselines)
  - `cl.lightstyles`
  - `cl.sound_precache`

### 5. UI & Controls
- [ ] Add `playdemo <filename>` console command.
- [ ] (Optional) Simple on-screen playback controls (Play/Pause/Stop/Scrub).

## Testing Requirements

### Unit Tests
- **Packet Parsers**: Verify each `svc_` parser correctly reads known binary sequences (captured from original game or manually constructed).
- **Demo Reader**: Test reading a file with multiple blocks, ensuring strict sequential ordering.

### Integration Tests
- **Playback Loop**: Load a small, known `.dm2` file and verify:
  - Correct map is loaded (via `svc_serverdata`).
  - Entities spawn and move (via `svc_frame` and `svc_packetentities`).
  - Configstrings are populated.

## Implementation Notes
- **Delta Compression**: The most complex part is `svc_packetentities`. It relies on a history of past frames to decompress the current one. The demo playback must maintain this frame history buffer (typically 32-64 frames) just like a real client.
- **Reference Source**: Consult `cl_parse.c` in the original source heavily for the binary format of each message.
- **Performance**: Parsing must happen efficiently every frame. Avoid excessive object allocation in the hot loop (e.g., reuse packet objects).
