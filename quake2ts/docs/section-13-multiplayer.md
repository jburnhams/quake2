# Section 13: Multiplayer & Network Support

## Overview
This section covers the transition from a local-only "listen server" architecture to a true Client-Server model, enabling multiplayer support over the network.

Following the **Quake II Rerelease** architecture, we will split the engine into distinct `Server` and `Client` components. The Client will utilize a `cgame` module for prediction and rendering, while the Server will run the authoritative game logic.

## Architecture

### 1. Networking Transport (WebSockets)
Since this is a browser-based port, we will replace the original UDP `netchan_t` with **WebSockets**.
- **Server**: Node.js `WebSocketServer` (using `ws` library).
- **Client**: Browser native `WebSocket` API.
- **Abstraction**: A `NetDriver` interface will abstract the transport layer, allowing the engine to remain agnostic to the underlying protocol (future proofing for WebTransport).

### 2. Protocol (Binary Compatibility)
We will implement the original Quake II network protocol (`svc_*` and `clc_*` commands) defined in `qcommon.h`.
- **Reasoning**: Ensures compatibility with existing demo formats (Section 12) and potential future interoperability with legacy servers (via proxy).
- **Serialization**: Implement `MSG_Write*` functions (mirroring `qcommon/msg.c`) to construct binary packets.
- **Deserialization**: Reuse and extend the `NetworkMessageParser` from Section 12.

### 3. Server Architecture (`packages/server`)
A new package will be created to host the dedicated server.
- **Headless**: The server must run without any dependency on the DOM, Canvas, or WebGL.
- **Game API**: It will load the `Game` module and interact via the `game_export_t` / `game_import_t` interface.
- **Loop**: A fixed-timestep loop (10Hz or 20Hz default) running `SV_Frame`.
- **State**: Manages `svs` (Server Static) and `sv` (Server Level) states, including clients, entities, and challenges.

### 4. Client Architecture (`packages/client`)
The client will be refactored to support the **Rerelease `cgame` Architecture**.
- **CGame Module**: Extract rendering and prediction logic into a `cgame` module (`cg_main.cpp` equivalent).
- **Prediction**: Implement `CL_PredictMovement` using `cglobals.Pmove` to simulate movement ahead of server updates.
- **Interpolation**: Buffer server snapshots (`svc_frame`) and interpolate entities for smooth rendering.
- **Transport**: Connects to the server via `NetDriver` and feeds packets to the parser.

## Implementation Tasks

### Phase 1: Network Plumbing
- [x] **Protocol Definitions**: Ensure `packages/shared/src/protocol` contains all `svc_` and `clc_` enums.
- [x] **Message Builder**: Implement `NetworkMessageBuilder` (Writer) to complement the existing `NetworkMessageParser` (Reader).
  - Support `WriteByte`, `WriteShort`, `WriteLong`, `WriteFloat`, `WriteString`, `WriteDir`, `WriteAngle`.
- [x] **Transport Layer**:
  - Create `NetDriver` interface.
  - Implement `WebSocketNetDriver` for Node.js (Server).
  - Implement `BrowserWebSocketNetDriver` for Client.

### Phase 2: The Dedicated Server

**Background**: The server (`packages/server`) is headless, runs the authoritative game simulation, and sends periodic snapshots to clients. It must work in Node.js without DOM/Canvas/WebGL dependencies.

#### 2.1 Server Architecture (Reference: original `server/sv_*.c`)
- [x] **Package Setup**: `packages/server` created with basic structure.
- [x] **Server State**: Define core structures (TypeScript equivalents):
  - `server_static_t` (`svs`): Global server state - port, client array, challenge list, etc.
  - `server_t` (`sv`): Per-level state - map name, BSP data, entity baselines, configstrings.
  - `client_t`: Per-client state - connection state, reliable/unreliable messages, last frame acked, user info, name, rate.

#### 2.2 Server Main Loop (`SV_Frame`)
- [x] **Frame Structure**: Basic loop exists in `packages/server/src/dedicated.ts`.
- [x] **Frame Steps**:
  1. **`SV_ReadPackets()`**: Poll `NetDriver` for incoming packets. (Packet queue implemented).
  2. **`SV_RunGameFrame()`**:
     - For each active client: Call `ge->ClientThink(edict, &usercmd)` with oldest unprocessed command.
     - Call `ge->G_RunFrame()` to advance game simulation (physics, AI, triggers).
     - Increment `sv.framenum`.
  3. **`SV_SendClientMessages()`**:
     - For each client: Build `svc_frame` with delta-compressed entity snapshot.
     - Call `SV_WriteFrameToClient()` (uses `writeDeltaEntity`).
     - Send via `client.netchan.Transmit()`.
  4. **Rate Limiting**: Enforce server tickrate (10Hz/20Hz). Sleep remainder of frame time if processing finishes early.

