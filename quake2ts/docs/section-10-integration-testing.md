# Section 10: Integration, Shared Code Review & Testing

## Overview
This section covers the critical integration layer that ensures all subsystems work together correctly to produce a faithful, deterministic Quake II port. It includes comprehensive review of shared code and main engine loop, API contract validation between packages, extensive integration testing using Node.js-compatible substitutes for browser APIs, and game state determinism verification. This work runs in parallel with other sections and serves as the quality gate for the entire project.

## Dependencies
- **ALL SECTIONS**: This section depends on and integrates work from all other sections
- **Shared package (Section baseline)**: Requires ongoing review and validation - **IN PROGRESS**
- **Engine loop & host (Section baseline)**: Requires ongoing review and validation - **IN PROGRESS**
- **Asset Loading (Section 1)**: CRITICAL - needed for realistic integration tests
- **Rendering (Section 2)**: CRITICAL - needed for full game loop tests
- **Physics (Section 3)**: CRITICAL - needed for determinism validation
- **Entity System (Section 4)**: CRITICAL - needed for gameplay scenario tests
- **Combat (Section 5)**: Required for complete gameplay tests
- **AI (Section 6)**: Required for monster behavior tests
- **Audio (Section 7)**: Required for full sensory integration
- **Input/UI (Section 8)**: Required for interaction tests
- **Save/Load (Section 9)**: Required for state persistence tests

## Work Already Done
- ✅ Basic engine loop structure (`packages/engine/src/loop.ts`)
- ✅ Host and runtime framework (`packages/engine/src/host.ts`, `packages/engine/src/runtime.ts`)
- ✅ ConfigString registry with deterministic indexing
- ✅ Shared pmove system with complete unit tests
- ✅ Basic test helpers (mockWebGL, pakBuilder)
- ✅ Individual package unit tests

## Tasks Remaining

### Shared Code Review & Hardening
- [x] Complete audit of `packages/shared/src/`
  - [x] Review all math utilities (vec3, angles, color, random)
  - [x] Verify deterministic behavior across platforms (floating point consistency)
  - [x] Ensure no platform-specific dependencies
  - [x] Validate against rerelease reference implementations
  - [x] Add comprehensive edge case tests
- [x] Review and validate pmove system integration
  - Cross-reference all pmove functions with rerelease `src/client/cl_pred.cpp`
  - Verify slide/step/categorize logic matches C++ behavior exactly
  - Test all movement edge cases (stairs, ramps, underwater, ladders)
  - Validate view angle clamping and bob calculations
  - Ensure stuck-object resolution is deterministic
- [ ] BSP constants and protocol definitions review
  - Verify CONTENTS_*, SURF_*, MASK_* values match rerelease exactly
  - Validate configstring ranges and limits
  - Check all protocol constants (entity flags, render effects, etc.)
  - Ensure bitfield operations match C++ behavior
- [x] Shared utility function validation
  - Test angle normalization and conversion
  - Verify quaternion/matrix math (if added later)
  - Validate color conversion and gamma correction
  - Test random number generation (seeded determinism)
  - ✅ Added usercmd angle clamp/mouse sensitivity regression tests to mirror rerelease CL_UpdateCmdAngles behavior.

### Main Engine Loop Integration & Review
- [x] Engine loop (`packages/engine/src/loop.ts`) comprehensive review
  - Verify fixed 40 Hz timestep implementation
  - Validate accumulator logic for frame pacing
  - Test interpolation alpha calculation and bounds
  - Ensure catch-up behavior matches expectations (spiral of death prevention)
  - Add frame time tracking and diagnostics
  - ✅ Added regression coverage for start-time anchoring, negative delta rejection, and max-delta clamping to mirror rerelease pacing safeguards.
- [ ] Host system (`packages/engine/src/host.ts`) integration
  - Review initialization sequence (VFS, renderer, audio, input setup)
  - Validate shutdown and cleanup procedures
  - Test error handling and recovery paths
  - Ensure proper resource disposal on failure
  - Add lifecycle state tracking
