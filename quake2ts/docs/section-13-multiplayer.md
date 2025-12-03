# Section 13: Multiplayer & Network Support - Implementation Tasks

## Current Status
**~60% Complete (Framework & Server Integration)**

- ✅ Server and client packages exist
- ✅ Basic WebSocket transport works
- ✅ Protocol message builders/parsers exist
- ✅ Multiplayer UI menu exists
- ✅ NetChan reliability layer implemented (Phase 1 complete)
- ✅ Server NetChan integration complete (Phase 2 complete)
- ❌ No real end-to-end testing (all tests use mocks)
- ❌ Client NetChan integration incomplete (Phase 3 pending)

**Goal**: Enable browser-based multiplayer with client-server architecture, client-side prediction, and reliable networking.

---

## Implementation Roadmap

### Phase 1: NetChan Reliability Layer (COMPLETE)

**Estimated Time**: 2-3 weeks
**Dependencies**: None (reference implementation exists)
**Reference**: `full/qcommon/net_chan.c` (300+ lines of networking code)

#### Task 1.1: Create NetChan Class Structure (COMPLETE)
**File**: Create `packages/shared/src/net/netchan.ts`
**Reference**: `full/qcommon/net_chan.c` lines 1-100 (struct and init)

- [x] **1.1.1** Define `NetChan` interface and state
  - Add `interface NetAddress { type: string, port: number }`
  - Add `qport: number` (client port for NAT traversal)
  - Add `incomingSequence: number` (last received seq)
  - Add `outgoingSequence: number` (next seq to send)
  - Add `incomingAcknowledged: number` (last acked by remote)
  - Add `incomingReliableAcknowledged: boolean` (even/odd reliable ack)
  - Add `incomingReliableSequence: number` (last reliable received)
  - Add `outgoingReliableSequence: number` (reliable message being sent)
  - Add `reliableMessage: BinaryWriter` (outgoing reliable buffer)
  - Add `reliableLength: number` (size of reliable message)
  - Add `lastReceived: number` (timestamp for timeout detection)
  - Add `lastSent: number` (timestamp for keepalive)

- [x] **1.1.2** Create `NetChan` class constructor
  - Initialize all sequence numbers to 0
  - Set qport from random or config
  - Initialize message buffers
  - Set timestamps to current time

- [x] **1.1.3** Add constants (from net_chan.c)
  - `MAX_MSGLEN = 1400` (MTU limit)
  - `FRAGMENT_SIZE = 1024`
  - `PACKET_HEADER = 10` (sequence + ack + qport)

**Test Case**: Unit test in `packages/shared/tests/net/netchan.test.ts`
- Create NetChan instance
- Verify initial state (sequences = 0)
- Verify qport is set
- Verify buffers initialized

**Reference Lines**: `full/qcommon/net_chan.c:82-102` (Netchan_Init, Netchan_Setup)

#### Task 1.2: Implement Netchan_Transmit (COMPLETE)
**File**: `packages/shared/src/net/netchan.ts`
**Reference**: `full/qcommon/net_chan.c:180-250` (Netchan_Transmit)

- [x] **1.2.1** Create `transmit(unreliableData?: Uint8Array): Uint8Array` method
  - Build packet header (sequence, ack, qport)
  - Increment `outgoingSequence`
  - Update `lastSent` timestamp

- [x] **1.2.2** Add reliable message handling
  - Check if `reliableMessage` has data (reliableLength > 0)
  - If yes, set reliable bit in sequence field (sequence | 0x80000000)
  - Set reliable acknowledge bit based on `incomingReliableSequence` (even/odd)
  - Prepend reliable message to packet

- [x] **1.2.3** Append unreliable data
  - After reliable data (if any), append unreliableData
  - Verify total size < MAX_MSGLEN
  - If overflow, truncate unreliable (reliable must go through)

- [x] **1.2.4** Return packet for transmission
  - Return complete packet as Uint8Array
  - Caller sends via WebSocket
  - Reliable data stays in buffer until acked

