# Section 17: Quake2ts Library Completion Tasks

## Overview

This document outlines the remaining work required to make the quake2ts library ready for use by a web application. Tasks are organized progressively from simple asset viewing to full multiplayer gameplay. Each phase builds on the previous, allowing incremental development and testing.

The web application will provide UI and file I/O, while the library handles all game logic, rendering, and simulation. The library should expose clean APIs for each feature tier.

---

## Phase 1: Basic Asset Viewing

**Goal**: Enable web app to load PAK files and browse their contents, load BSP maps and display them with basic camera control.

### 1.1 PAK File Browser API

#### 1.1.1 VirtualFileSystem Enhancements
- [x] Add method `listDirectory(path: string): Promise<FileInfo[]>` to enumerate directory contents
- [x] Add method `getFileMetadata(path: string): FileMetadata` returning size, offset, PAK source
- [x] Add method `getDirectoryTree(): DirectoryNode` for hierarchical browsing
- [x] Add filtering by extension: `listByExtension(extensions: string[]): FileInfo[]`
- [x] Add method `searchFiles(pattern: RegExp): FileInfo[]` for text search
- [x] Add method `getPakInfo(): PakInfo[]` returning metadata for all mounted PAKs (filename, entry count, total size)

#### 1.1.2 File Type Detection
- [x] Implement `detectFileType(path: string): FileType` using magic bytes and extensions
- [x] Support detection for: BSP, MD2, MD3, WAL, PCX, TGA, WAV, OGG, TXT, CFG, DEM
- [x] Add method `isTextFile(path: string): boolean` for viewer selection
- [x] Add method `isBinaryFile(path: string): boolean`

#### 1.1.3 Asset Preview API
- [x] Create `AssetPreviewGenerator` class for generating thumbnails
- [ ] Implement `generateTextureThumbnail(path: string, size: number): Promise<ImageData>` for WAL/PCX/TGA
- [ ] Implement `generateModelThumbnail(path: string, size: number): Promise<ImageData>` for MD2/MD3
- [x] Implement `getMapBounds(mapName: string): Promise<BoundingBox>` for map overview
- [x] Add method `extractMapScreenshot(mapName: string): Promise<ImageData | null>` from embedded levelshots

#### 1.1.4 Text File Reading
- [x] Add method `readTextFile(path: string): Promise<string>` with UTF-8/ASCII fallback
- [x] Add method `readBinaryFile(path: string): Promise<Uint8Array>` for raw access
- [ ] Handle large file streaming for web app progress display

### 1.2 Map Viewer API

#### 1.2.1 Headless Rendering Mode
- [ ] Create `RenderMode` enum: `WebGL` | `Headless`
- [ ] Implement headless BSP loading: parse geometry without GPU upload
- [ ] Add `getMapGeometry(mapName: string): Promise<MapGeometry>` returning vertices, indices, bounds
- [ ] Add `getMapTextures(mapName: string): Promise<TextureReference[]>` listing required textures
- [ ] Add `getMapLightmaps(mapName: string): Promise<LightmapData[]>` for custom rendering

#### 1.2.2 Camera Control API
- [ ] Expose `Camera` class from engine with configurable properties
- [ ] Add method `setPosition(x: number, y: number, z: number): void`
- [ ] Add method `setRotation(pitch: number, yaw: number, roll: number): void`
- [ ] Add method `setFov(fov: number): void`
- [ ] Add method `setAspectRatio(aspect: number): void`
- [ ] Add method `lookAt(target: Vec3): void`
- [ ] Add event callback `onCameraMove?: (camera: CameraState) => void`

#### 1.2.3 Free Camera Movement
- [ ] Implement `FreeCameraController` class independent of player input
- [ ] Add WASD + QE (up/down) movement in world space
- [ ] Add mouse drag for pitch/yaw rotation
- [ ] Add configurable movement speed and acceleration
- [ ] Add method `update(deltaTime: number, input: CameraInput): void`
- [ ] Add collision toggle: fly-through vs collision-aware movement

#### 1.2.4 Map Statistics API
- [ ] Add method `getMapStatistics(mapName: string): Promise<MapStatistics>`
- [ ] Return statistics: entity count, surface count, lightmap count, vertex count, bounds
- [ ] Add method `getUsedTextures(mapName: string): Promise<string[]>` for missing texture detection
- [ ] Add method `getUsedModels(mapName: string): Promise<string[]>` for missing model detection
- [ ] Add method `getUsedSounds(mapName: string): Promise<string[]>` for missing sound detection

