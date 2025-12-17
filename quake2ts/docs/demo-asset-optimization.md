# Demo Asset Optimization

Task list for demo playback analysis and PAK file optimization features. Enables extracting minimal asset sets required to play specific demo clips.

---

## Phase 1: Foundation - PAK Writing

### Task 1.1: Implement PAK Writer
- [x] Create `PakWriter` class in `packages/engine/src/assets/pakWriter.ts`
  - [x] `addFile(path: string, data: Uint8Array): void` - add file to archive
  - [x] `removeFile(path: string): boolean` - remove file from archive
  - [x] `build(): Uint8Array` - serialize to PAK format with compression
  - [x] `buildFromEntries(entries: Map<string, Uint8Array>): Uint8Array` - static builder
  - [x] Support directory structure preservation from existing PAKs
  - [x] Implement proper offset/length calculation for directory
  - [x] Write PACK header with magic, dirOffset, dirLength
  - [x] Normalize paths to Quake 2 format (lowercase, forward slashes, max 56 chars)
- [x] Add compression support (if Quake 2 rerelease format supports it)
- [x] Export from `packages/engine/src/assets/index.ts`
- [x] Export from `packages/engine/src/index.ts`

**Dependencies:** `packages/engine/src/assets/pak.ts` (PakArchive for format reference)

**Test Cases:**
- Unit: Empty PAK creation, single file, multiple files, path normalization, 56-char limit, invalid paths
- Unit: File removal, duplicate paths (overwrite behavior)
- Unit: Directory offset calculation, entry ordering
- Integration: Write PAK → read with PakArchive → verify exact data match
- Integration: Large files (>1MB), many files (>1000), special characters in paths
- Integration: Round-trip test: read pak0.pak → extract all → write new PAK → binary compare entries

---

## Phase 2: Foundation - Demo Playback Offsets

### Task 2.1: Add Offset Parameters to Demo Playback
- [x] Extend `DemoPlaybackController` in `packages/engine/src/demo/playback.ts`
  - [x] `playFrom(offset: FrameOffset | TimeOffset): void` - start playback from offset
  - [x] `playRange(start: Offset, end: Offset): void` - play specific range
  - [x] Add `FrameOffset` type: `{ type: 'frame', frame: number }`
  - [x] Add `TimeOffset` type: `{ type: 'time', seconds: number }`
  - [x] Update `seek()` logic to handle both offset types
  - [x] Add validation for offset bounds (0 to messageCount/duration)
- [x] Add offset conversion utilities
  - [x] `frameToTime(frame: number): number` - convert frame index to seconds
  - [x] `timeToFrame(seconds: number): number` - convert seconds to frame index
  - [x] Use existing snapshot system for efficient seeking

**Dependencies:** `packages/engine/src/demo/demoReader.ts` (DemoReader.seekToMessage), `packages/engine/src/demo/playback.ts` (existing seek methods)

**Test Cases:**
- Unit: Frame offset validation (negative, out of bounds, zero, max)
- Unit: Time offset validation (negative, beyond duration, fractional seconds)
- Unit: Offset type discrimination, conversion accuracy (frame↔time)
- Integration: Play from various offsets with real demo, verify correct starting position
- Integration: Play range with different offset type combinations (frame→time, time→frame)
- Integration: Seek during playback from non-zero offset

---

## Phase 3: Foundation - Resource Tracking

### Task 3.1: Implement Resource Load Tracker
- [x] Create `ResourceLoadTracker` class in `packages/engine/src/assets/resourceTracker.ts`
  - [x] `startTracking(): void` - begin tracking resource loads
  - [x] `stopTracking(): ResourceLoadLog` - end tracking and return log
  - [x] `recordLoad(type: ResourceType, path: string, timestamp: number, frame: number): void`
  - [x] Define `ResourceType` enum: Texture, Sound, Model, Map, Sprite, ConfigString
  - [x] Define `ResourceLoadLog` interface with frame and time-indexed maps
  - [x] Track both first load and subsequent accesses
  - [x] Store resource metadata (size, pak source)
