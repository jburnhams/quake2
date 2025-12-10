# Section 17.3: Demo Playback & Analysis

**Goal**: Enable full demo playback with timeline control, frame-by-frame analysis, and metadata extraction.

---

## 3.1 Demo Player API Enhancements

### 3.1.1 Timeline Control Improvements
- [x] Expose `DemoPlaybackController` as public API
- [x] Add method `getDuration(): number` returning total demo time in seconds
- [x] Add method `getCurrentTime(): number` returning current playback position
- [x] Add method `getFrameCount(): number` returning total frames
- [x] Add method `getCurrentFrame(): number` returning current frame index
- [x] Add method `getTotalBytes(): number` for progress display
- [x] Add method `getProcessedBytes(): number` for progress display

### 3.1.2 Seeking Improvements
- [x] Implement fast seek by frame index without full replay
- [x] Add method `seekToTime(seconds: number): void` for timeline scrubbing
- [x] Add method `seekToFrame(frameIndex: number): void` for frame-perfect seeking
- [x] Cache snapshots at regular intervals for faster backward seeking
- [x] Add event `onSeekComplete?: () => void` for webapp feedback

### 3.1.3 Playback State Events
- [x] Add event `onPlaybackStateChange?: (state: PlaybackState) => void`
- [x] Add event `onFrameUpdate?: (frame: FrameData) => void` for per-frame callbacks
- [x] Add event `onTimeUpdate?: (time: number) => void` for timeline UI
- [x] Add event `onPlaybackError?: (error: Error) => void` for error handling
- [x] Add event `onPlaybackComplete?: () => void` for loop/stop decisions

---

## 3.2 Frame-by-Frame Analysis

### 3.2.1 Frame Data Extraction
- [x] Add method `getFrameData(frameIndex: number): FrameData` for specific frame
- [x] Return player state: position, velocity, angles, weapon, health, ammo
- [x] Return entity states: positions, models, animations, effects
- [x] Return events: weapon fire, damage, pickups, deaths
- [x] Add method `getFramePlayerState(frameIndex: number): PlayerState`
- [x] Add method `getFrameEntities(frameIndex: number): EntityState[]`

### 3.2.2 Frame Comparison
- [x] Add method `compareFrames(frameA: number, frameB: number): FrameDiff`
- [x] Return differences in player state, entity positions, events
- [x] Add method `getEntityTrajectory(entityId: number, startFrame: number, endFrame: number): Vec3[]`
- [x] Useful for movement analysis and debugging

### 3.2.3 Event Log Extraction
- [x] Add method `getDemoEvents(): DemoEvent[]` returning all events chronologically
- [x] Event types: weapon fire, damage dealt, damage received, pickup, death, spawn
- [x] Include frame number, timestamp, entity IDs, values
- [x] Add method `filterEvents(type: EventType, entityId?: number): DemoEvent[]`
- [x] Add method `getEventSummary(): EventSummary` for statistics (kills, deaths, accuracy)

---

## 3.3 Demo Metadata

### 3.3.1 Header Information
- [x] Add method `getDemoHeader(): DemoHeader` returning protocol version, server info
- [x] Extract map name, player name, game mode from initial server data
- [x] Add method `getDemoServerInfo(): ServerInfo` for server cvars
- [x] Add method `getDemoConfigStrings(): Record<number, string>` for map resources

### 3.3.2 Demo Statistics
- [x] Add method `getDemoStatistics(): DemoStatistics`
- [x] Return: duration, frame count, average FPS, player count, map name
- [x] Add method `getPlayerStatistics(playerIndex: number): PlayerStatistics`
- [x] Return: kills, deaths, accuracy, distance traveled, damage dealt/received
- [x] Add method `getWeaponStatistics(playerIndex: number): WeaponStatistics[]`
- [x] Return per-weapon: shots, hits, kills, accuracy percentage

---

## 3.4 Camera Modes for Demo Viewing

### 3.4.1 Multiple Camera Modes
- [x] Implement `DemoCameraMode` enum: `FirstPerson` | `ThirdPerson` | `Free` | `Follow`
- [x] Add method `setCameraMode(mode: DemoCameraMode): void`
- [x] First person: use demo player viewangles
- [x] Third person: offset behind player with configurable distance
- [x] Free: user-controlled camera independent of demo
- [x] Follow: smooth camera tracking player with lag

### 3.4.2 Third-Person Camera
- [x] Add configurable offset and distance parameters
- [x] Add collision detection to prevent camera clipping through walls
- [x] Add smooth interpolation for camera movement
- [x] Add method `setThirdPersonDistance(distance: number): void`
- [x] Add method `setThirdPersonOffset(offset: Vec3): void`

### 3.4.3 Slow Motion and Speed Control
- [x] Enhance `setSpeed()` to support fractional rates: 0.1x, 0.25x, 0.5x, 1x, 2x, 4x, 8x
- [x] Add frame interpolation for smooth slow-motion playback
- [x] Add method `getPlaybackSpeed(): number`
- [x] Ensure audio pitch correction at non-1x speeds (or mute)