### 1.3 Basic Rendering Improvements

#### 1.3.1 Render Options API
- [ ] Create `RenderOptions` interface for webapp control
- [ ] Add option `wireframe: boolean` for wireframe overlay
- [ ] Add option `showLightmaps: boolean` to toggle lightmap vs fullbright
- [ ] Add option `showSkybox: boolean` to toggle skybox rendering
- [ ] Add option `showBounds: boolean` to display entity bounding boxes
- [ ] Add option `showNormals: boolean` to display surface normals (debug)
- [ ] Add option `cullingEnabled: boolean` to toggle PVS/frustum culling

#### 1.3.2 Debug Visualization
- [ ] Implement `DebugRenderer` class for overlay rendering
- [ ] Add method `drawBoundingBox(mins: Vec3, maxs: Vec3, color: Color): void`
- [ ] Add method `drawLine(start: Vec3, end: Vec3, color: Color): void`
- [ ] Add method `drawPoint(position: Vec3, size: number, color: Color): void`
- [ ] Add method `drawText3D(text: string, position: Vec3): void` for in-world labels
- [ ] Add support for drawing entity origins and axes

#### 1.3.3 Rendering Performance Metrics
- [ ] Expose `RenderStatistics` from GPUProfiler
- [ ] Add counters: draw calls, triangles rendered, vertices processed, texture binds
- [ ] Add timings: frame time, render time, culling time
- [ ] Add memory stats: texture memory used, buffer memory used
- [ ] Add method `getPerformanceReport(): PerformanceReport`

---

## Phase 2: Interactive Visualization

**Goal**: Enable clicking on entities to view metadata, inspect map structure, and navigate the entity graph.

### 2.1 Entity Selection API

#### 2.1.1 Ray Casting for Entity Picking
- [ ] Implement `rayCastEntities(origin: Vec3, direction: Vec3): EntityHit[]` for mouse picking
- [ ] Support AABB intersection tests for all entity types
- [ ] Support BSP brush model intersection (func_door, func_wall, etc.)
- [ ] Support MD2/MD3 bounding box intersection
- [ ] Return sorted list by distance with hit position and normal
- [ ] Add method `screenToWorldRay(screenX: number, screenY: number, camera: Camera): Ray`

#### 2.1.2 Entity Metadata API
- [ ] Create `getEntityMetadata(entityId: number): EntityMetadata` method
- [ ] Return all entity fields: classname, origin, angles, model, targetname, target, etc.
- [ ] Add method `getEntityFields(entityId: number): Record<string, any>` for all key-value pairs
- [ ] Add method `getEntityConnections(entityId: number): EntityConnection[]` for target/targetname graph
- [ ] Add method `getEntityBounds(entityId: number): BoundingBox`
- [ ] Add method `getEntityModel(entityId: number): ModelReference | null`

#### 2.1.3 Entity Filtering and Search
- [ ] Add method `findEntitiesByClassname(classname: string): number[]`
- [ ] Add method `findEntitiesByTargetname(targetname: string): number[]`
- [ ] Add method `findEntitiesInRadius(origin: Vec3, radius: number): number[]`
- [ ] Add method `findEntitiesInBounds(mins: Vec3, maxs: Vec3): number[]`
- [ ] Add method `searchEntityFields(field: string, value: any): number[]`
- [ ] Add method `getAllEntityClassnames(): string[]` for filter UI

#### 2.1.4 Entity Highlighting
- [ ] Add method `setEntityHighlight(entityId: number, color: Color): void` for selection feedback
- [ ] Add method `clearEntityHighlight(entityId: number): void`
- [ ] Render highlighted entities with overlay color or outline shader
- [ ] Support multiple highlight colors for different selection states

### 2.2 Map Structure Inspection

#### 2.2.1 BSP Tree Traversal
- [ ] Add method `getBspNodeTree(): BspNodeTree` for tree visualization
- [ ] Add method `findLeafContainingPoint(point: Vec3): number` for leaf identification
- [ ] Add method `getLeafBounds(leafIndex: number): BoundingBox`
- [ ] Add method `getLeafCluster(leafIndex: number): number` for PVS debugging
- [ ] Add method `isClusterVisible(from: number, to: number): boolean` for visibility testing