**Test Case**: Unit test in `packages/shared/tests/net/netchan-transmit.test.ts`
- Create NetChan, add reliable data
- Call transmit with unreliable data
- Parse returned packet
- Verify header fields correct
- Verify reliable + unreliable both present
- Verify sequence incremented

**Reference Lines**: `full/qcommon/net_chan.c:180-250`

#### Task 1.3: Implement Netchan_Process (Receive) (COMPLETE)
**File**: `packages/shared/src/net/netchan.ts`
**Reference**: `full/qcommon/net_chan.c:252-360` (Netchan_Process)

- [x] **1.3.1** Create `process(packet: Uint8Array): Uint8Array | null` method
  - Parse packet header (sequence, ack, qport)
  - Verify qport matches (reject if mismatch)
  - Update `lastReceived` timestamp

- [x] **1.3.2** Handle sequence acknowledgment
  - Check `ack` field in packet
  - If `ack === outgoingReliableSequence`, reliable message was received
  - Check reliable ack bit matches expected (even/odd)
  - If matched, clear `reliableMessage` (acked successfully)
  - Update `incomingAcknowledged` to ack value

- [x] **1.3.3** Handle sequence validation
  - Extract sequence from packet
  - Check if `sequence <= incomingSequence` (duplicate or out of order)
  - If duplicate, discard packet silently
  - If too old, discard
  - Update `incomingSequence` to sequence value

- [x] **1.3.4** Handle reliable message reception
  - Check if sequence has reliable bit set (sequence & 0x80000000)
  - If set, this packet contains reliable data
  - Check reliable sequence (even/odd toggle)
  - If sequence expected, accept reliable data
  - If duplicate reliable, discard but still ack
  - Update `incomingReliableSequence`

- [x] **1.3.5** Extract and return message payload
  - Skip packet header bytes
  - If reliable data present, skip it (already processed)
  - Return unreliable portion as Uint8Array
  - Return null if packet invalid/duplicate

**Test Case**: Unit test in `packages/shared/tests/net/netchan-process.test.ts`
- Create two NetChan instances (simulate client/server)
- Client transmits packet
- Server processes packet
- Verify sequence tracking
- Verify reliable ack works
- Test duplicate detection
- Test out-of-order handling

**Reference Lines**: `full/qcommon/net_chan.c:252-360`

#### Task 1.4: Add Reliable Message Queueing (COMPLETE)
**File**: `packages/shared/src/net/netchan.ts`
**Reference**: `full/qcommon/net_chan.c` (MSG_Write* to netchan.message)

- [x] **1.4.1** Create `canSendReliable(): boolean` method
  - Return true if `reliableMessage` is empty (acked)
  - Return false if still waiting for ack
  - Used by caller to check if can queue more

- [x] **1.4.2** Create `writeReliableByte(value: number): void` method
  - Check if `reliableMessage` has space
  - Append byte to `reliableMessage` buffer
  - Increment `reliableLength`
  - Throw if overflow (reliable queue full)

- [x] **1.4.3** Add helper methods for other types
  - `writeReliableShort(value: number): void`
  - `writeReliableLong(value: number): void`
  - `writeReliableString(value: string): void`
  - Each wraps BinaryWriter methods

- [x] **1.4.4** Create `getReliableData(): Uint8Array` method
  - Return current reliable buffer contents
  - Used internally by transmit
  - Returns empty array if no reliable data

**Test Case**: Unit test in `packages/shared/tests/net/netchan-reliable.test.ts`
- Write reliable data to NetChan
- Verify canSendReliable returns false
- Transmit packet
- Process ack packet
- Verify canSendReliable returns true (cleared)
- Verify reliable data was sent

**Reference**: Pattern from MSG_Write* functions in qcommon/msg.c

#### Task 1.5: Add Fragment Support (Optional but Recommended)
**File**: `packages/shared/src/net/netchan.ts`
**Reference**: `full/qcommon/net_chan.c:104-178` (fragment handling)

