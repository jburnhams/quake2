# Section 17.3: Demo Playback & Analysis

**Goal**: Enable full demo playback with timeline control, frame-by-frame analysis, and metadata extraction.

---

## 3.1 Demo Player API Enhancements

### 3.1.1 Timeline Control Improvements
- [ ] Expose `DemoPlaybackController` as public API
- [ ] Add method `getDuration(): number` returning total demo time in seconds
- [ ] Add method `getCurrentTime(): number` returning current playback position
- [ ] Add method `getFrameCount(): number` returning total frames
- [ ] Add method `getCurrentFrame(): number` returning current frame index
- [ ] Add method `getTotalBytes(): number` for progress display
- [ ] Add method `getProcessedBytes(): number` for progress display

### 3.1.2 Seeking Improvements
- [ ] Implement fast seek by frame index without full replay
- [ ] Add method `seekToTime(seconds: number): void` for timeline scrubbing
- [ ] Add method `seekToFrame(frameIndex: number): void` for frame-perfect seeking
- [ ] Cache snapshots at regular intervals for faster backward seeking
- [ ] Add event `onSeekComplete?: () => void` for webapp feedback

### 3.1.3 Playback State Events
- [ ] Add event `onPlaybackStateChange?: (state: PlaybackState) => void`
- [ ] Add event `onFrameUpdate?: (frame: FrameData) => void` for per-frame callbacks
- [ ] Add event `onTimeUpdate?: (time: number) => void` for timeline UI
- [ ] Add event `onPlaybackError?: (error: Error) => void` for error handling
- [ ] Add event `onPlaybackComplete?: () => void` for loop/stop decisions

---

## 3.2 Frame-by-Frame Analysis

### 3.2.1 Frame Data Extraction
- [ ] Add method `getFrameData(frameIndex: number): FrameData` for specific frame
- [ ] Return player state: position, velocity, angles, weapon, health, ammo
- [ ] Return entity states: positions, models, animations, effects
- [ ] Return events: weapon fire, damage, pickups, deaths
- [ ] Add method `getFramePlayerState(frameIndex: number): PlayerState`
- [ ] Add method `getFrameEntities(frameIndex: number): EntityState[]`

### 3.2.2 Frame Comparison
- [ ] Add method `compareFrames(frameA: number, frameB: number): FrameDiff`
- [ ] Return differences in player state, entity positions, events
- [ ] Add method `getEntityTrajectory(entityId: number, startFrame: number, endFrame: number): Vec3[]`
- [ ] Useful for movement analysis and debugging

### 3.2.3 Event Log Extraction
- [ ] Add method `getDemoEvents(): DemoEvent[]` returning all events chronologically
- [ ] Event types: weapon fire, damage dealt, damage received, pickup, death, spawn
- [ ] Include frame number, timestamp, entity IDs, values
- [ ] Add method `filterEvents(type: EventType, entityId?: number): DemoEvent[]`
- [ ] Add method `getEventSummary(): EventSummary` for statistics (kills, deaths, accuracy)

---

## 3.3 Demo Metadata

### 3.3.1 Header Information
- [ ] Add method `getDemoHeader(): DemoHeader` returning protocol version, server info
- [ ] Extract map name, player name, game mode from initial server data
- [ ] Add method `getDemoServerInfo(): ServerInfo` for server cvars
- [ ] Add method `getDemoConfigStrings(): Record<number, string>` for map resources

### 3.3.2 Demo Statistics
- [ ] Add method `getDemoStatistics(): DemoStatistics`
- [ ] Return: duration, frame count, average FPS, player count, map name
- [ ] Add method `getPlayerStatistics(playerIndex: number): PlayerStatistics`
- [ ] Return: kills, deaths, accuracy, distance traveled, damage dealt/received
- [ ] Add method `getWeaponStatistics(playerIndex: number): WeaponStatistics[]`
- [ ] Return per-weapon: shots, hits, kills, accuracy percentage

---

## 3.4 Camera Modes for Demo Viewing

### 3.4.1 Multiple Camera Modes
- [ ] Implement `DemoCameraMode` enum: `FirstPerson` | `ThirdPerson` | `Free` | `Follow`
- [ ] Add method `setCameraMode(mode: DemoCameraMode): void`
- [ ] First person: use demo player viewangles
- [ ] Third person: offset behind player with configurable distance
- [ ] Free: user-controlled camera independent of demo
- [ ] Follow: smooth camera tracking player with lag

### 3.4.2 Third-Person Camera
- [ ] Add configurable offset and distance parameters
- [ ] Add collision detection to prevent camera clipping through walls
- [ ] Add smooth interpolation for camera movement
- [ ] Add method `setThirdPersonDistance(distance: number): void`
- [ ] Add method `setThirdPersonOffset(offset: Vec3): void`

### 3.4.3 Slow Motion and Speed Control
- [ ] Enhance `setSpeed()` to support fractional rates: 0.1x, 0.25x, 0.5x, 1x, 2x, 4x, 8x
- [ ] Add frame interpolation for smooth slow-motion playback
- [ ] Add method `getPlaybackSpeed(): number`
- [ ] Ensure audio pitch correction at non-1x speeds (or mute)