#### 2.2.2 Surface Inspection
- [ ] Add method `getSurfaceAtPoint(point: Vec3): SurfaceInfo | null` for face picking
- [ ] Return surface info: texture name, lightmap index, normal, plane, vertices
- [ ] Add method `getSurfacesByTexture(textureName: string): number[]`
- [ ] Add method `highlightSurface(surfaceId: number, color: Color): void`

#### 2.2.3 Texture Browser Integration
- [ ] Add method `getAllLoadedTextures(): TextureInfo[]` listing cached textures
- [ ] Return texture info: name, width, height, format, memory size
- [ ] Add method `getTextureData(name: string): ImageData` for webapp display
- [ ] Add method `getTextureDependencies(mapName: string): string[]` for required textures

### 2.3 Entity Graph Visualization

#### 2.3.1 Target/Targetname Graph
- [ ] Add method `getEntityGraph(): EntityGraph` returning nodes and edges
- [ ] Nodes: entity ID, classname, targetname
- [ ] Edges: entity ID → target references
- [ ] Add method `getEntityTargets(entityId: number): number[]` for forward links
- [ ] Add method `getEntitySources(entityId: number): number[]` for reverse links

#### 2.3.2 Trigger Chain Analysis
- [ ] Add method `getActivationChain(entityId: number): number[][]` for all paths from trigger
- [ ] Add method `getTriggerVolumes(): TriggerVolume[]` for all trigger entities
- [ ] Return trigger info: bounds, target, delay, message, sounds

---

## Phase 3: Demo Playback & Analysis

**Goal**: Enable full demo playback with timeline control, frame-by-frame analysis, and metadata extraction.

### 3.1 Demo Player API Enhancements

#### 3.1.1 Timeline Control Improvements
- [ ] Expose `DemoPlaybackController` as public API
- [ ] Add method `getDuration(): number` returning total demo time in seconds
- [ ] Add method `getCurrentTime(): number` returning current playback position
- [ ] Add method `getFrameCount(): number` returning total frames
- [ ] Add method `getCurrentFrame(): number` returning current frame index
- [ ] Add method `getTotalBytes(): number` for progress display
- [ ] Add method `getProcessedBytes(): number` for progress display

#### 3.1.2 Seeking Improvements
- [ ] Implement fast seek by frame index without full replay
- [ ] Add method `seekToTime(seconds: number): void` for timeline scrubbing
- [ ] Add method `seekToFrame(frameIndex: number): void` for frame-perfect seeking
- [ ] Cache snapshots at regular intervals for faster backward seeking
- [ ] Add event `onSeekComplete?: () => void` for webapp feedback

#### 3.1.3 Playback State Events
- [ ] Add event `onPlaybackStateChange?: (state: PlaybackState) => void`
- [ ] Add event `onFrameUpdate?: (frame: FrameData) => void` for per-frame callbacks
- [ ] Add event `onTimeUpdate?: (time: number) => void` for timeline UI
- [ ] Add event `onPlaybackError?: (error: Error) => void` for error handling
- [ ] Add event `onPlaybackComplete?: () => void` for loop/stop decisions

### 3.2 Frame-by-Frame Analysis

#### 3.2.1 Frame Data Extraction
- [ ] Add method `getFrameData(frameIndex: number): FrameData` for specific frame
- [ ] Return player state: position, velocity, angles, weapon, health, ammo
- [ ] Return entity states: positions, models, animations, effects
- [ ] Return events: weapon fire, damage, pickups, deaths
- [ ] Add method `getFramePlayerState(frameIndex: number): PlayerState`
- [ ] Add method `getFrameEntities(frameIndex: number): EntityState[]`

#### 3.2.2 Frame Comparison
- [ ] Add method `compareFrames(frameA: number, frameB: number): FrameDiff`
- [ ] Return differences in player state, entity positions, events
- [ ] Add method `getEntityTrajectory(entityId: number, startFrame: number, endFrame: number): Vec3[]`
- [ ] Useful for movement analysis and debugging