- [x] Runtime coordination (`packages/engine/src/runtime.ts`) review
  - Verify game/client entrypoint invocation order
  - Validate configstring synchronization between game and client
  - Review frame state passing (snapshots, interpolation state)
  - Ensure import table implementations are complete
  - Test subsystem interdependencies
  - ✅ Added EngineRuntime + game hash regression test to mirror rerelease frame flow and clamp interpolation.
  - ✅ Engine runtime tests now resolve `@quake2ts/game` directly from source, removing the need for prebuilt game artifacts during `vitest` runs.

### API Contract Validation System
- [x] Create import/export table validators
  - **game_import_t contract**: Automated validation that engine exports all required functions
    - `trace(start, end, mins, maxs, passent, contentmask) -> TraceResult`
    - `pointcontents(point) -> number`
    - `setmodel(ent, name) -> void`
    - `configstring(index, value) -> void`
    - `modelindex(name) -> number`
    - `soundindex(name) -> number`
    - `imageindex(name) -> number`
    - All other rerelease game import functions
  - **cgame_import_t contract**: Validate client import table
    - Draw_* functions (RegisterPic, Pic, StretchPic, Char, String, etc.)
    - Model rendering functions
    - Sound playback functions
    - Input query functions
  - **game_export_t contract**: Validate game exports
    - `Init()`
    - `Shutdown()`
    - `SpawnEntities(mapname, entities, spawnpoint)`
    - `RunFrame()`
    - All other game API surface
  - **cgame_export_t contract**: Validate client exports
    - Prediction functions
    - HUD rendering
    - View calculations
  - Shared `contracts.ts` module now exposes rerelease key lists for all four tables and reusable validation helpers.
- [x] Type-level contract enforcement
  - Create TypeScript interfaces matching rerelease C++ signatures
  - Use strict typing to prevent signature drift
  - Add compile-time checks for required exports
  - Document any intentional deviations from rerelease
  - Contract assertions now narrow validated tables to the expected function maps at compile time.
- [x] Runtime contract verification
  - Build test harness that validates all import tables are fully implemented
  - Check function signatures at runtime (parameter counts, types)
  - Verify return value types match contracts
  - Test error handling for invalid inputs
  - Run contract validation in CI on every commit
  - Vitest coverage exercises game/cgame import and export tables, catching missing or non-function entries with rerelease naming.

### Node.js Browser Substitute Integration
- [ ] WebGL2 substitute using @napi-rs/canvas or node-canvas-webgl
  - Research and select best Node.js WebGL implementation
  - Wrap in adapter that matches browser WebGL2 API surface
  - Test all WebGL operations used by renderer
  - Handle context creation, shader compilation, buffer operations
  - Support framebuffer reads for screenshot validation
  - Document limitations vs real WebGL2
- [ ] WebAudio API substitute
  - Evaluate web-audio-api-rs or node-web-audio-api
  - Implement adapter for Quake II audio operations
  - Support 3D positional audio calculations
  - Handle audio buffer decoding (WAV, OGG)
  - Provide silent/dummy backend option for faster tests
  - Test audio mixing and attenuation
- [ ] DOM/Browser API substitutes using jsdom
  - Set up jsdom environment for browser globals
  - Provide File/Blob/ArrayBuffer APIs for PAK loading
  - Mock requestAnimationFrame with controlled timing
  - Provide canvas element for WebGL context
  - Handle localStorage/IndexedDB via node-localstorage or memdown
- [ ] Input API substitutes
  - Create keyboard/mouse input injection system
  - Simulate Pointer Lock API for mouse capture
  - Provide gamepad API substitute (optional, for future)
  - Test input event queuing and dispatch
- [ ] Network API substitutes (for future multiplayer)
  - WebSocket substitute using ws package (placeholder for now)
  - WebRTC data channels (not needed for single-player)
