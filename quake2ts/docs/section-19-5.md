# Section 19-5: Server/Network Utilities Migration

**Work Stream:** Server-side test utilities
**Priority:** MEDIUM - Server testing functionality
**Dependencies:** Section 19-1 (network mocks), Section 19-3 (game utilities)
**Parallel Status:** Can start in parallel with Section 19-4

---

## Overview

This section covers migration of server-specific test utilities including network transport mocks, server state management, connection handling, and multiplayer simulation utilities.

---

## Tasks

### 1. Migrate Network Transport Mocks (HIGH PRIORITY)

**Status:** Complete
**Dependencies:** Section 19-1 Task 2 (network mocks)

- [x] **1.1** Create `test-utils/src/server/mocks/transport.ts` file

- [x] **1.2** Migrate `MockTransport` class from `server/tests/mocks/transport.ts`
  - Class implementing network transport interface (~35 lines)
  - Methods: `send()`, `receive()`, `close()`, `isConnected()`
  - Properties: `address`, `port`, `sentMessages`, `receivedMessages`

- [x] **1.3** Add `createMockTransport()` factory
  - Signature: `createMockTransport(address?: string, port?: number, overrides?: Partial<Transport>): MockTransport`

- [x] **1.4** Add `createMockUDPSocket()` factory
  - Signature: `createMockUDPSocket(overrides?: Partial<UDPSocket>): UDPSocket`
  - Mock UDP socket for network layer testing

- [x] **1.5** Add `createMockNetworkAddress()` factory
  - Signature: `createMockNetworkAddress(ip?: string, port?: number): NetworkAddress`

- [x] **1.6** Update imports in `server/tests/` directory
  - Replace `import { MockTransport } from './mocks/transport'`
  - With `import { createMockTransport } from '@quake2ts/test-utils'`
  - Estimated files: ~6

- [x] **1.7** Delete `server/tests/mocks/transport.ts` after migration

---

### 2. Create Server State Management Mocks (HIGH PRIORITY)

**Status:** Complete
**Dependencies:** Section 19-3 Task 2 (game context helpers)

- [x] **2.1** Create `test-utils/src/server/mocks/state.ts` file

- [x] **2.2** Add `createMockServerState()` factory
  - Signature: `createMockServerState(overrides?: Partial<ServerState>): ServerState`
  - Include: frameNum, time, clients, entities, gameState

- [x] **2.3** Add `createMockServer()` factory
  - Signature: `createMockServer(overrides?: Partial<Server>): Server`
  - Methods: `start()`, `stop()`, `tick()`, `broadcast()`, `getClient()`

- [x] **2.4** Add `createMockServerClient()` factory
  - Signature: `createMockServerClient(clientNum: number, overrides?: Partial<ServerClient>): ServerClient`
  - Include: clientNum, state, entity, netchan, lastMessage

- [x] **2.5** Add `createMockGameState()` factory
  - Signature: `createMockGameState(overrides?: Partial<GameState>): GameState`
  - Include: levelName, time, entities, clients

- [x] **2.6** Cleanup server state tests in `server/tests/state/` directory
  - Replace inline server mocks
  - Estimated files: ~8

---

### 3. Create Connection/Handshake Mocks (MEDIUM PRIORITY)

**Status:** In Progress
**Dependencies:** Task 1 (transport mocks)

- [x] **3.1** Create `test-utils/src/server/mocks/connection.ts` file

- [x] **3.2** Add `createMockConnection()` factory
  - Signature: `createMockConnection(state?: ConnectionState, overrides?: Partial<Connection>): Connection`
  - Include: state, address, challenge, userinfo

- [x] **3.3** Add `createMockHandshake()` factory
  - Signature: `createMockHandshake(stage?: HandshakeStage): Handshake`
  - Stages: challenge, connect, info, active

- [x] **3.4** Add `simulateHandshake()` helper
  - Signature: `simulateHandshake(client: MockConnection, server: MockServer): Promise<boolean>`
  - Simulate complete handshake process

- [x] **3.5** Add `createMockUserInfo()` factory
  - Signature: `createMockUserInfo(overrides?: Partial<UserInfo>): UserInfo`
  - Include: name, skin, model, fov, hand

- [x] **3.6** Cleanup connection tests in `server/tests/connection/` directory
  - Replace inline connection mocks
  - Estimated files: ~6

---

### 4. Create Multiplayer Simulation Utilities (MEDIUM PRIORITY)

**Status:** In Progress
**Dependencies:** Task 2 (server state), Section 19-3 Task 1 (entity factories)

- [x] **4.1** Create `test-utils/src/server/helpers/multiplayer.ts` file

- [x] **4.2** Add `createMultiplayerTestScenario()` helper
  - Signature: `createMultiplayerTestScenario(numPlayers?: number): MultiplayerScenario`
  - Include: server, connected clients, player entities

- [x] **4.3** Add `simulatePlayerJoin()` helper
  - Signature: `simulatePlayerJoin(server: MockServer, userInfo?: UserInfo): Promise<ServerClient>`
  - Simulate complete player connection and spawn

- [x] **4.4** Add `simulatePlayerLeave()` helper
  - Signature: `simulatePlayerLeave(server: MockServer, clientNum: number): void`
  - Simulate player disconnect and cleanup

- [x] **4.5** Add `simulateServerTick()` helper
  - Signature: `simulateServerTick(server: MockServer, deltaTime?: number): void`
  - Simulate one server frame update