#### 3.2.3 Event Log Extraction
- [ ] Add method `getDemoEvents(): DemoEvent[]` returning all events chronologically
- [ ] Event types: weapon fire, damage dealt, damage received, pickup, death, spawn
- [ ] Include frame number, timestamp, entity IDs, values
- [ ] Add method `filterEvents(type: EventType, entityId?: number): DemoEvent[]`
- [ ] Add method `getEventSummary(): EventSummary` for statistics (kills, deaths, accuracy)

### 3.3 Demo Metadata

#### 3.3.1 Header Information
- [ ] Add method `getDemoHeader(): DemoHeader` returning protocol version, server info
- [ ] Extract map name, player name, game mode from initial server data
- [ ] Add method `getDemoServerInfo(): ServerInfo` for server cvars
- [ ] Add method `getDemoConfigStrings(): Record<number, string>` for map resources

#### 3.3.2 Demo Statistics
- [ ] Add method `getDemoStatistics(): DemoStatistics`
- [ ] Return: duration, frame count, average FPS, player count, map name
- [ ] Add method `getPlayerStatistics(playerIndex: number): PlayerStatistics`
- [ ] Return: kills, deaths, accuracy, distance traveled, damage dealt/received
- [ ] Add method `getWeaponStatistics(playerIndex: number): WeaponStatistics[]`
- [ ] Return per-weapon: shots, hits, kills, accuracy percentage

### 3.4 Camera Modes for Demo Viewing

#### 3.4.1 Multiple Camera Modes
- [ ] Implement `DemoCameraMode` enum: `FirstPerson` | `ThirdPerson` | `Free` | `Follow`
- [ ] Add method `setCameraMode(mode: DemoCameraMode): void`
- [ ] First person: use demo player viewangles
- [ ] Third person: offset behind player with configurable distance
- [ ] Free: user-controlled camera independent of demo
- [ ] Follow: smooth camera tracking player with lag

#### 3.4.2 Third-Person Camera
- [ ] Add configurable offset and distance parameters
- [ ] Add collision detection to prevent camera clipping through walls
- [ ] Add smooth interpolation for camera movement
- [ ] Add method `setThirdPersonDistance(distance: number): void`
- [ ] Add method `setThirdPersonOffset(offset: Vec3): void`

#### 3.4.3 Slow Motion and Speed Control
- [ ] Enhance `setSpeed()` to support fractional rates: 0.1x, 0.25x, 0.5x, 1x, 2x, 4x, 8x
- [ ] Add frame interpolation for smooth slow-motion playback
- [ ] Add method `getPlaybackSpeed(): number`
- [ ] Ensure audio pitch correction at non-1x speeds (or mute)

---

## Phase 4: Single Player Gameplay

**Goal**: Enable full single-player game functionality with save/load, complete game loop, and all features.

### 4.1 Game Initialization API

#### 4.1.1 Game Session Management
- [ ] Create `GameSession` class wrapping game, client, and engine lifecycle
- [ ] Add method `createSession(options: SessionOptions): GameSession`
- [ ] Options: map name, skill level, render mode, audio enabled
- [ ] Add method `startNewGame(mapName: string, skill: number): void`
- [ ] Add method `loadSavedGame(saveData: SaveData): void`
- [ ] Add method `shutdown(): void` for cleanup

#### 4.1.2 Input Integration
- [ ] Expose `InputController` with method `bindInputSource(source: InputSource): void`
- [ ] Support keyboard, mouse, gamepad, touch inputs
- [ ] Add method `setKeyBinding(action: string, keys: string[]): void`
- [ ] Add method `getDefaultBindings(): KeyBindings` for webapp initialization
- [ ] Add event `onInputCommand?: (cmd: UserCommand) => void` for input recording

#### 4.1.3 Game State Queries
- [ ] Add method `getPlayerState(): PlayerState` for current player status
- [ ] Add method `getGameTime(): number` returning elapsed game seconds
- [ ] Add method `isPaused(): boolean`
- [ ] Add method `getSkillLevel(): number`
- [ ] Add method `getMapName(): string`
- [ ] Add method `getGameMode(): string` (single/deathmatch/coop)

### 4.2 HUD and UI Integration