- [ ] **1.5.1** Add fragment state to NetChan
  - Add `fragmentSequence: number` (sequence of fragmented message)
  - Add `fragmentLength: number` (total length)
  - Add `fragmentData: Uint8Array` (reassembly buffer)

- [ ] **1.5.2** Modify transmit for large reliable messages
  - Check if `reliableLength > FRAGMENT_SIZE`
  - If yes, send in fragments
  - Set fragment bit in sequence
  - Send first N bytes, mark continuation

- [ ] **1.5.3** Modify process for fragment reassembly
  - Detect fragment bit in sequence
  - Buffer fragment data
  - Wait for all fragments
  - Once complete, process as normal reliable message

**Test Case**: Unit test in `packages/shared/tests/net/netchan-fragments.test.ts`
- Write large reliable message (>1024 bytes)
- Transmit in fragments
- Receive and reassemble
- Verify complete message intact

**Reference Lines**: `full/qcommon/net_chan.c:104-178`

#### Task 1.6: Add Timeout and Keepalive (COMPLETE)
**File**: `packages/shared/src/net/netchan.ts`
**Reference**: `full/server/sv_main.c` (timeout logic)

- [x] **1.6.1** Create `needsKeepalive(currentTime: number): boolean` method
  - Check if `currentTime - lastSent > 1000ms`
  - Return true if need to send keepalive packet
  - Prevents router timeout

- [x] **1.6.2** Create `isTimedOut(currentTime: number, timeoutMs: number): boolean` method
  - Check if `currentTime - lastReceived > timeoutMs`
  - Default timeout 30000ms (30 seconds)
  - Used by server to disconnect idle clients

- [x] **1.6.3** Update transmit/process to track times
  - Already implemented in 1.2.1 and 1.3.1
  - Verify timestamps updated correctly

**Test Case**: Unit test in `packages/shared/tests/net/netchan-timeout.test.ts`
- Create NetChan
- Advance time without receiving
- Verify isTimedOut returns true after 30s
- Verify needsKeepalive returns true after 1s

**Reference**: Timeout patterns in server code

---

### Phase 2: Server NetChan Integration (COMPLETE)

**Estimated Time**: 1 week
**Dependencies**: Phase 1 complete (NetChan exists)

#### Task 2.1: Add NetChan to Server Client State (COMPLETE)
**File**: `packages/server/src/client.ts`
**Reference**: `full/server/server.h:108-145` (client_t struct)

- [x] **2.1.1** Import NetChan class
  - Add `import { NetChan } from '@quake2ts/shared'`

- [x] **2.1.2** Add `netchan: NetChan` to `Client` interface
  - Initialize in `createClient` function
  - Pass appropriate qport

- [x] **2.1.3** Remove direct WebSocket references
  - Replace `client.driver.send(data)` with `client.netchan.transmit(data)`
  - Socket only used by NetChan internally

**Test Case**: Update `packages/server/tests/client.test.ts`
- Create client
- Verify netchan initialized
- Test transmit goes through netchan
- Verify sequence tracking works

**Reference Lines**: `full/server/server.h:108-145`

#### Task 2.2: Update SV_SendClientMessages (COMPLETE)
**File**: `packages/server/src/dedicated.ts` around lines 380-420
**Reference**: `full/server/sv_send.c:500-570` (SV_SendClientMessages)

- [x] **2.2.1** Separate reliable and unreliable buffers (Line 650)
  - Create `reliableWriter = new BinaryWriter()` per client
  - Create `unreliableWriter = new BinaryWriter()` per client
  - Reliable: configstrings, prints, critical events
  - Unreliable: entity updates, temp entities

- [x] **2.2.2** Queue reliable messages instead of immediate send (Line 396)
  - Configstrings go to `client.netchan.writeReliableString()`
  - Critical events go to reliable channel
  - Don't send immediately, let NetChan manage

- [x] **2.2.3** Update frame sending logic
  - Build entity updates in unreliable buffer
  - Call `client.netchan.transmit(unreliableData)`
  - NetChan combines reliable + unreliable automatically
  - Send resulting packet via WebSocket

