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
- [ ] **Package Setup**: Initialize `packages/server`.
- [ ] **Server Loop**: Implement `SV_Frame` logic:
  - Read packets (`SV_ReadPackets`).
  - Run game frame (`ge->RunFrame`).
  - Send updates (`SV_SendClientMessages`).
- [ ] **Client Management**: Implement `client_t` structure, connection handshakes, and `SV_DirectConnect`.
- [ ] **Delta Compression**: Implement `MSG_WriteDeltaEntity` to send only changed entity fields (crucial for bandwidth).

### Phase 3: Client Refactoring (CGame)
- [ ] **CGame Interface**: Define `cgame_export_t` and `cgame_import_t` interfaces in TypeScript.
- [ ] **Module Split**: Move HUD, View, and Prediction logic from `packages/client` to `packages/cgame` (or a sub-module).
- [ ] **Network Loop**: Update `CL_Frame` to:
  - Read server packets.
  - Run prediction (`CG_Predict`).
  - Render frame (`CG_Draw`).

### Phase 4: Integration
- [ ] **Localhost Test**: Verify a browser client can connect to a local Node.js server.
- [ ] **Prediction Tuning**: Adjust prediction error correction (smoothing) for network latency.
- [ ] **Lag Compensation**: (Optional) Implement server-side unlagged logic if needed for high-latency play.

## Key Challenges
1.  **Delta Compression**: Correctly maintaining the "baseline" state and calculating deltas for `svc_packetentities` is complex.
2.  **Prediction**: Reconciling client prediction with server authoritative updates without "snapping".
3.  **Headless Physics**: Ensuring the physics engine runs identically on Node.js (Server) and Browser (Client) without float divergence.

## References
- `qcommon/qcommon.h`: Protocol definitions.
- `server/sv_*.c`: Server loop and client management.
- `client/cl_*.c`: Client loop and prediction.
- `rerelease/cg_*.cpp`: Rerelease client game logic.
