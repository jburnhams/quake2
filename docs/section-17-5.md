# Section 17.5: Multiplayer Support

**Goal**: Enable multiplayer client functionality and optional server hosting.

---

## 5.1 Multiplayer Client

### 5.1.1 Server Connection API
- [x] Expose `connectToServer(address: string, port: number): Promise<void>`
- [x] Add connection state events: connecting, challenge, connected, disconnected
- [x] Add method `disconnect(): void` with graceful cleanup
- [x] Add event `onConnectionStateChange?: (state: ConnectionState) => void`
- [x] Add event `onConnectionError?: (error: Error) => void`
- [x] Add latency/ping reporting: `getPing(): number`

### 5.1.2 Client Prediction and Interpolation
- [ ] Ensure client prediction works correctly in multiplayer
- [ ] Add configurable prediction error tolerance
- [ ] Implement entity interpolation for smooth remote player movement
- [ ] Add lag compensation for weapon firing
- [ ] Expose `setPredictionEnabled(enabled: boolean): void` for debugging

### 5.1.3 Server Browser (optional library support)
- [ ] Add method `queryServerInfo(address: string): Promise<ServerInfo>` for server ping
- [ ] Return: map name, player count, max players, game mode, hostname
- [ ] Add method `getPlayerList(): PlayerInfo[]` for scoreboard
- [ ] Return: name, score, ping, team (if applicable)

---

## 5.2 Deathmatch Features

### 5.2.1 Deathmatch Game Rules
- [ ] Implement player respawning at spawn points
- [ ] Implement frag scoring and leaderboard updates
- [ ] Implement weapon/item respawn timers (DM vs single-player)
- [ ] Implement self-damage (rocket jumping, grenade jumping)
- [ ] Add telefrag detection and scoring

### 5.2.2 Scoreboard API
- [ ] Add method `getScoreboard(): ScoreboardData` returning sorted player list
- [ ] Return: player name, frags, deaths, ping
- [ ] Add event `onScoreboardUpdate?: (scoreboard: ScoreboardData) => void`
- [ ] Support team-based modes (future: CTF)

### 5.2.3 Chat System
- [ ] Add method `sendChatMessage(message: string): void`
- [ ] Add event `onChatMessage?: (player: string, message: string) => void`
- [ ] Support team chat vs global chat
- [ ] Add chat history retrieval

---

## 5.3 Server Hosting (WebRTC or WebSocket)

### 5.3.1 Server API
- [ ] Expose `createServer(options: ServerOptions): DedicatedServer`
- [ ] Options: map name, max players, deathmatch mode, port
- [ ] Add method `startServer(): Promise<void>`
- [ ] Add method `stopServer(): void`
- [ ] Add method `kickPlayer(clientId: number): void`
- [ ] Add method `changeMap(mapName: string): void`

### 5.3.2 Server Events
- [ ] Add event `onClientConnected?: (clientId: number, name: string) => void`
- [ ] Add event `onClientDisconnected?: (clientId: number) => void`
- [ ] Add event `onServerError?: (error: Error) => void`
- [ ] Add method `getConnectedClients(): ClientInfo[]`

### 5.3.3 Network Transport
- [ ] Support WebSocket transport (already implemented)
- [ ] Add WebRTC peer-to-peer transport option for low-latency
- [ ] Add method `setTransport(transport: NetworkTransport): void`
- [ ] Handle reconnection and network failures gracefully

---

## 5.4 Cooperative Play

### 5.4.1 Coop Game Rules
- [ ] Implement shared level progression (no respawn until level restart)
- [ ] Implement monster scaling based on player count
- [ ] Implement friendly fire toggle
- [ ] Synchronize trigger activation across clients
- [ ] Implement shared objectives (keys, mission items)

### 5.4.2 Player Synchronization
- [ ] Ensure all player entities are synchronized correctly
- [ ] Implement player model selection
- [ ] Add player name tags in 3D space
- [ ] Synchronize player deaths and respawns