- [x] **2.2.4** Handle transmission failures
  - Check `client.netchan.canSendReliable()` before queuing more
  - If false, reliable queue is full (waiting for ack)
  - Don't add more reliable data until space available

**Test Case**: Update `packages/server/tests/dedicated.test.ts`
- Mock client with NetChan
- Send configstring (reliable)
- Send entity update (unreliable)
- Verify both in same packet
- Verify reliable persists until acked

**Reference Lines**: `full/server/sv_send.c:500-570`

#### Task 2.3: Update SV_ReadPackets to use NetChan (COMPLETE)
**File**: `packages/server/src/dedicated.ts` around lines 440-480
**Reference**: `full/server/sv_main.c:390-450` (SV_ReadPackets)

- [x] **2.3.1** Process incoming packets through NetChan
  - When WebSocket receives data, call `client.netchan.process(data)`
  - Returns processed message (unreliable portion)
  - Returns null if duplicate/invalid

- [x] **2.3.2** Handle NetChan validation
  - If process returns null, discard packet
  - If process returns data, parse as ClientCommand
  - NetChan handles sequence validation automatically

- [x] **2.3.3** Update client timeout logic (Line 326 - ALREADY SOLVED but verify)
  - Use `client.netchan.isTimedOut(currentTime, 30000)`
  - Disconnect client if true
  - Send timeout message before disconnect (optional)

**Test Case**: Update `packages/server/tests/dedicated.test.ts`
- Send valid packet
- Verify processed correctly
- Send duplicate packet
- Verify discarded
- Send out-of-order packet
- Verify handled correctly

**Reference Lines**: `full/server/sv_main.c:390-450`

#### Task 2.4: Implement Command Rate Limiting (COMPLETE)
**File**: `packages/server/src/dedicated.ts` around line 459
**Reference**: `full/server/sv_user.c:370-420` (command processing)

- [x] **2.4.1** Add command queue to client state
  - Add `commandQueue: UserCommand[]` to Client interface
  - Add `lastCommandTime: number` for rate tracking
  - Add `commandCount: number` for rate limiting

- [x] **2.4.2** Implement rate limiting logic
  - Check `currentTime - lastCommandTime`
  - Allow max 40 commands per second (25ms min interval)
  - If exceeded, drop command and log warning
  - Increment `commandCount` for ban tracking

- [x] **2.4.3** Process commands from queue
  - In `SV_RunGameFrame`, process queued commands
  - Apply rate limit per client
  - Call `ge->ClientThink()` with valid commands only

- [x] **2.4.4** Add flood protection
  - If `commandCount > 200` in 1 second window
  - Kick client with "command overflow" message
  - Log incident for admin review

**Test Case**: Unit test in `packages/server/tests/unit/rate-limiting.test.ts`
- Send commands within rate limit
- Verify all processed
- Send excessive commands (>40/sec)
- Verify some dropped
- Send flood (>200/sec)
- Verify client kicked

**Reference Lines**: `full/server/sv_user.c:370-420`

#### Task 2.5: Add CRC Checksums for Commands (COMPLETE)
**File**: `packages/server/src/protocol.ts` and `packages/client/src/net/connection.ts`
**Reference**: `full/qcommon/crc.c` (CRC calculation)

- [x] **2.5.1** Create CRC8 implementation
  - File: `packages/shared/src/protocol/crc.ts`
  - Implement `crc8(data: Uint8Array): number`
  - Use standard CRC8 table (reference from crc.c)

- [x] **2.5.2** Update client to send CRC (Not applicable to server side task, pending client side)
  - In `MultiplayerConnection.sendCommand`
  - Calculate CRC8 of last server frame received
  - Write CRC to `clc_move` packet (replace placeholder 0)

- [x] **2.5.3** Update server to verify CRC
  - In `ClientMessageParser.parseMove`
  - Read CRC from packet
  - Verify CRC matches expected
  - Drop command if CRC mismatch (potential tamper)

**Test Case**: Unit test in `packages/shared/tests/protocol/crc.test.ts`
- Test CRC8 calculation
- Verify matches reference implementation
- Test command with valid CRC accepted
- Test command with invalid CRC rejected