- [x] Integrate with existing asset systems
  - [x] Hook `AssetManager` in `packages/engine/src/assets/manager.ts`
  - [x] Hook `TextureCache` in `packages/engine/src/assets/texture.ts`
  - [x] Hook `AudioRegistry` in `packages/engine/src/assets/audio.ts`
  - [x] Hook model loaders (Md2Loader, Md3Loader, SpriteLoader)
  - [x] Hook `BspLoader` in `packages/engine/src/loaders/bsp.ts`

**Dependencies:** `packages/engine/src/assets/manager.ts`, loaders in `packages/engine/src/loaders/`

**Test Cases:**
- Unit: Start/stop tracking, empty log, single resource, multiple resources
- Unit: Duplicate resource loads (should track all accesses), resource metadata storage
- Unit: Frame vs time indexing consistency
- Integration: Play demo with tracking enabled, verify all textures/sounds/models logged
- Integration: Track resource from multiple PAKs, verify pak source attribution
- Integration: Memory leak test (start/stop tracking 1000 times)

### Task 3.2: Demo Playback with Resource Tracking
- [x] Extend `DemoPlaybackController` to support tracking
  - [x] `playWithTracking(tracker: ResourceLoadTracker, options?: PlaybackOptions): Promise<ResourceLoadLog>`
  - [x] `playRangeWithTracking(start: Offset, end: Offset, tracker: ResourceLoadTracker): Promise<ResourceLoadLog>`
  - [x] Automatically associate frame numbers from DemoReader with resource loads
  - [x] Associate timestamps from playback timer with resource loads
  - [x] Support fast-forward mode (skip rendering, parse only) for analysis speed
- [x] Add analysis mode options
  - [x] `trackingMode: 'loads' | 'visibility' | 'both'` - what to track (Impl: Currently tracks all loads)
  - [x] `skipRendering: boolean` - fast analysis without drawing (Impl: via fastForward option)
  - [x] `recordInterval: 'frame' | 'time'` - primary indexing method (Impl: Log contains both indices)

**Dependencies:** Task 3.1, `packages/engine/src/demo/playback.ts`

**Test Cases:**
- Unit: Tracking mode options, skip rendering flag
- Integration: Play full demo with tracking, verify resources match configstrings
- Integration: Play demo range, ensure only resources in range are tracked
- Integration: Fast-forward mode performance (>10x realtime)
- Integration: Compare tracked resources vs manual inspection of demo messages

---

## Phase 4: Demo Manipulation - Clip Extraction

### Task 4.1: Basic Clip Extraction & State Capture
- [x] Create `DemoClipper` class in `packages/engine/src/demo/clipper.ts`
  - [x] `extractClip(demo: Uint8Array, start: Offset, end: Offset): Uint8Array` (Raw extraction)
  - [x] `captureWorldState(demo: Uint8Array, atOffset: Offset): Promise<WorldState>`
- [x] Implement `MessageWriter` in `packages/engine/src/demo/writer.ts`
  - [x] Support serializing `svc_serverdata`, `svc_configstring`, `svc_spawnbaseline`, `svc_stufftext`
  - [x] Support `svc_spawnbaseline` entity state serialization
- [x] Define `WorldState` interface
  - [x] `serverData: ServerDataMessage` - protocol, map name, player slot
  - [x] `configStrings: Map<number, string>` - all CS_ values
  - [x] `entityBaselines: Map<number, EntityState>` - spawn baselines
  - [x] `playerState: ProtocolPlayerState` - starting player state at clip offset
  - [x] `currentEntities: Map<number, EntityState>` - active entities at clip start
- [x] Implement world state capture logic
  - [x] Play demo from start to offset
  - [x] Enhance `NetworkMessageHandler` to track entity deltas and reconstruct full entity state
  - [x] Accumulate configstrings and baselines

**Dependencies:** `packages/engine/src/demo/demoReader.ts`, `packages/engine/src/demo/playback.ts`, `packages/engine/src/demo/parser.ts`