- [ ] Create unified test environment setup
  - Package all substitutes into reusable test harness
  - Provide setup/teardown helpers
  - Allow selective enable/disable of subsystems
  - Support headless operation (no display required)
  - Document environment setup for contributors

### Comprehensive Integration Test Suite
- [ ] **Full engine initialization tests**
  - Test complete startup sequence from cold start
  - Load minimal configuration
  - Initialize all subsystems (VFS, renderer, audio, input)
  - Verify resource allocation
  - Test clean shutdown
  - Validate no resource leaks (memory, file handles, GPU resources)
- [ ] **Asset loading integration tests**
  - Load real baseq2 PAK files (or test subset)
  - Parse and cache BSP, models, textures, sounds
  - Verify asset index registration in configstrings
  - Test cross-package asset lookup (game requests model, client renders it)
  - Validate missing asset fallbacks
  - Test multi-PAK resolution priority
- [ ] **Map loading integration tests**
  - Load complete map (e.g., base1.bsp)
  - Parse entity string and spawn all entities
  - Build BSP collision geometry
  - Upload render geometry to GPU substitute
  - Verify configstring state after map load
  - Test map transitions
- [ ] **Rendering pipeline integration tests**
  - Render complete frame with world BSP, models, HUD
  - Capture framebuffer and validate non-zero output
  - Test camera movement through map
  - Verify PVS culling (compare face counts vs without culling)
  - Test special surfaces (sky, water, transparent)
  - Validate HUD overlay rendering
  - Screenshot comparison tests (key scenes)
- [ ] **Physics and movement integration tests**
  - Spawn player entity at known position
  - Apply movement inputs (forward, strafe, jump)
  - Run physics simulation for N frames
  - Verify position/velocity match expected values
  - Test collision with world geometry (walk into wall)
  - Test step climbing (walk up stairs)
  - Test falling and landing
  - Test water physics transitions
- [ ] **Entity system integration tests**
  - Spawn various entity types (items, monsters, func entities)
  - Test entity thinking (AI, trigger logic)
  - Verify entity-entity interactions (pickup item, touch trigger)
  - Test entity removal and cleanup
  - Validate entity networking state (for future)
- [ ] **Combat system integration tests**
  - Spawn player with weapon
  - Fire weapon (blaster, shotgun, etc.)
  - Trace bullet/projectile through world
  - Hit monster entity
  - Apply damage and verify health reduction
  - Test death and gibbing
  - Verify damage feedback (HUD blood flash, pain sounds)
- [ ] **AI integration tests**
  - Spawn monster in view of player
  - Run AI perception (see/hear player)
  - Trigger attack behavior
  - Test pathfinding to player
  - Verify animation state changes
  - Test death behavior
- [ ] **Audio integration tests**
  - Play 3D positional sound
  - Verify attenuation with distance
  - Test sound occlusion (behind wall)
  - Play music track
  - Test sound mixing (multiple simultaneous sounds)
  - Validate audio in WebAudio substitute
- [ ] **Input and UI integration tests**
  - Inject keyboard input events
  - Verify input state propagation to game
  - Test menu navigation
  - Verify HUD updates from game state
  - Test console input and command execution
- [ ] **Save/Load integration tests**
  - Play game for N frames
  - Serialize complete game state
  - Clear game state
  - Load saved state
  - Continue playing
  - Verify identical behavior after load
  - Test save file versioning
- [ ] **Full gameplay scenario tests**
  - **Scenario 1: Complete base1 level**
    - Load map, spawn player at start
    - Simulate input to navigate to first monster
    - Kill monster, pick up ammo
    - Reach level exit
    - Validate score, health, inventory
  - **Scenario 2: Combat gauntlet**
    - Spawn player in room with multiple monsters
    - Simulate combat until all monsters dead
    - Verify ammunition consumption
    - Validate damage taken
  - **Scenario 3: Platforming challenge**
    - Navigate complex geometry (jumps, elevators, moving platforms)
    - Verify physics determinism
    - Test fall damage
  - **Scenario 4: Save/Load mid-level**
    - Play halfway through level
    - Save, reload, continue
    - Verify completion time matches