**Reference File**: `full/qcommon/crc.c`

---

### Phase 3: Client NetChan Integration (Depends on Phase 1)

**Estimated Time**: 1 week
**Dependencies**: Phase 1 complete (NetChan exists)

#### Task 3.1: Add NetChan to MultiplayerConnection
**File**: `packages/client/src/net/connection.ts`
**Reference**: `full/client/client.h:150-200` (client_static_t)

- [ ] **3.1.1** Import and create NetChan instance
  - Add `import { NetChan } from '@quake2ts/shared'`
  - Add `private netchan: NetChan` to MultiplayerConnection
  - Initialize in constructor with random qport

- [ ] **3.1.2** Update sendCommand to use NetChan (replaces Lines 129-131)
  - Remove placeholder sequence numbers (0)
  - Build command in BinaryWriter
  - Call `this.netchan.transmit(commandData)`
  - Send resulting packet via `this.driver.send()`

- [ ] **3.1.3** Update handleMessage to use NetChan (replaces Lines 166-168)
  - Remove manual sequence parsing
  - Call `this.netchan.process(data)`
  - If returns null, discard (duplicate/invalid)
  - If returns data, parse as ServerCommand

**Test Case**: Update `packages/client/tests/net/connection.test.ts`
- Create MultiplayerConnection
- Send command
- Verify netchan used (sequence tracking)
- Receive server message
- Verify netchan processes it
- Test duplicate detection

**Reference Lines**: `full/client/client.h:150-200`

#### Task 3.2: Implement Client-Side Prediction with Command History
**File**: `packages/cgame/src/prediction.ts` (ClientPrediction class)
**Reference**: `full/client/cl_pred.c:100-200` (CL_PredictMovement)

- [ ] **3.2.1** Enhance command buffering (already exists but verify)
  - `ClientPrediction` stores last 64 commands (CMD_BACKUP)
  - Each command tagged with sequence number
  - Used for prediction rewind/replay

- [ ] **3.2.2** Implement prediction reconciliation
  - When `svc_frame` arrives, extract server's player state
  - Compare to predicted state at that sequence
  - If mismatch detected (>10 units difference):
    * Rewind to server state
    * Replay all commands since that sequence
    * Update client position to reconciled state

- [ ] **3.2.3** Add prediction error smoothing
  - If error small (<5 units), smooth over 100ms
  - If error large (>10 units), snap immediately
  - Reduces visual "stuttering" on corrections

- [ ] **3.2.4** Wire prediction to frame updates
  - In `MultiplayerConnection.onFrame`, extract player state
  - Pass to `ClientPrediction.reconcile(serverState, serverFrame)`
  - Apply reconciliation result to client view

**Test Case**: Unit test in `packages/cgame/tests/prediction-reconciliation.test.ts`
- Predict 5 frames ahead
- Receive server state at frame 3 with different position
- Verify rewind to frame 3
- Verify replay frames 4-5
- Verify final position corrected

**Reference Lines**: `full/client/cl_pred.c:100-200`

#### Task 3.3: Add Prediction CVar Support
**File**: `packages/cgame/src/index.ts`
**Reference**: `full/client/cl_pred.c:30-50` (cl_predict cvar)

- [ ] **3.3.1** Implement `cg_predict` cvar
  - Add to CGame cvar registration
  - Default value: 1 (enabled)
  - When 0, disable prediction (use server state directly)

- [ ] **3.3.2** Implement `cg_showmiss` cvar
  - Default value: 0 (disabled)
  - When 1, log prediction errors to console
  - Format: "prediction error: X units"

- [ ] **3.3.3** Wire cvars to prediction system
  - In Pmove call, check `cg_predict`
  - If disabled, return server state unchanged
  - If `cg_showmiss` enabled, log reconciliation events

**Test Case**: Unit test in `packages/cgame/tests/prediction-cvars.test.ts`
- Set `cg_predict` to 0
- Verify prediction disabled
- Set `cg_predict` to 1
- Verify prediction enabled
- Set `cg_showmiss` to 1
- Verify errors logged

