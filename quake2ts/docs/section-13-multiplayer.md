# Section 13: Multiplayer & Network Support

## Overview
This section covers the transition from a local-only "listen server" architecture to a true Client-Server model, enabling multiplayer support over the network.

Following the **Quake II Rerelease** architecture, we will split the engine into distinct `Server` and `Client` components. The Client will utilize a `cgame` module for prediction and rendering, while the Server will run the authoritative game logic.

**Current Status:** Server architecture and protocol foundations are approximately **45% complete**. The dedicated server framework exists and can run game logic. **Client-server networking basics are implemented**, including handshake and command sending, but reliability features and client-side prediction are still missing.

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
  - [x] Create `NetDriver` interface.
  - [x] Implement `WebSocketNetDriver` for Node.js (Server).
  - [x] **`BrowserWebSocketNetDriver` created and used** - Instantiated in `MultiplayerConnection`.

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
- ⚠️ **Frame Steps** (partial implementation with TODOs):
  1. **`SV_ReadPackets()`**: Poll `NetDriver` for incoming packets. (Packet queue implemented).
  2. **`SV_RunGameFrame()`**:
     - For each active client: Call `ge->ClientThink(edict, &usercmd)` with oldest unprocessed command.
     - Call `ge->G_RunFrame()` to advance game simulation (physics, AI, triggers).
     - Increment `sv.framenum`.
  3. **`SV_SendClientMessages()`**:
     - For each client: Build `svc_frame` with delta-compressed entity snapshot.
     - Call `SV_WriteFrameToClient()` (uses `writeDeltaEntity`).
     - Send via `client.netchan.Transmit()`.
     - [ ] **TODO (line 326):** "Disconnect client after delay?" - Timeout handling incomplete
     - [ ] **TODO (line 396):** "Handle reliable messaging properly" - Currently sends immediately without proper queuing
     - [ ] **TODO (line 459):** "Process command queue, apply rate limiting" - Command rate limiting not implemented
     - [ ] **TODO (line 650):** "Differentiate between reliable and unreliable stream" - Message type separation incomplete
  4. **Rate Limiting**: Enforce server tickrate (10Hz/20Hz). Sleep remainder of frame time if processing finishes early.
     - [x] Implemented drift-correcting loop in `DedicatedServer.runFrame`.
     - ⚠️ Tested with mocked integration tests (not true network tests) in `tests/dedicated.test.ts`.

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
- [x] **Basic Implementation**: Exists in `packages/server/src/protocol/entity.ts` (Vanilla fields only).
- [ ] **Rerelease Fields Not Written**: `writeDeltaEntity` does not serialize `alpha`, `scale`, `instanceBits`, `loopVolume`, `loopAttenuation`, `owner`, or `oldFrame` fields. Server cannot send Rerelease entity state.
- [x] **Baseline Management**: Initial `writeDeltaEntity` logic implemented for frame snapshots.
- [x] **Baseline Population**: Populate `sv.baselines` from game entities (static or initial state).
- [x] **Removal**: If entity removed since last frame, send entity number with special "remove" flag.
- [x] **Overflow Handling**: Handle MTU limits.
  - Implemented check in `SV_SendClientFrame` to stop writing entities/removals if 1400 byte limit is reached.

#### 2.5 Game Module Interface (`game_export_t`)
- [x] **Game Stats**: `ps.stats` population implemented in `packages/game/src/entities/playerStats.ts`.
- [x] **Config Strings**: Add `configstring(index, value)` to `GameImports` so game can set strings (models, sounds).
- [x] **Sound/FX**: `multicast` / `unicast` implemented.
- [x] **Player State**: Added missing fields (`pm_time`, `gun_frame`, `rdflags`, `fov`) to `PlayerClient`, `GameStateSnapshot`, and `PlayerState` to ensure correct network synchronization.

### Phase 3: Client Refactoring (CGame)

