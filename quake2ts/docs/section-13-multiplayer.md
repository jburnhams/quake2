# Section 13: Multiplayer & Networking (Initial Setup)

## Overview
This section focuses on laying the **foundations** for multiplayer, specifically the client-server message loop, protocol definitions, and basic connection handling. While full multiplayer gameplay is a larger goal, this step ensures the engine can serialize/deserialize game state and process network commands correctly.

**Goal:** Establish a working network protocol layer where a "server" (local or remote) can send snapshots to a "client," and the client can send user commands back.

## Dependencies
- **Section 10 (Integration Testing):** Must be able to run deterministic loops.
- **Section 8 (Input/UI/Client):** Client needs to generate user commands.
- **Section 9 (Save/Load):** Serialization logic is reused for snapshots.

## Key Tasks

### 1. Protocol Definition & Message Parsing
- [x] **Define Protocol Types:**
    - Create TypeScript definitions for all server-to-client (`svc_`) and client-to-server (`clc_`) commands based on the Q2 protocol.
    - Implemented in `packages/shared/src/protocol/commands.ts` using `BinaryWriter` for serialization.
    - Ensure byte-perfect alignment with the original protocol where possible (or document deviations for the web).
- [x] **Message Parser/Writer:**
    - Implement a `NetMessage` class to read/write binary data (byte, short, long, string, angle, coord, etc.).
    - Implemented via `BinaryStream` (reader) and `BinaryWriter` (writer) in `packages/shared/src/io`.
    - Specific command writers added in `packages/shared/src/protocol/commands.ts`.
    - **Verify:** Unit tests reading/writing known Q2 packet captures.
    - Unit tests added in `packages/shared/tests/protocol/commands.test.ts`.

### 2. Client-Server Loop (Local)
- [ ] **Local Loopback Transport:**
    - Create a mock "network" layer that passes messages between the Game and Client instances in memory.
    - This simulates a server sending packets to a client without actual WebSockets yet.
- [ ] **Connection State Machine:**
    - Implement the basic handshake: `challenge` -> `connect` -> `newgamestate`.
    - Handle `client_connect` and `client_begin` in the game logic.

### 3. Snapshot Generation (Baselines)
- [ ] **Delta Compression (Initial):**
    - Implement the logic to diff the current frame against a previous frame (baseline) to generate a delta snapshot.
    - Focus on `entity_state_t` fields.
- [ ] **Packet Construction:**
    - Assemble a packet containing the snapshot, temporary entities, and reliable commands.

### 4. Client Command Generation
- [ ] **User Command Serialization:**
    - Serialize `usercmd_t` (buttons, angles, movement) into the `clc_move` packet format.
    - Ensure input prediction logic (from Section 8) feeds into this.

## Testing Requirements
- **Packet Tests:** Verify that every packet type can be serialized and deserialized correctly.
- **Loopback Test:** Verify a full "frame" cycle: Input -> CLC Packet -> Server Process -> Snapshot -> SVC Packet -> Client Render.
- **Snapshot Delta Test:** Verify that delta compression reduces packet size and correctly reconstructs the state.

## Notes
- Start with **Protocol Version 34** (standard Q2) or the Rerelease protocol if targeting that specifically. Document the choice.
- **Endianness:** Javascript `DataView` is helpful for handling little-endian Q2 data.
- **Bandwidth:** Don't worry about optimization yet; focus on correctness.