### Determinism Validation Framework
- [x] Game state serialization for comparison
  - Serialize complete game state (entities, player state, world state)
  - Create deterministic hash/checksum of state
  - Store state snapshots at key frames
  - Added `hashGameState` FNV-1a helper and baseline hashes for the gravity loop to detect rerelease deviations.
- [ ] Replay and comparison system
  - Record input sequence for gameplay session
  - Replay inputs and compare state checksums
  - Verify identical results across runs
  - Test on different platforms (Linux, macOS, Windows via CI)
  - Baseline hash regression tests now fail fast on divergent physics; input recording still needed.
- [ ] Floating point consistency tests
  - Test math operations for deterministic results
  - Verify vec3/angle operations produce identical results
  - Test edge cases (near-zero, very large values, NaN/Inf handling)
  - Document any platform-specific floating point quirks
- [ ] RNG determinism tests
  - Seed random number generator with known value
  - Run simulation and record RNG sequence
  - Replay and verify identical sequence
  - Test that shared RNG state is serialized correctly
- [ ] Physics determinism stress tests
  - Run 10,000+ frame simulations
  - Compare state at end vs reference
  - Test complex multi-entity scenarios
  - Verify no drift over long sessions

### Cross-Section Dependency Validation
- [ ] Create dependency graph validator
  - Map all inter-package imports
  - Verify no circular dependencies
  - Ensure proper layering (shared <- engine/game/client)
  - Detect unused exports
- [ ] Integration point smoke tests
  - Test each "Integration Points" section from other docs
  - Validate data flows between sections
  - Ensure contracts are honored
  - Test error propagation across boundaries
- [ ] Build and packaging integration
  - Verify all packages build without errors
  - Test tree-shaking and bundle size
  - Ensure no duplicate dependencies
  - Validate type exports for consumers

### Continuous Integration Setup
- [ ] Set up integration test CI pipeline
  - Run on every PR to main branches
  - Execute full integration test suite
  - Report test coverage
  - Fail on contract violations
- [ ] Regression detection
  - Store baseline screenshots/state checksums
  - Compare against previous runs
  - Flag visual/behavioral regressions
  - Require manual approval for intentional changes