#### 2.3 Client Connection Handshake
- [x] **Challenge System**: Basic implementation exists.
- [x] **Connection Flow** (verify/complete):
  1. Client sends `clc_stringcmd("connect")` with userinfo (name, model, skin, etc.).
  2. Server validates, calls `ge->ClientConnect(edict, userinfo)` (game can reject).
  3. Server responds with `svc_serverdata` (protocol version, server frame, map name, player slot).
  4. **Config Strings**: Server sends all configstrings (`svc_configstring` for CS_NAME, CS_MODELS[], CS_SOUNDS[], etc.).
  5. **Baselines**: Server sends spawn baselines (`svc_spawnbaseline`) for all entities.
  6. Server sends `svc_stufftext("precache\n")`.
  7. Client responds with `clc_stringcmd("begin")` when ready.
  8. Server calls `ge->ClientBegin(edict)`.

#### 2.4 Delta Compression (`MSG_WriteDeltaEntity`)
- [x] **Basic Implementation**: Exists in `packages/server/src/protocol/entity.ts`.
- [x] **Baseline Management**: Initial `writeDeltaEntity` logic implemented for frame snapshots.
- [x] **Baseline Population**: Populate `sv.baselines` from game entities (static or initial state).
- [x] **Removal**: If entity removed since last frame, send entity number with special "remove" flag.
- [ ] **Overflow Handling**: Handle MTU limits.

#### 2.5 Game Module Interface (`game_export_t`)
- [x] **Game Stats**: `ps.stats` population implemented in `packages/game/src/entities/playerStats.ts`.
- [x] **Config Strings**: Add `configstring(index, value)` to `GameImports` so game can set strings (models, sounds).
- [x] **Sound/FX**: `multicast` / `unicast` implemented.

### Phase 3: Client Refactoring (CGame)

#### 3.1 Create CGame Package Structure
- [x] **Package Setup**: Created `packages/cgame`.
- [x] **HUD Migration**: Moved all HUD code (`hud/*.ts`, `screen.ts`) to `cgame`.
- [x] **View/Prediction**: Moved `view/camera.ts`, `view/effects.ts`, `prediction/index.ts` to `cgame`.

#### 3.2 Define CGame Interfaces
- [x] **cgame_import_t**: Defined in `packages/cgame/src/types.ts`.
- [x] **cgame_export_t**: Defined in `packages/cgame/src/types.ts`.

#### 3.3 Move Shared Code (`packages/shared`)
- [x] **Stats**: Added `PlayerStat` enums and helpers (`G_SetAmmoStat`).
- [x] **Items**: Moved `WeaponId`, `AmmoType` to shared.

#### 3.4 Migrate Client Code to CGame
- [x] **HUD System**: Fully migrated to `cgame/src/hud`.
- [x] **Stat Reading**: Updated HUD to read `ps.stats` array.
- [x] **Asset Precaching**: Implemented `CG_TouchPics`.
- [x] **Parsing**:
  - [x] **Config String Parsing**: Implement `ParseConfigString(i, s)` in `cgame`.
  - [x] **Centerprint**: Implement `ParseCenterPrint` in `cgame`.
  - [x] **Notify/Chat**: Implement `NotifyMessage` in `cgame`.
  - [x] **StuffText**: Implement `svc_stufftext` handling in Client (redirects to console commands).

### Phase 4: Integration & Testing

#### 4.1 Localhost Server-Client Test
- [x] **Config String Sync**: Verify server sends strings, client receives and updates registries.
  - Verified by `packages/server/tests/integration/configstring_sync.test.ts`.
- [x] **Icon Sync**: Verify `STAT_*_ICON` works (requires correct config strings).
  - Verified by `packages/server/tests/integration/configstring_sync.test.ts`.

## Progress Update
- [x] **HUD Migration Complete**: `packages/cgame` is fully populated and builds. Client-CGame bridge is wired.
- [x] **Server Stats**: `packages/game` populates `PlayerState.stats` with health, armor, ammo, and active powerups.
- [x] **Protocol**: `MSG_WriteDeltaEntity` implemented and used by server.
- [x] **Server Config Strings**: Implemented `configstring` in `GameImports` and `DedicatedServer`. Server now broadcasts config string updates and sends full list on client connect.
- [x] **Client Parsing**: Implemented `ParseConfigString`, `ParseCenterPrint`, `NotifyMessage`, and `svc_stufftext` handling. Wired up via `ClientExports`.
- [x] **HUD Rendering**: Client now delegates main HUD rendering to `cg.DrawHUD`, including status bar via `ps.stats`.
- [x] **Integration Test**: Added `configstring_sync.test.ts` to verify config string and stats synchronization.
- [x] **Subtitles**: Moved subtitle logic to `CGame` and exposed via `ShowSubtitle`.
- [x] **CGame Refinements**: Fully implemented `cvar` registration in `CGameImport` bridge.
- [x] **Network Messaging**: Implemented `multicast` and `unicast` in `DedicatedServer` with robust argument serialization for `ServerCommand`s.
- [x] **Entity Delta Compression**: Implemented baseline population and entity removal logic in `DedicatedServer`.

## Next Steps
1.  **Full Networking**:
    - Continue testing and refining the dedicated server implementation.
    - Verify entity interpolation and delta compression in a real networked scenario.
    - Implement MTU overflow handling.