**Test Cases:**
- Unit: Extract clip from middle of demo, verify message count/size (Raw)
- Unit: World state capture at various offsets, verify completeness
- Unit: Verify `MessageWriter` output against known binary patterns

### Task 4.2: Optimize World State for Clips
- [x] Add `WorldStateOptimizer` in `packages/engine/src/demo/worldStateOptimizer.ts`
  - [x] `optimizeForClip(worldState: WorldState, clipMessages: Message[]): WorldState`
  - [x] Analyze which entities/configstrings are referenced in clip
  - [x] Remove unreferenced baselines, configstrings, models from world state
  - [x] Keep only entities visible or interactable during clip
  - [x] Preserve dependency chain (e.g., model referenced by entity needs texture)
- [x] Add visibility analysis
  - [x] Parse all frames in clip
  - [x] Track which entity IDs appear
  - [x] Track which configstring indices are accessed
  - [x] Build dependency graph for resources

**Dependencies:** Task 4.1, `packages/engine/src/demo/parser.ts`

**Test Cases:**
- Unit: WorldState with 100 entities, clip references 5 → verify 95 removed
- Unit: ConfigString removal (unreferenced CS_MODELS, CS_SOUNDS)
- Unit: Dependency preservation (entity → model → texture chain)

### Task 4.3: Frame Re-serialization & Delta Patching
- [ ] Implement `extractStandaloneClip` in `DemoClipper`
  - [ ] `extractStandaloneClip(demo: Uint8Array, start: Offset, end: Offset, worldState: WorldState): Uint8Array`
  - [ ] Generate synthetic Frame 0 (Full Update) from `WorldState`
  - [ ] Re-serialize subsequent frames from the clip:
    - [ ] Decode original frame
    - [ ] Map `delta_frame` references (e.g., if frame 1001 refs 1000, and 1000 is our new Frame 0, update ref)
    - [ ] Convert delta entities to full updates if the reference frame is dropped
    - [ ] Re-encode frame using `MessageWriter`
  - [ ] Write final demo file structure (Header + Messages + EOF)

**Dependencies:** Task 4.1, Task 4.2, `packages/engine/src/demo/writer.ts`

**Test Cases:**
- Integration: Standalone clip → verify contains ServerData, configstrings, baselines
- Integration: Playback of standalone clip should be smooth without "delta from unknown frame" errors
- Integration: Clip from offset N should look identical to playing full demo and seeking to N
- Performance: Re-serialization speed for large clips

---

## Phase 5: Resource Analysis - Visibility Tracking

### Task 5.1: Frame-Level Resource Visibility Analysis
- [ ] Create `ResourceVisibilityAnalyzer` in `packages/engine/src/assets/visibilityAnalyzer.ts`
  - [ ] `analyzeDemo(demo: Uint8Array): Promise<VisibilityTimeline>`
  - [ ] `analyzeRange(demo: Uint8Array, start: Offset, end: Offset): Promise<VisibilityTimeline>`
  - [ ] Track per-frame: visible entities, audible sounds, active models, textures
  - [ ] Define `VisibilityTimeline`: frame-indexed map of visible/active resource sets
  - [ ] Define `FrameResources`: `{ visible: Set<string>, audible: Set<string>, loaded: Set<string> }`
- [ ] Implement visibility detection
  - [ ] Entities: check if in camera frustum (requires view matrix from playerState)
  - [ ] Sounds: check if positional sound within audible range or UI sound
  - [ ] Models: derived from visible entities
  - [ ] Textures: derived from visible models/BSP surfaces
  - [ ] Use PVS (Potentially Visible Set) from BSP if available
- [ ] Add interaction detection
  - [ ] Projectiles in flight
  - [ ] Physics interactions (touching/blocking player)
  - [ ] Trigger volumes being activated
  - [ ] Particles/effects spawned

**Dependencies:** Task 3.1, Task 3.2, `packages/engine/src/demo/parser.ts`, `packages/engine/src/render/camera.ts`, BSP visibility from `packages/engine/src/loaders/bsp.ts`