#### 4.2.1 HUD Data API
- [ ] Create `getHudData(): HudData` method for webapp HUD rendering (headless mode)
- [ ] Return: health, armor, ammo, weapon, inventory, pickups, damage indicators
- [ ] Add method `getStatusBar(): StatusBarData` for classic Quake 2 HUD
- [ ] Add method `getCrosshairInfo(): CrosshairInfo` for hit indication
- [ ] Add event `onHudUpdate?: (data: HudData) => void` for reactive UI

#### 4.2.2 Message Display
- [ ] Add event `onCenterPrint?: (message: string, duration: number) => void` for center messages
- [ ] Add event `onNotify?: (message: string) => void` for console-style notifications
- [ ] Add event `onPickupMessage?: (item: string) => void` for pickup feedback
- [ ] Add event `onObituaryMessage?: (message: string) => void` for death messages

#### 4.2.3 Menu Integration
- [ ] Expose `MenuSystem` API for pause/options menus
- [ ] Add method `showPauseMenu(): void` and `hidePauseMenu(): void`
- [ ] Add method `isMenuActive(): boolean` to pause game updates
- [ ] Add event `onMenuStateChange?: (active: boolean) => void`
- [ ] Provide menu data structure for webapp custom rendering

### 4.3 Save/Load System

#### 4.3.1 Save Game API
- [ ] Add method `saveGame(slotName: string): Promise<SaveData>`
- [ ] Return serialized game state as transferable object
- [ ] Include: player state, entity states, inventory, level time, map name
- [ ] Add method `getSaveMetadata(saveData: SaveData): SaveMetadata`
- [ ] Return: timestamp, map name, player health, screenshot (optional)

#### 4.3.2 Load Game API
- [ ] Add method `loadGame(saveData: SaveData): Promise<void>`
- [ ] Restore full game state from save data
- [ ] Add validation to detect corrupted saves
- [ ] Add event `onLoadComplete?: () => void`
- [ ] Add event `onLoadError?: (error: Error) => void`

#### 4.3.3 Quick Save/Load
- [ ] Add method `quickSave(): Promise<void>` to internal slot
- [ ] Add method `quickLoad(): Promise<void>` from last quick save
- [ ] Add method `hasQuickSave(): boolean`

### 4.4 Missing Game Features

#### 4.4.1 Complete Weapon System
- [ ] Implement all weapon alt-fires (if applicable to rerelease)
- [ ] Implement weapon switching queue/cycle logic
- [ ] Add ammo depletion and auto-switch on empty
- [ ] Add weapon animations and proper view weapon rendering
- [ ] Fix weapon firing state machine edge cases

#### 4.4.2 Power-ups and Items
- [ ] Implement quad damage visual and damage multiplication
- [ ] Implement invulnerability effect (screen tint, damage immunity)
- [ ] Implement environment suit (breathing underwater, lava protection)
- [ ] Implement power screen/shield effects
- [ ] Add proper item respawn timers and visual indicators

#### 4.4.3 Complete Monster AI
- [ ] Implement pathfinding using monster_path_corner entities
- [ ] Fix monster sight/sound perception edge cases
- [ ] Implement all monster attacks and special moves
- [ ] Add monster pain/death animations and sounds
- [ ] Implement monster-specific behaviors (flying, swimming, jumping)

#### 4.4.4 Level Triggers and Scripts
- [ ] Complete trigger_relay, trigger_counter, trigger_always implementations
- [ ] Implement target_speaker for ambient sounds
- [ ] Implement target_explosion, target_splash effects
- [ ] Implement func_timer for repeating events
- [ ] Implement target_changelevel for map transitions
- [ ] Fix complex entity chains (multi-target, delayed activation)

#### 4.4.5 Special Effects
- [ ] Implement dynamic lights for muzzle flashes, explosions, rockets
- [ ] Implement light styles for flickering/pulsing lights
- [ ] Implement screen blend effects (damage red, pickup flash, underwater tint)
- [ ] Implement view kick/roll for damage and movement
- [ ] Add particle effects for all weapon impacts and explosions

### 4.5 Audio Completeness

#### 4.5.1 Missing Sound Features
- [ ] Implement ambient sound looping for all entities
- [ ] Add attenuation curves matching original Quake 2
- [ ] Implement sound occlusion (muffled through walls)
- [ ] Add reverb/environment effects for different map areas
- [ ] Fix spatialization edge cases (inside entity bounds)