**Reference**: CVar patterns from cl_pred.c

---

### Phase 4: End-to-End Integration Testing (Depends on Phases 1-3)

**Estimated Time**: 1-2 weeks
**Dependencies**: Server and client NetChan integrated

#### Task 4.1: Create E2E Test Infrastructure
**File**: Create `packages/e2e-tests` package
**Reference**: Standard E2E testing patterns (Playwright/Puppeteer)

- [ ] **4.1.1** Set up E2E test package
  - Create `packages/e2e-tests/package.json`
  - Add Playwright as dependency
  - Configure for headless browser testing
  - Add scripts for running E2E tests

- [ ] **4.1.2** Create test server helper
  - File: `packages/e2e-tests/helpers/testServer.ts`
  - Create `startTestServer(port: number): Promise<DedicatedServer>`
  - Load minimal test map
  - Return server instance for control

- [ ] **4.1.3** Create test client helper
  - File: `packages/e2e-tests/helpers/testClient.ts`
  - Create `launchBrowserClient(serverUrl: string): Promise<Page>`
  - Use Playwright to launch browser
  - Load client application
  - Return page handle for control

- [ ] **4.1.4** Add cleanup utilities
  - `stopServer(server: DedicatedServer): Promise<void>`
  - `closeBrowser(page: Page): Promise<void>`
  - Ensure clean shutdown in all cases

**Test Case**: Smoke test in `packages/e2e-tests/smoke.test.ts`
- Start test server
- Launch browser client
- Verify both start without errors
- Clean up both

**Reference**: Standard E2E testing setup

#### Task 4.2: Test Basic Connection
**File**: `packages/e2e-tests/connection.test.ts`
**Reference**: Connection flow validation

- [ ] **4.2.1** Test client can connect to server
  - Start server on localhost:27910
  - Launch browser client
  - Client initiates connection
  - Verify `onServerData` callback fires
  - Verify `ConnectionState.Connected` reached

- [ ] **4.2.2** Test handshake completes
  - After connection, verify `svc_serverdata` received
  - Verify configstrings received
  - Verify baselines received
  - Verify `clc_stringcmd("begin")` sent by client
  - Verify client reaches `ConnectionState.Active`

- [ ] **4.2.3** Test disconnection
  - After active, client disconnects
  - Verify server receives disconnect
  - Verify server cleans up client state
  - Verify client returns to menu

**Test Case**: Full connection E2E test
- Verifies real WebSocket communication
- No mocking of any components
- Tests complete handshake protocol

**Reference**: Connection flow from Section 13 docs

#### Task 4.3: Test Command Flow
**File**: `packages/e2e-tests/commands.test.ts`
**Reference**: User command processing

- [ ] **4.3.1** Test client sends commands
  - Client in active state
  - Simulate user input (movement)
  - Verify `clc_move` packets sent
  - Verify NetChan sequence numbers increment

- [ ] **4.3.2** Test server receives commands
  - Server receives `clc_move` packets
  - Verify NetChan processes them
  - Verify `UserCommand` parsed
  - Verify `ge->ClientThink` called with command

- [ ] **4.3.3** Test command rate limiting
  - Send excessive commands (>40/sec)
  - Verify server drops excess
  - Verify no crash or overflow

**Test Case**: Command flow E2E test
- Verifies client → server command path
- Verifies rate limiting works
- Verifies game logic receives commands

**Reference**: Command processing flow

#### Task 4.4: Test Entity Synchronization
**File**: `packages/e2e-tests/entities.test.ts`
**Reference**: Entity updates and rendering

- [ ] **4.4.1** Test server sends entity updates
  - Server running game simulation
  - Entities move/spawn/die
  - Verify `svc_frame` packets sent
  - Verify entity deltas in packets

- [ ] **4.4.2** Test client receives entity updates
  - Client receives `svc_frame` packets
  - Verify NetChan processes them
  - Verify entities parsed from frame
  - Verify client's entity map updated