#### 3.1 Create CGame Package Structure
- [x] **Package Setup**: Created `packages/cgame`.
- [x] **HUD Migration**: Moved all HUD code (`hud/*.ts`, `screen.ts`) to `cgame`.
- ⚠️ **View/Prediction**: Moved `view/camera.ts`, `view/effects.ts`, `prediction/index.ts` to `cgame` - **BUT prediction is not implemented**.

#### 3.2 Define CGame Interfaces
- [x] **cgame_import_t**: Defined in `packages/cgame/src/types.ts`.
- ⚠️ **cgame_export_t**: Defined in `packages/cgame/src/types.ts` - **Multiple functions are placeholder stubs**.

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
- [ ] **Client-Side Prediction** - **NOT IMPLEMENTED** (see Known Gaps)

### Phase 4: Integration & Testing

#### 4.1 Localhost Server-Client Test
- ⚠️ **Config String Sync**: `packages/server/tests/integration/configstring_sync.test.ts` - **NOT a true integration test**. Uses extensive mocking (WebSocket, file system, BSP parser). No actual client connects.
- ⚠️ **Icon Sync**: Tested in same mocked test file - **NOT validated with real network connection**.

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
- [x] **Network Messaging**: Implemented `multicast` and `unicast` in `DedicatedServer` with robust argument serialization for `ServerCommand`s (`centerprint`, `stufftext`, `sound`).
- [x] **Entity Delta Compression**: Implemented baseline population and entity removal logic in `DedicatedServer`.
- [x] **Rate Limiting**: Implemented drift-correcting 10Hz loop in `DedicatedServer` and verified with integration tests.
- [x] **MTU Handling**: Implemented logic to prevent packet overflow by capping entities in `SV_SendClientFrame`.
- [x] **Player State Completeness**: Added `pm_type`, `pm_time`, `pm_flags`, `gun_frame`, `rdflags`, and `fov` to `PlayerState` and wired them through from `PlayerClient` to `DedicatedServer` output.
- [x] **Client-Server Connection**: Implemented basic WebSocket connection, handshake, and `clc_move` command sending in `packages/client`.

## Known Gaps and Required Work

### Critical Issues (Blocks Multiplayer Functionality)

1. **Client-Side Prediction Not Implemented** (`packages/cgame/src/index.ts:113-116`)
   ```typescript
   function Pmove(pmove: unknown): void {
       // TODO: Implement client-side movement prediction
       // Should call shared Pmove() function
   }
   ```
   - Core multiplayer feature for smooth gameplay
   - Without this, multiplayer would have severe input lag
   - **Impact:** Unplayable multiplayer experience even if connection worked

2. **CGame Stubs - Multiple Weapon/UI Functions** (`packages/cgame/src/index.ts:89-111`)
   - `GetActiveWeaponWheelWeapon` - returns 0
   - `GetOwnedWeaponWheelWeapons` - returns []
   - `GetWeaponWheelAmmoCount` - returns 0
   - `GetPowerupWheelCount` - returns 0
   - `GetHitMarkerDamage` - returns 0
   - **Impact:** Weapon wheel and hit markers non-functional in multiplayer

3. **Server Incomplete Features** (`packages/server/src/dedicated.ts`)
   - **Line 326:** Client timeout/disconnect handling not implemented
   - **Line 396:** Reliable messaging not properly queued (sent immediately)
   - **Line 459:** Command rate limiting not implemented
   - **Line 650:** Reliable/unreliable stream separation incomplete
   - **Impact:** Unreliable network behavior, potential exploits, poor performance

4. **Incomplete Protocol Reliability**
    - `clc_move` packets are sent with placeholder sequence numbers (0) and checksums (0).
    - No packet loss detection or retransmission logic (NetChan) over WebSocket.

5. **Rerelease Protocol Incomplete on Both Ends**
   - **Server:** `writeDeltaEntity` doesn't write Rerelease fields (alpha, scale, etc.)
   - **Client:** `parseDelta` doesn't read Rerelease fields (see Section 12)
   - **Impact:** Cannot support Rerelease features even if protocol version negotiated