**Test Cases:**
- Unit: Single frame with known entities, verify visibility calculation
- Unit: Sound falloff distance, directional sounds
- Unit: Off-screen entity not marked visible
- Integration: Full demo analysis, verify visibility timeline has entry per frame
- Integration: Compare visibility analysis with actual rendering (screenshot diff)
- Integration: Fast playback mode for large demos (>10min)
- Integration: Memory efficiency test (analyze 1hr demo without OOM)

### Task 5.2: Resource Interaction Graph
- [ ] Build interaction graph in `ResourceVisibilityAnalyzer`
  - [ ] `buildInteractionGraph(timeline: VisibilityTimeline): ResourceGraph`
  - [ ] Define `ResourceGraph`: nodes = resources, edges = dependencies/interactions
  - [ ] Track resource→resource dependencies (model→texture, entity→model)
  - [ ] Track temporal co-occurrence (resources used together in frames)
- [ ] Add graph utilities
  - [ ] `getTransitiveDependencies(resource: string): Set<string>`
  - [ ] `getMinimalSetForFrame(frame: number): Set<string>`
  - [ ] `getMinimalSetForRange(start: number, end: number): Set<string>`

**Dependencies:** Task 5.1

**Test Cases:**
- Unit: Build graph from simple timeline (10 frames, 5 resources)
- Unit: Transitive dependencies (texture → model → entity chain)
- Unit: Minimal set calculation for single frame
- Integration: Complex demo with 1000+ resources, verify graph construction
- Integration: Minimal set for 60-second window matches manual count
- Integration: Graph serialization/deserialization for caching

---

## Phase 6: Resource Analysis - Optimal Window Finder

### Task 6.1: Implement Sliding Window Analysis
- [ ] Create `OptimalClipFinder` in `packages/engine/src/demo/optimalClipFinder.ts`
  - [ ] `findMinimalWindow(demo: Uint8Array, duration: number): Promise<OptimalWindow>`
  - [ ] `findMinimalWindowInRange(timeline: VisibilityTimeline, duration: number, searchStart?: Offset, searchEnd?: Offset): OptimalWindow`
  - [ ] Define `OptimalWindow`: `{ start: Offset, end: Offset, resourceCount: number, resources: Set<string>, score: number }`
  - [ ] Implement sliding window algorithm over timeline
  - [ ] For each position, calculate unique resources in window
  - [ ] Return window with minimum resource count
- [ ] Add scoring heuristics
  - [ ] Primary: minimize unique resource count
  - [ ] Secondary: minimize total resource size (bytes)
  - [ ] Tertiary: prefer resource locality (resources already used elsewhere)
  - [ ] `scoringMode: 'count' | 'size' | 'locality' | 'hybrid'`

**Dependencies:** Task 5.1, Task 5.2

**Test Cases:**
- Unit: 10-frame demo, 5-frame window, verify correct minimal window found
- Unit: Multiple windows with same count → verify tiebreaker logic
- Unit: Window at start, middle, end of demo
- Integration: Real demo, 60-second window, verify manually that result is minimal
- Integration: Large demo (30min) with various durations (10s, 60s, 300s)
- Integration: Performance test: 1hr demo analyzed in <5 minutes
- Integration: Scoring modes produce different but valid results

### Task 6.2: Multi-Criteria Optimization
- [ ] Add advanced search options to `OptimalClipFinder`
  - [ ] `findOptimalWindows(demo: Uint8Array, criteria: OptimizationCriteria): Promise<OptimalWindow[]>`
  - [ ] Define `OptimizationCriteria`: duration range, max resources, content preferences
  - [ ] Support multiple objectives: minimize resources AND maximize action
  - [ ] Add action/interest scoring (kills, damage, movement)
  - [ ] Return top N candidates, sorted by composite score
- [ ] Integration with DemoAnalyzer
  - [ ] Use `DemoAnalyzer` from `packages/engine/src/demo/analyzer.ts` for event data
  - [ ] Correlate resource usage with interesting events
  - [ ] Prefer windows with gameplay highlights