#### 4.5.2 Music System
- [ ] Add music track crossfading for smooth transitions
- [ ] Implement music triggers (target_music or map-based)
- [ ] Add configurable music volume separate from SFX
- [ ] Support OGG Vorbis and fallback formats

---

## Phase 5: Multiplayer Support

**Goal**: Enable multiplayer client functionality and optional server hosting.

### 5.1 Multiplayer Client

#### 5.1.1 Server Connection API
- [ ] Expose `connectToServer(address: string, port: number): Promise<void>`
- [ ] Add connection state events: connecting, challenge, connected, disconnected
- [ ] Add method `disconnect(): void` with graceful cleanup
- [ ] Add event `onConnectionStateChange?: (state: ConnectionState) => void`
- [ ] Add event `onConnectionError?: (error: Error) => void`
- [ ] Add latency/ping reporting: `getPing(): number`

#### 5.1.2 Client Prediction and Interpolation
- [ ] Ensure client prediction works correctly in multiplayer
- [ ] Add configurable prediction error tolerance
- [ ] Implement entity interpolation for smooth remote player movement
- [ ] Add lag compensation for weapon firing
- [ ] Expose `setPredictionEnabled(enabled: boolean): void` for debugging

#### 5.1.3 Server Browser (optional library support)
- [ ] Add method `queryServerInfo(address: string): Promise<ServerInfo>` for server ping
- [ ] Return: map name, player count, max players, game mode, hostname
- [ ] Add method `getPlayerList(): PlayerInfo[]` for scoreboard
- [ ] Return: name, score, ping, team (if applicable)

### 5.2 Deathmatch Features

#### 5.2.1 Deathmatch Game Rules
- [ ] Implement player respawning at spawn points
- [ ] Implement frag scoring and leaderboard updates
- [ ] Implement weapon/item respawn timers (DM vs single-player)
- [ ] Implement self-damage (rocket jumping, grenade jumping)
- [ ] Add telefrag detection and scoring

#### 5.2.2 Scoreboard API
- [ ] Add method `getScoreboard(): ScoreboardData` returning sorted player list
- [ ] Return: player name, frags, deaths, ping
- [ ] Add event `onScoreboardUpdate?: (scoreboard: ScoreboardData) => void`
- [ ] Support team-based modes (future: CTF)

#### 5.2.3 Chat System
- [ ] Add method `sendChatMessage(message: string): void`
- [ ] Add event `onChatMessage?: (player: string, message: string) => void`
- [ ] Support team chat vs global chat
- [ ] Add chat history retrieval

### 5.3 Server Hosting (WebRTC or WebSocket)

#### 5.3.1 Server API
- [ ] Expose `createServer(options: ServerOptions): DedicatedServer`
- [ ] Options: map name, max players, deathmatch mode, port
- [ ] Add method `startServer(): Promise<void>`
- [ ] Add method `stopServer(): void`
- [ ] Add method `kickPlayer(clientId: number): void`
- [ ] Add method `changeMap(mapName: string): void`

#### 5.3.2 Server Events
- [ ] Add event `onClientConnected?: (clientId: number, name: string) => void`
- [ ] Add event `onClientDisconnected?: (clientId: number) => void`
- [ ] Add event `onServerError?: (error: Error) => void`
- [ ] Add method `getConnectedClients(): ClientInfo[]`

#### 5.3.3 Network Transport
- [ ] Support WebSocket transport (already implemented)
- [ ] Add WebRTC peer-to-peer transport option for low-latency
- [ ] Add method `setTransport(transport: NetworkTransport): void`
- [ ] Handle reconnection and network failures gracefully

### 5.4 Cooperative Play

#### 5.4.1 Coop Game Rules
- [ ] Implement shared level progression (no respawn until level restart)
- [ ] Implement monster scaling based on player count
- [ ] Implement friendly fire toggle
- [ ] Synchronize trigger activation across clients
- [ ] Implement shared objectives (keys, mission items)

#### 5.4.2 Player Synchronization
- [ ] Ensure all player entities are synchronized correctly
- [ ] Implement player model selection
- [ ] Add player name tags in 3D space
- [ ] Synchronize player deaths and respawns

---

## Phase 6: Advanced Features

**Goal**: Polish and additional features for production-quality experience.

### 6.1 Rendering Enhancements