### Testing Gaps

1. **No True Integration Tests**
   - All "integration" tests use extensive mocking
   - No actual WebSocket communication tested
   - No end-to-end client-server connection tested
   - **Cannot verify multiplayer actually works**

2. **Missing Test Scenarios**
   - Client connects to server
   - Client sends user commands
   - Server sends entity updates
   - Client interpolates entities
   - Client predicts movement
   - Multiple clients interact

## Subtasks to Complete Multiplayer

### Phase 1: Implement Client-Server Connection (Critical)
**Priority: HIGHEST** - Nothing works without this

**Location:** `packages/client/src/network/`

1. [x] **Create Network Manager** (`client/src/network/connection.ts`)
   ```typescript
   class MultiplayerConnection {
       private driver: BrowserWebSocketNetDriver;
       private parser: NetworkMessageParser;

       async connect(serverAddress: string): Promise<void>
       disconnect(): void
       sendCommand(cmd: UserCommand): void
       private handleServerMessage(data: Uint8Array): void
   }
   ```

2. [x] **Add Connection UI** (`client/src/ui/multiplayer-menu.ts`)
   - Server address input field
   - Connect/Disconnect button
   - Connection status display
   - Player name/config input

3. [x] **Implement Connection Handshake** (`connection.ts`)
   - Send `clc_stringcmd("connect")` with userinfo
   - Handle `svc_serverdata` response
   - Receive and process all `svc_configstring` commands
   - Receive and process all `svc_spawnbaseline` commands
   - Send `clc_stringcmd("begin")` when ready
   - Transition to active gameplay state

4. [x] **Wire Up to Game Loop**
   - Integrate `MultiplayerConnection` into main client
   - Process incoming packets each frame
   - Send user commands at appropriate rate
   - Handle connection loss/timeout

### Phase 2: Implement Client-Side Prediction (Critical)
**Priority: HIGH** - Required for playable multiplayer

**Location:** `packages/cgame/src/index.ts`

1. [x] **Implement Pmove Function** (lines 113-116)
   - Import shared `Pmove()` from `@quake2ts/shared`
   - Set up `pmove_t` structure from `PlayerState`
   - Call shared physics simulation
   - Apply results to local player state
   - Store command history for server reconciliation

2. **Add Command Buffering**
   - Buffer last 64 user commands (CMD_BACKUP)
   - Associate each command with frame number
   - Use for prediction rewind/replay

3. **Implement Prediction Correction**
   - When server snapshot arrives, compare to predicted state
   - If mismatch detected, rewind to server state
   - Replay buffered commands from that point forward
   - Smooth correction over multiple frames if error is small

4. **Add Prediction Variables**
   - `cg_predict` cvar to enable/disable prediction
   - `cg_showmiss` cvar to debug prediction errors
   - Track prediction error magnitude for debugging

### Phase 3: Complete Server Features

**Location:** `packages/server/src/dedicated.ts`

1. **Implement Reliable Messaging** (line 396)
   - Create reliable message queue per client
   - Track which messages have been acknowledged
   - Retransmit unacknowledged messages
   - Implement acknowledgment system

2. **Implement Command Rate Limiting** (line 459)
   - Process command queue instead of oldest command only
   - Apply configurable rate limit (sv_maxrate)
   - Drop excessive commands from suspicious clients
   - Log rate violations

3. **Implement Client Timeout** (line 326)
   - Track last packet time per client
   - Disconnect clients that haven't sent packets in 30+ seconds
   - Send timeout warning before disconnect
   - Clean up client state on timeout

4. **Separate Reliable/Unreliable Streams** (line 650)
   - Maintain two message buffers per client
   - Reliable: Configstrings, critical events
   - Unreliable: Entity updates, temp entities
   - Send reliable messages with acknowledgment
   - Send unreliable messages without acknowledgment

### Phase 4: Implement Rerelease Protocol Support