- [x] **4.6** Add `simulatePlayerInput()` helper
  - Signature: `simulatePlayerInput(client: ServerClient, input: PlayerInput): void`
  - Inject player input into server simulation

- [ ] **4.7** Cleanup multiplayer tests in `server/tests/multiplayer/` directory
  - Replace inline simulation code
  - Estimated files: ~5

---

### 5. Create Client Snapshot Utilities (MEDIUM PRIORITY)

**Status:** In Progress
**Dependencies:** Task 2 (server state), Section 19-3 Task 8 (game state factories)

- [x] **5.1** Create `test-utils/src/server/helpers/snapshot.ts` file

- [x] **5.2** Add `createServerSnapshot()` helper
  - Signature: `createServerSnapshot(serverState: ServerState, clientNum: number): Snapshot`
  - Generate client-specific snapshot from server state

- [x] **5.3** Add `createDeltaSnapshot()` helper
  - Signature: `createDeltaSnapshot(oldSnapshot: Snapshot, newSnapshot: Snapshot): DeltaSnapshot`
  - Calculate delta between snapshots

- [x] **5.4** Add `verifySnapshotConsistency()` helper
  - Signature: `verifySnapshotConsistency(snapshots: Snapshot[]): ConsistencyReport`
  - Verify snapshot sequence is valid

- [x] **5.5** Add `simulateSnapshotDelivery()` helper
  - Signature: `simulateSnapshotDelivery(snapshot: Snapshot, reliability?: number): Promise<Snapshot | null>`
  - Simulate network delivery with packet loss

- [ ] **5.6** Cleanup snapshot tests in `server/tests/snapshot/` directory
  - Replace inline snapshot creation
  - Estimated files: ~6

---

### 6. Create Server Command/RCon Mocks (LOW PRIORITY)

**Status:** In Progress
**Dependencies:** None

- [x] **6.1** Create `test-utils/src/server/mocks/commands.ts` file

- [x] **6.2** Add `createMockServerConsole()` factory
  - Signature: `createMockServerConsole(overrides?: Partial<ServerConsole>): ServerConsole`
  - Methods: `exec()`, `print()`, `broadcast()`

- [x] **6.3** Add `createMockRConClient()` factory
  - Signature: `createMockRConClient(password?: string): RConClient`
  - Simulate remote console connection

- [x] **6.4** Add `simulateServerCommand()` helper
  - Signature: `simulateServerCommand(server: MockServer, command: string): string`
  - Execute server command and return output

- [ ] **6.5** Cleanup server command tests in `server/tests/commands/` directory
  - Estimated files: ~4

---

### 7. Create Bandwidth/Rate Limiting Utilities (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Task 1 (transport mocks)

- [ ] **7.1** Create `test-utils/src/server/helpers/bandwidth.ts` file

- [ ] **7.2** Add `createMockRateLimiter()` factory
  - Signature: `createMockRateLimiter(bytesPerSecond: number): RateLimiter`

- [ ] **7.3** Add `simulateBandwidthLimit()` helper
  - Signature: `simulateBandwidthLimit(messages: Message[], bandwidth: number): Message[]`
  - Filter messages based on bandwidth constraints

- [ ] **7.4** Add `measureSnapshotSize()` helper
  - Signature: `measureSnapshotSize(snapshot: Snapshot): number`
  - Calculate snapshot size in bytes

- [ ] **7.5** Add `createBandwidthTestScenario()` helper
  - Signature: `createBandwidthTestScenario(bandwidth: number, numClients: number): BandwidthScenario`

---

### 8. Create Master Server Mocks (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Task 1 (transport mocks)

- [ ] **8.1** Create `test-utils/src/server/mocks/master.ts` file

- [ ] **8.2** Add `createMockMasterServer()` factory
  - Signature: `createMockMasterServer(overrides?: Partial<MasterServer>): MasterServer`
  - Methods: `registerServer()`, `heartbeat()`, `getServerList()`

- [ ] **8.3** Add `createMockServerInfo()` factory
  - Signature: `createMockServerInfo(overrides?: Partial<ServerInfo>): ServerInfo`
  - Include: name, map, players, maxPlayers, gametype, version

- [ ] **8.4** Add `simulateServerRegistration()` helper
  - Signature: `simulateServerRegistration(server: MockServer, master: MockMasterServer): Promise<boolean>`

---

### 9. Documentation and Exports (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Tasks 1-8

- [ ] **9.1** Add JSDoc comments to all server utilities
  - Include usage examples for multiplayer simulation, transport mocking

- [ ] **9.2** Update `test-utils/README.md` with server utilities section
  - Document: transport mocks, server state, multiplayer helpers, snapshot utilities

- [ ] **9.3** Verify all server utilities exported from `test-utils/src/index.ts`
  - Organized by category: `server/mocks/*`, `server/helpers/*`

- [ ] **9.4** Add TypeScript type exports
  - Export all mock types and helper interfaces

---

## Summary

**Total Tasks:** 9
**Total Subtasks:** 52
**Estimated Impact:** ~40+ test files updated, ~400 lines of new utilities
**Critical Path:** Task 1 (transport mocks) blocks Task 3; Task 2 (server state) blocks Tasks 4-5
**Parallel Opportunities:** Tasks 6-8 can run in parallel with others after Task 1; Tasks 4-5 can run in parallel after Task 2
