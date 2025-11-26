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
- [ ] **Server State**: Define core structures (TypeScript equivalents):
  - `server_static_t` (`svs`): Global server state - port, client array, challenge list, etc.
  - `server_t` (`sv`): Per-level state - map name, BSP data, entity baselines, configstrings.
  - `client_t`: Per-client state - connection state, reliable/unreliable messages, last frame acked, user info, name, rate.
  - Reference `server/server.h` for full structure definitions.

#### 2.2 Server Main Loop (`SV_Frame`)
- [x] **Frame Structure**: Basic loop exists in `packages/server/src/dedicated.ts`.
- [ ] **Frame Steps** (enhance existing loop):
  1. **`SV_ReadPackets()`**: Poll `NetDriver` for incoming packets.
     - Parse `clc_*` messages (stringcmd, move, userinfo, etc.).
     - Update `client_t.lastmessage` timestamp (for timeout detection).
     - Process `clc_move`: Extract `usercmd_t`, store in client command buffer for `ge->ClientThink()`.
  2. **`SV_RunGameFrame()`**:
     - For each active client: Call `ge->ClientThink(edict, &usercmd)` with oldest unprocessed command.
     - Call `ge->G_RunFrame()` to advance game simulation (physics, AI, triggers).
     - Increment `sv.framenum`.
  3. **`SV_SendClientMessages()`**:
     - For each client: Build `svc_frame` with delta-compressed entity snapshot.
     - Call `SV_WriteFrameToClient()` (see Phase 2.4).
     - Send via `client.netchan.Transmit()`.
  4. **Rate Limiting**: Enforce server tickrate (10Hz/20Hz). Sleep remainder of frame time if processing finishes early.

#### 2.3 Client Connection Handshake
- [x] **Challenge System**: Basic implementation exists.
- [ ] **Connection Flow** (verify/complete):
  1. Client sends `clc_stringcmd("connect")` with userinfo (name, model, skin, etc.).
  2. Server validates, calls `ge->ClientConnect(edict, userinfo)` (game can reject).
  3. Server responds with `svc_serverdata` (protocol version, server frame, map name, player slot).
  4. Server sends all configstrings (`svc_configstring` for CS_NAME, CS_MODELS[], CS_SOUNDS[], CS_IMAGES[], CS_LIGHTS[], etc.).
  5. Server sends spawn baselines (`svc_spawnbaseline`) for all entities (initial state for delta compression).
  6. Server sends `svc_stufftext("precache\n")` to signal client to load assets.
  7. Client responds with `clc_stringcmd("begin")` when ready.
  8. Server calls `ge->ClientBegin(edict)`, sets `client_t.state = cs_spawned`, starts sending frames.
- [ ] **Reconnection**: If client disconnects/reconnects, reuse slot if same userinfo (for seamless reconnect).