#### 6.1.1 Dynamic Lights
- [ ] Implement GPU-based dynamic lighting for entities
- [ ] Support point lights with configurable radius and color
- [ ] Add muzzle flash lights with timed decay
- [ ] Add explosion lights
- [ ] Optimize light batching for multiple sources

#### 6.1.2 Water and Transparent Surfaces
- [ ] Implement water surface rendering with refraction
- [ ] Add water fog/tint when camera underwater
- [ ] Implement glass/window transparency
- [ ] Add surface ripple effects (optional)

#### 6.1.3 Post-Processing Effects
- [ ] Implement damage screen flash (red overlay)
- [ ] Implement pickup flash (yellow overlay)
- [ ] Implement underwater distortion
- [ ] Add bloom/glow for bright surfaces
- [ ] Add configurable gamma/brightness adjustment

#### 6.1.4 Advanced Culling
- [ ] Optimize PVS lookup for large maps
- [ ] Add occlusion culling for complex scenes
- [ ] Add distance-based LOD for models (if supported by assets)
- [ ] Add portal culling for indoor areas

### 6.2 Console and Configuration

#### 6.2.1 Console System
- [ ] Expose `ConsoleSystem` for command execution
- [ ] Add method `executeCommand(cmd: string): void`
- [ ] Add method `registerCommand(name: string, handler: CommandHandler): void`
- [ ] Add event `onConsoleOutput?: (message: string) => void`
- [ ] Support command history and autocomplete data

#### 6.2.2 Cvar System
- [ ] Expose `CvarSystem` for configuration management
- [ ] Add method `setCvar(name: string, value: string): void`
- [ ] Add method `getCvar(name: string): Cvar`
- [ ] Add method `listCvars(): CvarInfo[]`
- [ ] Support cvar flags (archive, cheat, server-only)
- [ ] Add event `onCvarChange?: (name: string, value: string) => void`

### 6.3 Modding Support

#### 6.3.1 Custom Entity Registration
- [ ] Add method `registerEntityClass(classname: string, factory: EntityFactory): void`
- [ ] Allow webapp to add custom entity types
- [ ] Expose entity spawn/think/touch hooks
- [ ] Document entity lifecycle and callbacks

#### 6.3.2 Custom Weapon Registration
- [ ] Add method `registerWeapon(weapon: WeaponDefinition): void`
- [ ] Allow custom firing logic, ammo types, animations
- [ ] Expose weapon state machine hooks

#### 6.3.3 Script Hooks
- [ ] Add lifecycle hooks: `onMapLoad`, `onMapUnload`, `onPlayerSpawn`, `onPlayerDeath`
- [ ] Add event hooks: `onEntitySpawn`, `onEntityRemove`, `onDamage`, `onPickup`
- [ ] Allow webapp to inject custom logic at key points

### 6.4 Performance and Optimization

#### 6.4.1 Asset Streaming
- [ ] Implement progressive asset loading with priority queue
- [ ] Add method `preloadAssets(paths: string[]): Promise<void>` for loading screens
- [ ] Add LRU eviction for texture/model/sound caches
- [ ] Add configurable memory limits per asset type

#### 6.4.2 Worker Thread Support
- [ ] Move BSP parsing to worker thread for non-blocking load
- [ ] Move demo parsing to worker thread
- [ ] Move audio decoding to worker thread (already async via WASM)
- [ ] Expose worker-based API with progress callbacks

#### 6.4.3 Memory Management
- [ ] Add method `getMemoryUsage(): MemoryUsage` reporting heap usage
- [ ] Add method `clearCache(type: AssetType): void` for manual cache clearing
- [ ] Add automatic garbage collection triggers for low-memory scenarios
- [ ] Document memory budget recommendations for different device classes

---

## Phase 7: Testing and Documentation

**Goal**: Ensure library is robust and well-documented for developers.

### 7.1 Test Coverage

#### 7.1.1 Unit Tests
- [ ] Add tests for all public API methods in each package
- [ ] Test edge cases: empty PAK files, corrupted BSP, invalid demo data
- [ ] Test math operations: vector math, matrix transformations, quaternions
- [ ] Test serialization: save/load round-trip, network message encoding/decoding

#### 7.1.2 Integration Tests
- [ ] Test full game loop: init → frame → shutdown
- [ ] Test demo record/playback round-trip
- [ ] Test multiplayer handshake and entity synchronization
- [ ] Test asset loading pipeline end-to-end