**Dependencies:** Task 6.1, `packages/engine/src/demo/analyzer.ts`

**Test Cases:**
- Unit: Multi-objective scoring (resources vs action)
- Unit: Duration range (find best 30-90 second clip)
- Unit: Max resource constraint (≤100 resources)
- Integration: Find top 5 optimal clips from demo, verify all are valid candidates
- Integration: Action-heavy clip has more events than resource-minimal clip
- Integration: Compare human-selected "best moment" vs algorithm result

---

## Phase 7: Integration - Combined Extraction

### Task 7.1: Demo + PAK Extraction Pipeline
- [ ] Create `DemoPackager` in `packages/engine/src/demo/packager.ts`
  - [ ] `extractDemoPackage(options: PackageOptions): Promise<DemoPackage>`
  - [ ] Define `PackageOptions`: demo source, offsets/duration, pak sources, optimization level
  - [ ] Define `DemoPackage`: `{ demoData: Uint8Array, pakData: Uint8Array, manifest: PackageManifest }`
  - [ ] Define `PackageManifest`: resource list, file sizes, metadata, playback info
  - [ ] Orchestrate full pipeline:
    1. Analyze demo for optimal window (if requested)
    2. Extract demo clip with world state
    3. Analyze resource visibility in clip
    4. Collect resources from source PAKs
    5. Build optimized PAK
    6. Generate manifest
- [ ] Add resource collection from PAKs
  - [ ] `collectResources(resourcePaths: Set<string>, sourcePaks: VirtualFileSystem): Promise<Map<string, Uint8Array>>`
  - [ ] Read each resource from VFS
  - [ ] Handle missing resources gracefully (log warning, continue)
  - [ ] Support dependency expansion (include textures for models, etc.)

**Dependencies:** Task 4.1, Task 5.1, Task 6.1, Task 1.1, `packages/engine/src/assets/vfs.ts`

**Test Cases:**
- Unit: Package options validation
- Unit: Manifest generation with correct resource counts
- Integration: Full pipeline with real demo and PAKs
- Integration: Extracted package playback in clean environment (only extracted PAK)
- Integration: Verify extracted PAK size < source PAK size
- Integration: Missing resource handling (resource in demo but not in PAK)
- Integration: Complex demo with multiple maps, verify all map resources included

### Task 7.2: Optimization Levels
- [ ] Add optimization presets in `DemoPackager`
  - [ ] `MINIMAL`: only resources actually rendered/heard
  - [ ] `SAFE`: includes prefetch buffer and dependencies
  - [ ] `COMPLETE`: includes all referenced resources
  - [ ] `ULTRA`: re-encode textures, compress sounds, strip unused data
- [ ] Implement asset optimization
  - [ ] Texture downscaling option (e.g., 512x512 max for small clips)
  - [ ] Sound quality reduction (lower bitrate for OGG)
  - [ ] Model LOD selection (use simpler models if available)
  - [ ] Remove unused BSP data (vis, lightmaps for unseen areas)

**Dependencies:** Task 7.1

**Test Cases:**
- Unit: Each optimization level produces valid package
- Unit: MINIMAL < SAFE < COMPLETE < source (file sizes)
- Integration: MINIMAL package playback (verify no missing resources at runtime)
- Integration: ULTRA package size comparison (should be smallest)
- Integration: Visual quality comparison (MINIMAL vs COMPLETE)
- Integration: Performance test (package generation time per optimization level)

---

## Phase 8: API & Usability

### Task 8.1: High-Level Library API
- [ ] Create convenience API in `packages/engine/src/demo/api.ts`
  - [ ] `createDemoClip(demoPath: string, startTime: number, duration: number): Promise<Uint8Array>`
  - [ ] `createOptimalDemoPackage(demoPath: string, pakPaths: string[], duration: number): Promise<DemoPackage>`
  - [ ] `analyzeDemo(demoPath: string): Promise<DemoAnalysisReport>`
  - [ ] `findBestClips(demoPath: string, criteria: ClipCriteria): Promise<OptimalWindow[]>`
  - [ ] Define `DemoAnalysisReport`: summary stats, resource counts, optimal windows, events
  - [ ] Define `ClipCriteria`: duration, maxResources, minAction, etc.