- [ ] **4.4.3** Test entity rendering
  - Client has updated entities
  - Call client render
  - Verify entities passed to renderer
  - Visual check: entities visible (screenshot)

**Test Case**: Entity sync E2E test
- Spawn entity on server
- Verify client sees it
- Move entity on server
- Verify client sees updated position
- Remove entity on server
- Verify client removes it

**Reference**: Entity synchronization flow

#### Task 4.5: Test Prediction and Reconciliation
**File**: `packages/e2e-tests/prediction.test.ts`
**Reference**: Client-side prediction flow

- [ ] **4.5.1** Test prediction runs locally
  - Client sends command
  - Verify client predicts immediately (no wait for server)
  - Verify player moves locally before server response
  - Measure input lag (<16ms)

- [ ] **4.5.2** Test reconciliation on match
  - Client predicts position
  - Server confirms same position
  - Verify no correction needed
  - Position stays smooth

- [ ] **4.5.3** Test reconciliation on mismatch
  - Client predicts position
  - Server returns different position (simulated collision)
  - Verify client rewinds and replays
  - Verify position corrected
  - Verify smooth transition (<100ms)

**Test Case**: Prediction E2E test
- Test with 0ms latency (prediction matches server)
- Test with 100ms latency (reconciliation needed)
- Test with packet loss (prediction diverges, then corrects)

**Reference**: Prediction system design

#### Task 4.6: Test Multi-Client Scenarios
**File**: `packages/e2e-tests/multi-client.test.ts`
**Reference**: Multiple players interacting

- [ ] **4.6.1** Test two clients connect
  - Start server
  - Launch client 1, connect
  - Launch client 2, connect
  - Verify both reach active state

- [ ] **4.6.2** Test clients see each other
  - Client 1's player entity exists on server
  - Verify client 2 receives entity in frame
  - Verify client 2 renders client 1's player
  - Visual check: both players visible

- [ ] **4.6.3** Test interaction
  - Client 1 moves
  - Verify client 2 sees movement
  - Client 2 shoots
  - Verify client 1 sees projectile/effects

**Test Case**: Multi-client E2E test
- Requires two browser instances
- Verifies entity replication to all clients
- Verifies server broadcasts correctly

**Reference**: Multi-player design

---

### Phase 5: Performance and Stress Testing (Depends on Phase 4)

**Estimated Time**: 1 week
**Dependencies**: Basic E2E tests passing

#### Task 5.1: Latency Testing
**File**: `packages/e2e-tests/latency.test.ts`
**Reference**: Network simulation

- [ ] **5.1.1** Add artificial latency to test server
  - Implement `delayPackets(ms: number)` helper
  - Delay all incoming/outgoing packets by N ms
  - Test with 50ms, 100ms, 200ms latency

- [ ] **5.1.2** Verify prediction handles latency
  - With 100ms latency, movement still feels responsive
  - Reconciliation happens smoothly
  - No visible "rubber-banding" (visual check)

- [ ] **5.1.3** Test maximum playable latency
  - Test with 300ms, 500ms, 1000ms latency
  - Determine threshold for playability
  - Document acceptable latency range

**Test Case**: Latency stress test
- Incrementally increase latency
- Verify gameplay remains smooth up to threshold
- Measure reconciliation accuracy

#### Task 5.2: Packet Loss Testing
**File**: `packages/e2e-tests/packet-loss.test.ts`
**Reference**: Network reliability

- [ ] **5.2.1** Add packet loss simulation
  - Implement `dropPackets(percentage: number)` helper
  - Randomly drop N% of packets
  - Test with 5%, 10%, 20% loss

- [ ] **5.2.2** Verify NetChan handles loss
  - Reliable messages retransmitted automatically
  - Configstrings always arrive
  - Unreliable messages dropped gracefully (entities)

- [ ] **5.2.3** Test recovery from loss
  - 10% packet loss for 30 seconds
  - Verify game still playable
  - Verify no disconnect