#### 7.1.3 Performance Tests
- [ ] Benchmark BSP loading time for standard maps
- [ ] Benchmark rendering performance (FPS) for various scenes
- [ ] Benchmark memory usage under typical and stress scenarios
- [ ] Create performance regression tests

### 7.2 API Documentation

#### 7.2.1 JSDoc/TSDoc Comments
- [ ] Add comprehensive TSDoc comments to all public classes and methods
- [ ] Document all parameters, return types, and exceptions
- [ ] Add code examples in comments for complex APIs
- [ ] Add `@example` tags for common use cases

#### 7.2.2 Generated API Reference
- [ ] Set up TypeDoc or similar for automated API documentation
- [ ] Generate HTML documentation from TSDoc comments
- [ ] Organize by package and feature area
- [ ] Include search functionality

### 7.3 Sample Applications

#### 7.3.1 PAK Browser Sample
- [ ] Create minimal example webapp for PAK browsing
- [ ] Demonstrate VFS API usage
- [ ] Show file listing and metadata extraction

#### 7.3.2 Map Viewer Sample
- [ ] Create minimal example webapp for map viewing
- [ ] Demonstrate headless + WebGL rendering modes
- [ ] Show camera control integration

#### 7.3.3 Demo Player Sample
- [ ] Create minimal example webapp for demo playback
- [ ] Demonstrate timeline control and event extraction
- [ ] Show frame-by-frame analysis

#### 7.3.4 Single Player Sample
- [ ] Create minimal example webapp for full gameplay
- [ ] Demonstrate input binding, HUD integration, save/load
- [ ] Show complete game loop

---

## Appendix: Priority Matrix

### Critical (Required for Basic Functionality)
- Phase 1.1: PAK File Browser API (all tasks)
- Phase 1.2: Map Viewer API (all tasks except 1.2.4)
- Phase 3.1: Demo Player API Enhancements (all tasks)
- Phase 4.1: Game Initialization API (all tasks)

### High Priority (Required for Good Developer Experience)
- Phase 2.1: Entity Selection API (all tasks)
- Phase 3.2: Frame-by-Frame Analysis (all tasks)
- Phase 4.2: HUD and UI Integration (all tasks)
- Phase 4.3: Save/Load System (all tasks)
- Phase 7.2: API Documentation (all tasks)

### Medium Priority (Polish and Completeness)
- Phase 1.3: Basic Rendering Improvements
- Phase 2.2: Map Structure Inspection
- Phase 4.4: Missing Game Features (subset based on webapp needs)
- Phase 4.5: Audio Completeness
- Phase 6.1: Rendering Enhancements

### Low Priority (Advanced Features)
- Phase 5: Multiplayer Support (defer if not immediate need)
- Phase 6.2: Console and Configuration (nice-to-have)
- Phase 6.3: Modding Support (future expansion)
- Phase 6.4: Performance Optimization (defer until performance issues arise)

---

## Implementation Notes

### API Design Principles
1. **Separation of Concerns**: Library handles all logic, webapp handles only UI and I/O
2. **Event-Driven**: Use callbacks/events for webapp notification, avoid polling
3. **Progressive Enhancement**: Each phase builds on previous, allowing incremental development
4. **Headless Support**: All features should work in headless mode for flexibility
5. **Type Safety**: Leverage TypeScript for strong contracts between library and webapp
6. **Error Handling**: All async operations should reject with descriptive errors
7. **Memory Management**: Provide cleanup methods and cache control to webapp

### Testing Strategy
- Use real Quake 2 PAK files for integration tests
- Create minimal synthetic test assets for unit tests
- Test both headless and WebGL rendering paths
- Test on multiple browsers and device classes
- Performance benchmarks should use consistent test maps

### Documentation Standards
- All public APIs must have TSDoc comments
- All complex algorithms should have inline comments
- All packages should have README.md with overview and examples
- Breaking changes must be documented in CHANGELOG.md

---

**Total Estimated Tasks**: ~200 individual tasks across 7 phases
**Estimated Effort**: 6-12 months for full completion (depends on team size and priorities)
**Minimum Viable Library**: Phase 1 + Phase 3.1 + Phase 4.1 (~30% of total effort)