- [ ] Performance monitoring (non-blocking)
  - Track test execution time trends
  - Monitor memory usage during tests
  - Log warnings for degradation (but don't fail)
  - Generate performance reports
- [ ] Test artifact archiving
  - Save screenshots from visual tests
  - Store state dumps from failed tests
  - Archive logs for debugging
  - Keep historical test results

## Integration Points
- **From ALL Sections**: Consumes and validates work from every other section
- **To Development Workflow**: Provides quality gates and regression detection for ongoing work
- **To Documentation**: Validates that implementation matches documented architecture
- **To Future Extensions**: Ensures extension points (mods, network, WebGPU) can integrate cleanly

## Testing Requirements

### Unit Tests (Standard)
- Contract validator correctness
- State serialization/deserialization
- Checksum/hash calculation
- Input recording/replay
- Test harness utilities

### Integration Tests (Primary Focus)
All integration tests listed in "Tasks Remaining" above, including:
- Full engine initialization and shutdown
- Complete asset loading pipeline
- Map loading and entity spawning
- Rendering full frames
- Physics and movement
- Combat and AI
- Audio playback
- Save/Load round-trips
- Full gameplay scenarios

### Determinism Tests
- State comparison across runs
- Floating point consistency
- RNG reproducibility
- Long-running simulation stability
- Cross-platform consistency (via CI)

### Regression Tests
- Screenshot comparison against baselines
- State checksum comparison
- API contract validation
- Behavioral consistency tests

## Notes
- **This section is ongoing throughout development** - integration tests should be added as features are implemented in other sections
- **Use real assets for realistic testing** - integration tests should use actual Quake II PAK files (or realistic test subsets) to catch real-world issues
- **Prioritize Node.js compatibility** - all integration tests must run in Node.js with browser API substitutes, no headless browser dependencies
- **Substitutes over mocks** - use real libraries (@napi-rs/canvas, jsdom, web-audio-api) instead of mocks wherever possible for higher fidelity
- **Contract validation is non-negotiable** - any PR that breaks import/export contracts must be rejected
- **Determinism is critical** - any non-deterministic behavior in shared/game/physics code must be fixed immediately
- **Integration tests serve as regression tests** - no separate regression suite needed
- **Document all deviations** - if implementation differs from rerelease, document why and validate behavior
- **Performance testing is out of scope** - focus on correctness and determinism, not frame rates or optimization
- **Visual regression is best-effort** - screenshot comparison is useful but may have tolerance for rendering differences
- **Test data management** - may need subset of baseq2 assets committed for CI (check licensing)
- **Parallel development** - integration work happens alongside feature work, not after
- **API reviews** - shared code and engine loop changes require extra scrutiny and testing
- **Test coverage goals** - aim for >80% coverage of shared code, >60% of integration points
- **Use seeded RNG for tests** - all randomness in tests should be deterministic and reproducible
- **State dumps for debugging** - failed tests should dump game state for investigation
- **Incremental integration** - don't wait for all sections to complete; integrate and test as features land
- **Browser substitute maintenance** - keep up with updates to @napi-rs/canvas, jsdom, etc.
- **CI performance** - integration tests should complete in <10 minutes for fast feedback
- **Test isolation** - each integration test should be independent and not rely on previous test state
- **Error messages** - integration test failures should provide actionable debugging information

## Browser API Substitutes Reference

### Required Node.js Packages
```json
{
  "devDependencies": {
    "@napi-rs/canvas": "^0.1.x",         // Canvas/WebGL substitute
    "jsdom": "^24.x",                     // DOM/Browser globals
    "node-localstorage": "^3.x",         // localStorage substitute
    "memdown": "^6.x",                   // IndexedDB substitute (via levelup)
    "node-web-audio-api": "^0.6.x",      // WebAudio substitute
    "ws": "^8.x"                         // WebSocket (future)
  }
}
```

### Substitute Capabilities and Limitations
- **@napi-rs/canvas**: Provides Canvas 2D, limited WebGL support (check version)
  - May need to use `gl` package for fuller WebGL2 API
  - Framebuffer reads work for screenshot capture
  - No actual GPU rendering (CPU-based)
- **jsdom**: Full DOM implementation
  - Provides window, document, HTMLElement, etc.
  - Event system works for input simulation
  - requestAnimationFrame can be controlled for deterministic timing
- **node-web-audio-api**: WebAudio API for Node.js
  - Supports AudioContext, AudioBuffer, source nodes
  - 3D audio positioning works
  - Can run silent (no actual audio output needed)
- **Limitations to document**:
  - No real GPU execution (may miss GPU-specific bugs)
  - Pointer Lock API is mocked (not real pointer capture)
  - Performance characteristics differ from browser
  - WebGL extensions may not all be available

## Success Criteria
- [ ] All API contracts validated and enforced in CI
- [ ] Full game loop (map load → play → exit) runs in Node.js
- [ ] Deterministic simulation verified across 10,000+ frame runs
- [ ] All integration points between sections tested
- [ ] Visual regression testing operational
- [ ] Save/Load round-trip preserves game state perfectly
- [ ] Shared code and engine loop have >80% test coverage
- [ ] Integration test suite runs in <10 minutes
- [ ] No platform-specific behavior in core simulation
- [ ] Complete gameplay scenario test passes (base1 start to exit)