#### 2.4 Delta Compression (`MSG_WriteDeltaEntity`)
- [x] **Basic Implementation**: Exists in `packages/server/src/protocol/entity.ts`.
- [ ] **Baseline Management**: Each client tracks `lastframe` (last `svc_frame` acked). Server maintains baselines:
  - **Initial Baseline**: Sent via `svc_spawnbaseline` on connect (entity's state when it first spawns).
  - **Frame Baseline**: Last entity state sent to this client in previous frame.
  - **Delta Calculation**: XOR current state with baseline. Only send changed fields (bitflags indicate which fields).
  - Reference `server/sv_ents.c:200-400` for `SV_EmitPacketEntities()` logic.
- [ ] **Field Encoding**: Each entity field (origin, angles, modelindex, frame, skin, effects, etc.) has specific encoding:
  - `origin`: 3 floats, quantized to 1/8 unit precision, sent as shorts (delta from baseline).
  - `angles`: 3 angles, quantized to 256 steps per 360°, sent as bytes.
  - `modelindex`, `frame`, `skin`, etc.: Variable-length encoding (byte if < 256, else short).
  - See `qcommon/msg.c` for `MSG_WriteDeltaEntity()` implementation details.
- [ ] **Removal**: If entity removed since last frame, send entity number with special "remove" flag.
- [ ] **Overflow Handling**: If delta message exceeds MTU (~1400 bytes for WebSocket frame), fall back to full baseline or split across multiple frames.

#### 2.5 Game Module Interface (`game_export_t`)
- [ ] **Loading Game DLL**: In original Quake II, server loads `game.dll` via `dlopen()`. In TypeScript, import `@quake2ts/game` package and call `GetGameAPI(game_import)`.
- [ ] **`game_import_t`**: Server provides to game:
  - Console: `dprintf()`, `cprintf()`, `centerprintf()`, `error()`
  - Entities: `linkentity()`, `unlinkentity()`, `setmodel()`, `trace()`, `pointcontents()`
  - Configstrings: `configstring()` (set CS_* strings)
  - Sound/FX: `sound()`, `positioned_sound()`, `WriteByte/Short/Long/Angle/Dir/String()` (for temp entities)
  - Cvars, commands, filesystem, etc.
  - Reference `rerelease/game.h:1755-2025` for full `game_import_t`.
- [ ] **`game_export_t`**: Game provides to server:
  - Lifecycle: `Init()`, `Shutdown()`, `SpawnEntities()`, `WriteGame()`, `ReadGame()` (savegames)
  - Per-client: `ClientConnect()`, `ClientBegin()`, `ClientDisconnect()`, `ClientCommand()`, `ClientThink()`
  - Per-frame: `RunFrame()`
  - `Pmove()`: Shared movement code (also used by cgame).
  - Reference `rerelease/game.h:2059-2150` for full `game_export_t`.

#### 2.6 Networking Transport (WebSocket Server)
- [x] **Node.js WebSocket**: `packages/server/src/net/nodeWsDriver.ts` implements `NetDriver` using `ws` library.
- [ ] **Binary Protocol**: Ensure WebSocket uses binary frames (not text). Each frame = one Quake II packet (header + payload).
- [ ] **Reliability**: WebSocket is TCP-based (reliable), but still need to track:
  - `reliable_ack`: Client's last received reliable message sequence (for acknowledgement).
  - `incoming_sequence`, `outgoing_sequence`: Message ordering (detect duplicates/out-of-order).
  - Reference `qcommon/net_chan.c` for `Netchan_Process()` / `Netchan_Transmit()` logic (simplify for WebSocket reliability guarantees).

#### 2.7 Headless Physics & Determinism
- [ ] **Collision**: Server must run BSP collision (`CM_BoxTrace()`) identically to client.
  - Ensure `packages/shared/src/bsp/collision.ts` works in Node.js (no Canvas/WebGL dependencies).
  - Use same floating-point precision (IEEE 754) on both server and client.
- [ ] **RNG Seeding**: If game uses random numbers (AI, item drops), seed RNG with known value per frame for determinism.
- [ ] **Tickrate**: Server runs at fixed rate (10Hz default, 20Hz optional). Each tick = 100ms or 50ms game time. Match original Quake II frame timing.
- [ ] **Time Sync**: Send `sv.framenum` and `sv.time` to clients in `svc_frame`. Clients use for interpolation.

### Phase 3: Client Refactoring (CGame)

**Background**: In the rerelease, the cgame module (`cg_main.cpp`, `cg_screen.cpp`) handles client-side presentation, prediction, and HUD. The client becomes a thin network/input layer that delegates to cgame via defined interfaces.

#### 3.1 Create CGame Package Structure
- [ ] **Package Setup**: Create `packages/cgame` with structure:
  - `src/index.ts` - Main entry point, exports `GetCGameAPI()`
  - `src/hud/` - HUD rendering (from `client/src/hud/`)
  - `src/view/` - View effects, bob, kick (from `client/src/view*.ts`)
  - `src/prediction/` - Client prediction (from `client/src/prediction.ts`)
  - `src/screen.ts` - Main screen drawing (`CG_DrawHUD`, equivalent to `cg_screen.cpp`)
  - `src/parse.ts` - Config string parsing, centerprint handling
  - `src/types.ts` - CGame-specific types

#### 3.2 Define CGame Interfaces (TypeScript translation of `rerelease/game.h:2179-2315`)
- [ ] **cgame_import_t** (`packages/cgame/src/types.ts`):
  - Frame timing: `tick_rate`, `frame_time_s`, `frame_time_ms`
  - Console: `Com_Print()`, `Com_Error()`
  - Config strings: `get_configstring(num: number): string`
  - Memory: `TagMalloc()`, `TagFree()`, `FreeTags()` (can be simplified in TS)
  - Cvars: `cvar()`, `cvar_set()`, `cvar_forceset()`
  - Client state: `CL_FrameValid()`, `CL_FrameTime()`, `CL_ClientTime()`, `CL_ServerFrame()`, `CL_ServerProtocol()`
  - Client info: `CL_GetClientName()`, `CL_GetClientPic()`, `CL_GetClientDogtag()`, `CL_GetKeyBinding()`
  - Drawing: `Draw_RegisterPic()`, `Draw_GetPicSize()`, `SCR_DrawChar()`, `SCR_DrawPic()`, `SCR_DrawColorPic()`, `SCR_DrawFontString()`, `SCR_MeasureFontString()`, `SCR_FontLineHeight()`, `SCR_SetAltTypeface()`, `SCR_DrawBind()`
  - Localization: `Localize()`
  - State queries: `CL_GetTextInput()`, `CL_GetWarnAmmoCount()`, `CL_InAutoDemoLoop()`

- [ ] **cgame_export_t** (`packages/cgame/src/types.ts`):
  - Lifecycle: `Init()`, `Shutdown()`
  - Rendering: `DrawHUD(isplit, data, hud_vrect, hud_safe, scale, playernum, ps)` (from `cg_screen.cpp`)
  - Asset loading: `TouchPics()` (precache HUD images)
  - Layout flags: `LayoutFlags(ps): layout_flags_t` (determines if inventory/help/intermission showing)
  - Weapon wheel: `GetActiveWeaponWheelWeapon()`, `GetOwnedWeaponWheelWeapons()`, `GetWeaponWheelAmmoCount()`, `GetPowerupWheelCount()`
  - Hit markers: `GetHitMarkerDamage(ps)`
  - Prediction: `Pmove(pmove: pmove_t)` (shared with server - see Phase 3.3)
  - Parsing: `ParseConfigString(i, s)`, `ParseCenterPrint(str, isplit, instant)`, `NotifyMessage(isplit, msg, is_chat)`
  - State management: `ClearNotify(isplit)`, `ClearCenterprint(isplit)`
  - Effects: `GetMonsterFlashOffset(id): vec3`
  - Extension: `GetExtension(name)` (future extensibility)

#### 3.3 Move Shared Code (`packages/shared`)
These are already correctly placed, verify completeness:
- [x] **Player Movement** (`pmove/`): Already in `packages/shared/src/pmove/` - matches `rerelease/p_move.cpp`. Verify `Pmove()` signature matches both server (`game_export_t::Pmove`) and cgame (`cgame_export_t::Pmove`).
- [ ] **Movement Config** (`pmove/config.ts`): Add `pm_config_t` structure from `rerelease/bg_local.h:18-24` (airaccel, n64_physics flags).
- [ ] **Player Stats** (`protocol/stats.ts`): Add `player_stat_t` enum from `rerelease/bg_local.h:196-262` (STAT_HEALTH, STAT_AMMO, STAT_WEAPONS_OWNED_1/2, STAT_AMMO_INFO_START, etc.). These are read by cgame for HUD.
- [ ] **Stat Helpers** (`protocol/stats.ts`): Add compressed stat functions from `bg_local.h:169-193`: `G_SetAmmoStat()`, `G_GetAmmoStat()`, `G_SetPowerupStat()`, `G_GetPowerupStat()` (9-bit ammo packing, 2-bit powerup packing).
- [ ] **Layout Flags** (`protocol/layout.ts`): Add `layout_flags_t` enum from `rerelease/game.h:1584-1593` (LAYOUTS_LAYOUT, LAYOUTS_INVENTORY, LAYOUTS_HIDE_HUD, LAYOUTS_INTERMISSION, LAYOUTS_HELP, LAYOUTS_HIDE_CROSSHAIR).
- [ ] **Config String Indices** (`protocol/configstrings.ts`): Add `CONFIG_N64_PHYSICS`, `CONFIG_CTF_*`, `CONFIG_COOP_RESPAWN_STRING` from `bg_local.h:55-76` (these are in CS_GENERAL range and used by both server and cgame).

#### 3.4 Migrate Client Code to CGame
Map existing `client/src` files to `cgame/src` based on `rerelease` structure:

##### HUD System (→ `cgame/src/hud/`, `cgame/src/screen.ts`)
- [ ] **`client/src/hud.ts`** → `cgame/src/screen.ts`: Main entry point. Rename `Draw_Hud()` to `CG_DrawHUD()` matching `cgame_export_t::DrawHUD` signature from `rerelease/cg_screen.cpp`.
- [ ] **`client/src/hud/*.ts`** → `cgame/src/hud/*.ts`: Move all files:
  - `statusbar.ts` - Status bar with health/armor/ammo (uses player_state_t.stats[])
  - `crosshair.ts` - Crosshair rendering
  - `damage.ts` - Damage indicators and screen flash
  - `icons.ts` - Weapon/item icons
  - `pickup.ts` - Pickup notifications
  - `numbers.ts` - HUD number rendering
  - `layout.ts` - Inventory/help overlay layout parsing
  - `messages.ts` - Chat/notify messages (implement `NotifyMessage()` export)
  - `subtitles.ts` - Sound subtitles
  - `blends.ts` - Screen blends (damage, powerups)
  - `diagnostics.ts` - FPS/network stats overlay
- [ ] **Stat Reading**: Update HUD code to read from `player_state_t.stats[]` array using `STAT_*` constants (not hardcoded indices). Use `G_GetAmmoStat()` / `G_GetPowerupStat()` for compressed stats.
- [ ] **Asset Precaching**: Implement `TouchPics()` export to call `cgi.Draw_RegisterPic()` for all HUD images during level load (see `rerelease/cg_screen.cpp:1689`).

##### View Effects (→ `cgame/src/view/`)
- [ ] **`client/src/view.ts`** → `cgame/src/view/camera.ts`: Camera update logic (applies bob/kick to camera).
- [ ] **`client/src/view-effects.ts`** → `cgame/src/view/effects.ts`: View bob, roll, kick calculations. Reference `rerelease/p_view.cpp:45-66` (`SV_CalcRoll`) for roll calculation based on velocity dot right vector.
- [ ] **View Angles**: Implement view angle clamping and kick angles from `p_view.cpp`. Update `ViewEffects` to read `ps.kick_angles` from server and apply to camera.
- [ ] **Gun Offset**: Calculate gun position/angles from `ps.gunoffset` / `ps.gunangles` (for future weapon viewmodel rendering).

##### Prediction (→ `cgame/src/prediction/`)
- [ ] **`client/src/prediction.ts`** → `cgame/src/prediction/index.ts`: Client-side movement prediction.
- [ ] **Pmove Integration**: Replace custom prediction with calls to `Pmove()` from `packages/shared/pmove`. Prediction should call the same `Pmove()` function as the server.
- [ ] **Trace Function**: CGame prediction needs a trace function. Client must provide `cgi.PM_Trace()` in `cgame_import_t` that performs client-side collision (against BSP + predicted entities).
- [ ] **Command Replay**: When `svc_frame` arrives, reconcile predicted state:
  1. Verify prediction matches server state (within tolerance).
  2. If mismatch, rewind to server frame and re-predict forward through queued commands.
  3. See `rerelease` CL_PredictMovement pattern (client-side, not in DLL, but logic applies).

##### Parsing & State (→ `cgame/src/parse.ts`)
- [ ] **Config String Parsing**: Implement `ParseConfigString(i, s)` export:
  - If `i == CONFIG_N64_PHYSICS`: update `pm_config.n64_physics`.
  - If `i == CS_AIRACCEL`: update `pm_config.airaccel`.
  - See `rerelease/cg_main.cpp:67-73`.
- [ ] **Centerprint**: Implement `ParseCenterPrint(str, isplit, instant)` export. Parse layout strings, handle binds (e.g., `$bind_attack` → `CL_GetKeyBinding("attack")`). Store in per-splitscreen centerprint buffer. See `rerelease/cg_screen.cpp:~100+`.
- [ ] **Notify/Chat**: Implement `NotifyMessage(isplit, msg, is_chat)` export. Add to notify ring buffer with timestamp. See `rerelease/cg_screen.cpp:~200+`.

##### Client Responsibilities (remain in `packages/client`)
- [ ] **Network I/O**: Reading packets via `NetDriver`, parsing `svc_*` messages, sending `clc_*` commands. Client calls cgame exports when needed (e.g., `cg.ParseConfigString()` when `svc_configstring` arrives).
- [ ] **Input Handling**: Keyboard/mouse/gamepad → `UserCommand` generation. Send commands to server via `clc_move`.
- [ ] **Frame Loop**: `CL_Frame()`:
  1. `CL_ReadPackets()` - parse network messages, update `player_state_t`.
  2. `cg.Pmove()` - predict movement.
  3. Interpolate entities (for smooth rendering between server updates).
  4. `cg.DrawHUD()` - render HUD.
- [ ] **Asset Management**: Load BSP, models, sounds, textures. Provide to cgame via `cgi` imports.
- [ ] **Demo Playback**: Existing `demo/` code stays in client. Demo player feeds `svc_*` messages to client as if from network.

#### 3.5 Interface Wiring
- [ ] **Client Initialization**: Client calls `GetCGameAPI(cgame_import)` and receives `cgame_export`. Store exports as `cg.*` function pointers (or object in TS).
- [ ] **Import Population**: Client provides `cgame_import` with:
  - Renderer functions (wrapping `@quake2ts/engine` Renderer).
  - Config string access (client's `ClientConfigStrings`).
  - Frame timing from client's main loop.
  - Client state queries (player names, key bindings, etc.).
- [ ] **Export Usage**: Client invokes `cg.Init()` on level start, `cg.DrawHUD()` each frame, `cg.Shutdown()` on level end, `cg.Pmove()` for prediction, `cg.Parse*()` when network messages arrive.

#### 3.6 Testing & Validation
- [ ] **Local Mode**: Test cgame split by running existing local game (no server). Client should work identically after refactor.
- [ ] **Prediction Accuracy**: Verify predicted movement matches original behavior. Log prediction errors (delta between predicted and server position).
- [ ] **HUD Completeness**: Ensure all HUD elements render (health, armor, ammo, weapon icons, pickup messages, centerprint, inventory, help screens).
- [ ] **Performance**: CGame should not introduce frame drops. Profile `CG_DrawHUD()` execution time.

### Phase 4: Integration & Testing

#### 4.1 Localhost Server-Client Test
- [ ] **Server Startup**: Run Node.js server on `localhost:27910` (default Quake II port).
  - Load a test map (e.g., `demo1.bsp` or `base1.bsp`).
  - Verify game module initializes (`ge->Init()`, `ge->SpawnEntities()`).
- [ ] **Client Connection**: Launch browser client, connect to `ws://localhost:27910`.
  - Client should receive `svc_serverdata`, configstrings, baselines.
  - Client loads map assets, sends `clc_stringcmd("begin")`.
  - Server should start sending `svc_frame` snapshots (10Hz).
- [ ] **Movement Test**: Use keyboard input to move player.
  - Client generates `usercmd_t`, sends via `clc_move`.
  - Server processes in `ClientThink()`, updates player position via `Pmove()`.
  - Client receives updated position in `svc_frame`, reconciles with prediction.
  - Verify smooth movement with no "rubber-banding" (prediction error should be < 1 unit).
- [ ] **Entity Rendering**: Verify other entities (monsters, items, doors) render and animate correctly from server snapshots.

#### 4.2 Prediction Error Reconciliation
- [ ] **Error Detection**: When `svc_frame` arrives, compare server position (`ps.pmove.origin`) with predicted position.
  - Log delta: `console.log('Prediction error:', serverPos - predictedPos)`.
  - Normal error: < 1 unit (quantization noise from network encoding).
  - Large error (> 10 units): Indicates desync (e.g., missed collision on client).
- [ ] **Correction Smoothing**: Don't snap instantly to server position (jarring). Instead:
  - **Method 1 (Lerp)**: Interpolate over 100-200ms. `correctedPos = lerp(predictedPos, serverPos, alpha)`.
  - **Method 2 (Re-simulation)**: Replay all commands since server frame with corrected starting position.
  - Reference `client/cl_pred.c` from original Quake II for smoothing logic.
- [ ] **Collision Mismatch Handling**: If client prediction hits different geometry than server (e.g., moving platform), server position is authoritative. Client should accept correction and continue predicting forward.

#### 4.3 Entity Interpolation
- [ ] **Server Rate**: Server sends snapshots at 10Hz (every 100ms). Client renders at 60Hz+. Need interpolation.
- [ ] **Frame Buffer**: Client stores last 2-3 `svc_frame` snapshots (ring buffer).
- [ ] **Interpolation Time**: Render at `currentTime - 100ms` (one server frame behind). Interpolate between snapshot N-1 and N.
  - For entity at 10% through frame: `renderPos = lerp(frame[N-1].pos, frame[N].pos, 0.1)`.
  - Similarly interpolate angles, frame number (animation).
- [ ] **Extrapolation**: If next snapshot hasn't arrived (packet loss / high latency), extrapolate forward using last known velocity. Clamp extrapolation to max ~200ms to avoid wild guesses.
- [ ] **Player Exception**: Local player uses prediction (forward-looking), not interpolation (backward-looking).

#### 4.4 Network Latency Testing
- [ ] **Artificial Latency**: Add delay in `NetDriver` for testing (e.g., `setTimeout(() => deliver(packet), 100)` for 100ms RTT).
- [ ] **High Latency (200ms+)**: Verify prediction still feels responsive. Player movement should be instant (predicted), world updates lag behind.
- [ ] **Packet Loss**: Simulate 5-10% packet loss. Verify:
  - Server re-sends reliable messages (configstrings, sounds).
  - Client extrapolates entity positions during loss.
  - No crashes or desyncs.
- [ ] **Jitter**: Vary latency randomly (50-150ms). Verify interpolation smooths out stuttering.

#### 4.5 Multi-Client Test
- [ ] **Two Clients**: Open two browser tabs, both connect to server.
  - Each client should see the other's player entity.
  - Verify player models animate (walking, shooting).
  - Test collision: Players should not walk through each other (server enforces).
- [ ] **Chat/Centerprint**: Send `say` command from one client, verify other client receives via `svc_print` or `svc_centerprint`.

#### 4.6 Performance Profiling
- [ ] **Server CPU**: Profile `SV_Frame()`. Target: < 10ms per frame (for 10Hz tickrate with headroom).
  - Hotspots: `Pmove()`, entity thinking (`RunFrame()`), delta compression (`SV_WriteFrameToClient()`).
- [ ] **Client CPU**: Profile CGame `CG_DrawHUD()`. Target: < 2ms per frame (60Hz = 16.6ms budget total).
- [ ] **Network Bandwidth**: Measure bytes/sec per client.
  - Typical: 5-10 KB/s (with delta compression).
  - Uncompressed would be ~50 KB/s (reason delta compression is critical).
- [ ] **Memory**: Monitor server RAM usage with 8+ clients. Ensure no leaks in entity management.

## Architecture Notes

### Module Dependency Graph
```
packages/shared (pmove, protocol, math, BSP)
    ↑                    ↑
    |                    |
packages/game        packages/cgame
(server-side)        (client-side)
    ↑                    ↑
    |                    |
packages/server      packages/client
(Node.js)            (Browser)
```

### Data Flow: Client Input → Server → Client Render
1. **Input**: Browser captures keyboard/mouse → `usercmd_t` (angles, buttons, forward/side/up)
2. **Send**: Client sends `clc_move` with command
3. **Predict**: Client predicts movement locally using `cgame.Pmove()`
4. **Server Receive**: Server extracts command from `clc_move`
5. **Server Simulate**: Server calls `game.ClientThink()` → `game.Pmove()` (authoritative)
6. **Server Send**: Server builds `svc_frame` with delta-compressed entity states
7. **Client Receive**: Client parses `svc_frame`, updates `player_state_t`
8. **Client Reconcile**: Client compares predicted vs server position, corrects if needed
9. **Client Render**: Client interpolates entities, renders HUD via `cgame.DrawHUD()`

### Why Separate CGame from Client?
- **Modularity**: CGame has no network/input knowledge. Can be tested standalone.
- **Reusability**: Same CGame module used for:
  - Network client (live multiplayer)
  - Demo playback (network messages from file)
  - Listen server (local game with future network join)
- **Maintainability**: Clear interface (`cgame_import_t` / `cgame_export_t`) prevents tight coupling.
- **Performance**: CGame can be profiled/optimized independently of network/input.

### Shared Code Strategy
Only code that **must** run identically on client and server goes in `packages/shared`:
- **Pmove**: Player physics (collision, acceleration, jumping)
- **Protocol**: Message formats, entity state structure, config string indices
- **Math**: Vector operations, angle normalization
- **BSP**: Collision detection (both client prediction and server simulation)

Do **not** move to shared:
- **HUD**: Client-only presentation (in cgame)
- **AI**: Server-only logic (in game)
- **Network I/O**: Transport layer (client/server specific)

## Key Challenges

### 1. Delta Compression Complexity
**Problem**: With 100+ entities, sending full state every frame = ~50 KB/s per client. Delta compression reduces to ~5 KB/s but requires complex baseline tracking.
**Solution**:
- Each client stores `entity_state_t` baseline per entity.
- Server XORs current state with baseline, sends only changed fields (bitfield indicates which).
- Entity fields have specific encoding (quantized floats, variable-length ints).
- Reference `server/sv_ents.c:200-400` (`SV_EmitPacketEntities`) for exact logic.
**Testing**: Log bytes sent per frame. Target: < 1500 bytes/frame (10Hz = 15 KB/s).

### 2. Prediction Reconciliation
**Problem**: Client predicts movement forward (for low-latency feel), but server position arrives 50-200ms later. Must reconcile without "rubber-banding".
**Solution**:
- Client maintains command history (last ~1 second of `usercmd_t`).
- When `svc_frame` arrives with server position at frame N:
  1. Compare with client's prediction at frame N.
  2. If delta < 1 unit: Accept (normal quantization error).
  3. If delta > 1 unit: Rewind to frame N, replay commands N+1...current with corrected start.
- Smooth large corrections over 100-200ms (lerp) to avoid visual snap.
**Testing**: Log prediction errors. Normal: 0.1-0.5 units. Large (> 2 units) indicates collision desync.

### 3. Floating-Point Determinism
**Problem**: Server (Node.js) and client (Browser) must compute identical physics. Floating-point differences = desync.
**Solution**:
- Use IEEE 754 floats (default in JS/TS). Both Node and browsers use same spec.
- Avoid platform-specific math (`Math.sin`, `Math.cos` are deterministic across platforms).
- Order of operations matters: `(a + b) + c ≠ a + (b + c)` in FP. Keep same order in shared code.
- Test: Run 1000 frames of `Pmove()` on server and client with same inputs. Verify identical final position (bit-exact).
**Watch out**: If using SIMD or compiled modules (WASM), ensure identical precision.

### 4. WebSocket vs UDP
**Original Quake II**: Uses UDP (unreliable, low-latency). Lost packets → extrapolate.
**quake2ts**: Uses WebSocket (TCP, reliable, higher latency). Lost packets → retransmit → frame stall.
**Mitigation**:
- Keep packet size small (< 1400 bytes) to avoid fragmentation.
- Send redundant data (e.g., repeat last position in next frame) to recover from stalls.
- Future: Migrate to WebTransport (unreliable mode) when widely supported.

## Troubleshooting

### Prediction Errors > 10 Units
**Symptoms**: Player "rubber-bands" (snaps back after moving).
**Causes**:
- Client collision differs from server (BSP loading error, different pmove code).
- Server corrected position but client didn't apply correction.
**Debug**:
- Log client and server positions each frame: `console.log('Client:', clientPos, 'Server:', serverPos)`.
- Compare `Pmove()` output on client and server with same input. Should be identical.
- Check if collision trace returns same result (same BSP data loaded?).

### Entities Not Rendering
**Symptoms**: Player model or items invisible.
**Causes**:
- Entity not in PVS (Potentially Visible Set). Client only receives entities server thinks are visible.
- Model not precached (client doesn't have modelindex → configstring mapping).
- Delta compression removed entity but client didn't process removal.
**Debug**:
- Check `svc_frame`: Is entity in `packetentities` list?
- Check configstrings: Is `CS_MODELS[entity.modelindex]` set?
- Log entity state changes: `console.log('Entity 5 removed')`.

### HUD Stats Wrong
**Symptoms**: Health shows 0, ammo shows garbage.
**Causes**:
- Reading wrong `STAT_*` index (e.g., `stats[1]` instead of `STAT_HEALTH`).
- Server not setting stats (game DLL bug).
- Compressed stat decoding error (ammo/powerup bit-packing).
**Debug**:
- Log `player_state_t.stats[]` array on client: `console.log('Stats:', ps.stats)`.
- Verify server sets stats in `ClientThink()` or `P_DamageFeedback()`.
- Test stat helpers: `G_GetAmmoStat(stats, AMMO_BULLETS)` should return correct value.

### Server CPU 100%
**Symptoms**: Server frame time > 100ms, can't maintain 10Hz.
**Causes**:
- Too many entities thinking (1000+ monsters).
- Inefficient collision (quadratic entity vs entity checks).
- Delta compression too slow (complex entity state).
**Debug**:
- Profile `SV_Frame()`: Which function takes longest?
- Reduce entity count for testing (empty map).
- Optimize hotspots: Cache trace results, spatial partitioning (BSP already does this).

### Client Frame Rate Drops
**Symptoms**: FPS < 60, stuttering.
**Causes**:
- `CG_DrawHUD()` too slow (complex HUD layout).
- Entity interpolation inefficient (iterating all entities each frame).
- Asset loading blocking render (should be async).
**Debug**:
- Profile client frame: `performance.mark('drawHUD_start')` / `performance.measure()`.
- Check if blocking on network I/O (should be async).
- Reduce HUD complexity temporarily (comment out statusbar rendering).

## Implementation Checklist Summary

### Phase 1: Network Plumbing ✅
- [x] Protocol definitions (`svc_*`, `clc_*`)
- [x] Message builder/parser
- [x] WebSocket transport (client and server)

### Phase 2: Server 🔄 (Partially Complete)
- [x] Basic server structure
- [ ] Complete server loop (`SV_Frame`)
- [ ] Client connection handshake
- [ ] Delta compression (enhance)
- [ ] Game module interface
- [ ] Headless collision

### Phase 3: CGame ⚠️ (Major Refactor Needed)
- [ ] Create `packages/cgame`
- [ ] Define `cgame_import_t` / `cgame_export_t` interfaces
- [ ] Move HUD, view, prediction from client to cgame
- [ ] Add shared stat/layout types
- [ ] Implement parsing (centerprint, notify, configstrings)
- [ ] Wire client ↔ cgame interface

### Phase 4: Integration ⏸ (Blocked by Phase 3)
- [ ] Localhost server-client test
- [ ] Prediction tuning
- [ ] Entity interpolation
- [ ] Multi-client test
- [ ] Performance profiling

## References

### Original Quake II Source (id Software 1997)
- **Protocol**: `qcommon/qcommon.h` - `svc_*` / `clc_*` command definitions
- **Message I/O**: `qcommon/msg.c` - `MSG_WriteByte/Short/Long/Angle/Dir/String/DeltaEntity`
- **Server Loop**: `server/sv_main.c` - `SV_Frame()`, `SV_InitGame()`, `SV_SpawnServer()`
- **Server Entities**: `server/sv_ents.c` - `SV_BuildClientFrame()`, `SV_EmitPacketEntities()`
- **Server Send**: `server/sv_send.c` - `SV_SendClientMessages()`, `SV_WriteFrameToClient()`
- **Client Loop**: `client/cl_main.c` - `CL_Frame()`, `CL_ParseServerMessage()`
- **Client Prediction**: `client/cl_pred.c` - `CL_PredictMovement()`, prediction error correction
- **Player Move**: `qcommon/pmove.c` - `Pmove()` shared function (client and server)
- **Network Channel**: `qcommon/net_chan.c` - `Netchan_Transmit()`, `Netchan_Process()` (reliability layer over UDP)

### Quake II Rerelease Source (Nightdive/id Software 2023)
- **CGame Main**: `rerelease/cg_main.cpp` - `GetCGameAPI()`, `InitCGame()`, module entry point
- **CGame Screen**: `rerelease/cg_screen.cpp` - `CG_DrawHUD()`, centerprint, notify, status bar rendering
- **CGame Interface**: `rerelease/game.h:2179-2315` - `cgame_import_t`, `cgame_export_t` structures
- **Background (Shared)**: `rerelease/bg_local.h` - `pm_config_t`, stat enums, compressed stat helpers
- **Player View**: `rerelease/p_view.cpp` - `SV_CalcRoll()`, `P_DamageFeedback()` (view kick, screen blend)
- **Player HUD**: `rerelease/p_hud.cpp` - HUD/scoreboard logic (server-side, sends layout strings)
- **Player Move**: `rerelease/p_move.cpp` - `Pmove()` implementation (shared, used by game and cgame)
- **Game Interface**: `rerelease/game.h:2059-2150` - `game_export_t`, `game_import_t` structures
- **Game Main**: `rerelease/g_main.cpp` - `GetGameAPI()`, `InitGame()`, `G_RunFrame()`

### quake2ts Current Codebase
- **Client Package**: `packages/client/src/` - Currently contains HUD, view, prediction (→ move to cgame)
- **Server Package**: `packages/server/src/` - Basic server loop, WebSocket transport
- **Shared Package**: `packages/shared/src/` - Pmove (✅), protocol types, BSP collision
- **Game Package**: `packages/game/src/` - Game logic, entities (needs `game_export_t` interface)
- **Demo Format**: Section 12 docs - `svc_*` message parsing (reuse for network protocol)