**Test Case**: Packet loss stress test
- Simulate lossy network
- Verify NetChan reliability
- Verify acceptable gameplay

#### Task 5.3: Multi-Client Load Testing
**File**: `packages/e2e-tests/load.test.ts`
**Reference**: Server capacity

- [ ] **5.3.1** Test server with multiple clients
  - Connect 2, 4, 8, 16 clients sequentially
  - Measure server CPU usage
  - Measure memory usage
  - Measure frame time consistency

- [ ] **5.3.2** Verify server performance
  - Server maintains 10Hz with 16 clients
  - Frame time <100ms per frame
  - Memory stable (no leaks)

- [ ] **5.3.3** Test client performance
  - Each client renders at 60 FPS
  - Input lag <16ms per client
  - No performance degradation over time

**Test Case**: Load stress test
- Start with 1 client, add more incrementally
- Monitor performance metrics
- Identify bottlenecks

---

### Phase 6: Optional Enhancements (OPTIONAL - External Dependencies)

**Estimated Time**: Variable
**Dependencies**: Phase 4 complete

#### Task 6.1: Test with Real Quake II Servers (REQUIRES EXTERNAL SERVER)
**Reference**: Compatibility testing

- [ ] **6.1.1** Set up Quake II Rerelease dedicated server
  - Install Quake II Rerelease on test machine
  - Start dedicated server
  - Configure for test

- [ ] **6.1.2** Attempt connection from browser client
  - Point client to external server
  - Attempt handshake
  - Document compatibility issues

- [ ] **6.1.3** Fix compatibility issues (if found)
  - Protocol differences
  - Message format issues
  - NetChan incompatibilities

**Note**: This task requires external Quake II server - optional validation only

#### Task 6.2: Implement Download System (REQUIRES MAP FILES)
**Reference**: `full/client/cl_parse.c:200-270` (svc_download)

- [ ] **6.2.1** Implement `svc_download` handling
  - Client requests missing files (maps, models)
  - Server sends file in chunks
  - Client reassembles and loads

- [ ] **6.2.2** Test with custom maps
  - Server has map client doesn't
  - Verify download initiates
  - Verify client loads map after download

**Note**: Complex feature, optional for basic multiplayer

---

## Success Criteria

**Phase 1 Complete When:**
- ✅ NetChan class exists with full reliability
- ✅ Sequence tracking works
- ✅ Reliable message retransmission works
- ✅ All unit tests pass

**Phase 2 Complete When:**
- ✅ Server uses NetChan for all client communication
- ✅ Reliable/unreliable separation working (TODO 650 fixed)
- ✅ Reliable queuing working (TODO 396 fixed)
- ✅ Command rate limiting working (TODO 459 fixed)
- ✅ All tests pass

**Phase 3 Complete When:**
- ✅ Client uses NetChan for server communication
- ✅ Client-side prediction working
- ✅ Prediction reconciliation working
- ✅ CVars implemented
- ✅ All tests pass

**Phase 4 Complete When:**
- ✅ Can start real dedicated server
- ✅ Browser client can connect
- ✅ Handshake completes
- ✅ Commands flow bidirectionally
- ✅ Entity updates render correctly
- ✅ Two clients can see each other
- ✅ All E2E tests pass

**Phase 5 Complete When:**
- ✅ Works with 100ms+ latency
- ✅ Works with 10% packet loss
- ✅ Server handles 16 clients at 10Hz
- ✅ Performance acceptable

---

## Dependencies Summary

**Phase 1**: No dependencies - reference code exists
**Phase 2**: Requires Phase 1 complete (NetChan class exists)
**Phase 3**: Requires Phase 1 complete (NetChan class exists)
**Phase 4**: Requires Phases 1, 2, 3 complete (both sides working)
**Phase 5**: Requires Phase 4 complete (basic E2E working)
**Phase 6**: Optional - requires external resources

**Critical Path**: Phase 1 → Phase 2 & 3 (parallel) → Phase 4 → Phase 5

**No External Dependencies Until Phase 6** - All core multiplayer can be implemented and tested with existing code.