- [ ] Add file I/O helpers for web app
  - [ ] Accept File objects or URLs
  - [ ] Return Blob for downloads
  - [ ] Progress callbacks for long operations
  - [ ] Support cancellation (AbortSignal)

**Dependencies:** All previous tasks

**Test Cases:**
- Unit: API parameter validation
- Unit: Progress callback invocation
- Unit: Cancellation support (abort mid-analysis)
- Integration: End-to-end: load demo → find optimal clip → create package → download
- Integration: Multiple concurrent operations (analyze 3 demos in parallel)
- Integration: Large file handling (100MB+ demo)
- Integration: Error handling (corrupted demo, missing PAK)

### Task 8.2: CLI and Example Usage
- [ ] Create CLI tool in `packages/engine/src/cli/demoOptimizer.ts`
  - [ ] Commands: analyze, extract, optimize, find-best
  - [ ] `analyze <demo.dm2>` - print resource analysis
  - [ ] `extract <demo.dm2> <start> <duration> -o output.dm2` - extract clip
  - [ ] `optimize <demo.dm2> <pak0.pak> <pak1.pak> ... -d 60 -o package/` - create package
  - [ ] `find-best <demo.dm2> --duration 60 --top 5` - find optimal windows
  - [ ] Support both time and frame offsets (auto-detect format)
  - [ ] JSON output mode for scripting
- [ ] Create example app in `packages/client/examples/demoOptimizer/`
  - [ ] UI for drag-drop demo and PAK files
  - [ ] Timeline visualization of resource usage
  - [ ] Interactive window selection
  - [ ] Preview clip playback
  - [ ] Download extracted package
- [ ] Documentation in `docs/demo-asset-optimization-usage.md`
  - [ ] API reference
  - [ ] Code examples
  - [ ] Common workflows
  - [ ] Performance tips

**Dependencies:** Task 8.1

**Test Cases:**
- Integration: CLI commands with real files
- Integration: CLI JSON output parsing
- Integration: Example app workflow (load → analyze → extract → download)
- Integration: Timeline visualization accuracy
- Integration: Preview playback matches final export

---

## Test Strategy Summary

### Unit Tests
- All public methods with boundary conditions
- Type validation and error handling
- Mock VFS, demo files, PAK archives
- Isolated component testing

### Integration Tests
- Real demo files from `rerelease` directory
- Real PAK files (pak0.pak, pak1.pak, pak2.pak)
- Full pipeline workflows
- Performance benchmarks
- Memory leak detection
- Cross-browser compatibility (Chrome, Firefox, Safari)

### Test Data Requirements
- Small test demos (10s, simple geometry)
- Medium demos (1-5min, typical gameplay)
- Large demos (10min+, complex maps)
- Edge cases (empty demo, corrupted demo, missing resources)
- Known resource counts for validation

---

## Performance Targets

- **PAK Writing**: 1000 files in <500ms
- **Resource Tracking**: Overhead <5% during playback
- **Visibility Analysis**: Process 1hr demo in <5min
- **Optimal Window Search**: 30min demo, 60s window in <2min
- **Package Extraction**: Complete pipeline in <10s for typical use case
- **Memory Usage**: <500MB for analyzing 1hr demo

---

## Open Questions

**Q1:** Should resource tracking account for mipmaps and generated assets (e.g., lightmaps computed from BSP)?
**Q2:** For ULTRA optimization, do we need to verify asset conversions don't break compatibility with original Quake 2 engine?
**Q3:** Should the optimal window finder support "highlight reels" (multiple short clips instead of one continuous window)?
**Q4:** Do we need to handle demo format differences between original Quake 2, rerelease, and mods?
**Q5:** Should the visibility analyzer run in a Web Worker for large demos to avoid blocking UI?