**Location:** `packages/server/src/protocol/entity.ts` and `packages/engine/src/demo/parser.ts`

1. **Server: Add Rerelease Entity Writing**
   - Define Rerelease bit flags (U_SCALE, U_INSTANCE_BITS, etc.)
   - Update `writeDeltaEntity` to write new fields when flags set
   - Match bit positions to reference source
   - Test that written stream matches expected format

2. **Client: Add Rerelease Entity Parsing**
   - See Section 12 subtasks (this is the same work)
   - Ensure client and server use identical bit flag definitions

3. **Negotiate Protocol Version**
   - Server sends protocol version in `svc_serverdata`
   - Client accepts or rejects based on supported versions
   - Both sides switch to appropriate parsing mode

### Phase 5: Complete CGame Stubs

**Location:** `packages/cgame/src/index.ts` (lines 89-111)

1. **Implement Weapon Wheel Functions**
   - `GetActiveWeaponWheelWeapon`: Return current active weapon from player state
   - `GetOwnedWeaponWheelWeapons`: Query player inventory for owned weapons
   - `GetWeaponWheelAmmoCount`: Return ammo count for specified weapon

2. **Implement Powerup Functions**
   - `GetPowerupWheelCount`: Return count of active powerups from player stats

3. **Implement Hit Marker**
   - `GetHitMarkerDamage`: Track recent damage events, return for UI display
   - Add damage event tracking system
   - Expire hit markers after short duration

### Phase 6: True Integration Testing

**Location:** `packages/e2e-tests/` (create new package)

1. **Set Up E2E Test Infrastructure**
   - Create dedicated test package
   - Use Playwright or Puppeteer for browser automation
   - Start real dedicated server on test port
   - Launch headless browser client

2. **Write E2E Test: Basic Connection**
   ```typescript
   test('client connects to server', async () => {
       const server = await startDedicatedServer();
       const client = await launchClient();
       await client.connect('localhost:27910');
       expect(await client.isConnected()).toBe(true);
       await client.disconnect();
       await server.stop();
   });
   ```

3. **Write E2E Test: Entity Synchronization**
   - Spawn entity on server
   - Verify client receives entity in snapshot
   - Move entity on server
   - Verify client sees updated position

4. **Write E2E Test: User Commands**
   - Client sends movement commands
   - Server processes commands
   - Verify player entity moves on server
   - Verify client receives updated player state

5. **Write E2E Test: Multi-Client**
   - Connect two clients to same server
   - Each client sees the other's entity
   - Movement/shooting visible to both clients

### Phase 7: Polish and Optimization

1. **Add Client Interpolation**
   - Buffer last 2-3 server snapshots
   - Interpolate entity positions between snapshots
   - Result in smooth 60fps rendering from 10Hz server updates

2. **Add Network Statistics UI**
   - Display ping (round-trip time)
   - Display packet loss percentage
   - Display prediction errors
   - Display bandwidth usage

3. **Optimize Bandwidth**
   - Implement PVS (Potentially Visible Set) filtering
   - Only send entities visible to each client
   - Reduce update rate for distant entities
   - Compress configstrings and baselines

4. **Add Cheat Protection**
   - Validate all client commands on server
   - Clamp movement speed to legal values
   - Verify weapon fire rate limits
   - Log suspicious behavior

## Next Steps Summary
**To achieve working multiplayer, complete phases in order:**
1. Phase 1 (Client-Server Connection) - **BLOCKS EVERYTHING**
2. Phase 2 (Client-Side Prediction) - **REQUIRED FOR PLAYABLE EXPERIENCE**
3. Phase 3 (Server Features) - **REQUIRED FOR RELIABILITY**
4. Phase 6 (Integration Testing) - **REQUIRED TO VERIFY IT WORKS**
5. Phase 4 (Rerelease Protocol) - Optional for vanilla MP, required for Rerelease
6. Phase 5 (CGame Stubs) - Optional, improves UX
7. Phase 7 (Polish) - Optional, improves experience
