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
- [x] BSP constants and protocol definitions review
  - ✅ Verified CONTENTS_*, SURF_*, MASK_* values match rerelease/original constants (handled 32-bit signed/unsigned JS quirks).
  - ✅ Validated protocol constants (ServerCommand/ClientCommand) against Protocol 34.
  - ✅ Added `packages/shared/tests/constants.test.ts` for regression testing.
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
- [x] Host system (`packages/engine/src/host.ts`) integration
  - ✅ Review initialization sequence (VFS, renderer, audio, input setup)
  - ✅ Validate shutdown and cleanup procedures
  - ✅ Test error handling and recovery paths
  - ✅ Ensure proper resource disposal on failure
  - ✅ Add lifecycle state tracking
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
- [x] WebGL2 substitute
  - Implemented Mock WebGL2 Context in `packages/tests/src/mocks/webgl2.ts` to allow engine initialization in Node.
  - Logic tests run successfully; pixel-perfect rendering tests require full software rasterizer (future work).
  - Setup intercepts `canvas.getContext('webgl2')` to return the mock.
- [x] WebAudio API substitute
  - Installed `node-web-audio-api` and integrated into `setup.ts`.
  - Provides `AudioContext` global for audio system initialization.
- [x] DOM/Browser API substitutes using jsdom
  - Configured JSDOM in `packages/tests/src/setup.ts`.
  - Mocks `window`, `document`, `requestAnimationFrame`.
  - Handled read-only `navigator` global gracefully.
- [x] Input API substitutes
  - ✅ Created `MockPointerLock` to handle pointer lock requests.
  - ✅ Created `InputInjector` for keyboard/mouse event simulation in JSDOM.
  - ✅ Added unit tests verifying event routing and pointer lock state in `input.test.ts`.
- [ ] Network API substitutes (for future multiplayer)
  - WebSocket substitute using ws package (placeholder for now)
  - WebRTC data channels (not needed for single-player)
- [x] Create unified test environment setup
  - Created `@quake2ts/tests` package.
  - `setupBrowserEnvironment()` initializes JSDOM, WebGL2 Mock, and Audio.
  - Added helpers for visual regression (screenshot saving via `@napi-rs/canvas`).

### Comprehensive Integration Test Suite
- [x] **Full engine initialization tests**
  - Test complete startup sequence from cold start
  - Load minimal configuration
  - Initialize all subsystems (VFS, renderer, audio, input)
  - Verify resource allocation
  - Test clean shutdown
  - Validate no resource leaks (memory, file handles, GPU resources)
- [x] **Asset loading integration tests**
  - ✅ Created `asset-loading.test.ts` to test loading assets from a synthetic PAK.
  - ✅ Used `pakBuilder` to create valid PAK headers and dummy content.
  - ✅ Verified VFS mounting and asset retrieval.
  - ✅ Integration pipeline proved viable for asset loading logic in Node.js.
  - Load pak.pak
  - Parse DM2 from within pak.pak successfully and process/validate content
  - Parse BSP from within pak.pak successfully and process/validate content
  - Verify asset index registration in configstrings
  - Test cross-package asset lookup (game requests model, client renders it)
  - Validate missing asset fallbacks
  - Test multi-PAK resolution priority
- [x] **Map loading integration tests**
  - Load complete map (e.g., base1.bsp)
  - Parse entity string and spawn all entities
  - Build BSP collision geometry
  - Upload render geometry to GPU substitute
  - Verify configstring state after map load
  - Test map transitions
- [x] **Rendering pipeline integration tests**
  - Render complete frame with world BSP, models, HUD
  - Capture framebuffer and validate non-zero output
  - Test camera movement through map
  - Verify PVS culling (compare face counts vs without culling)
  - Test special surfaces (sky, water, transparent)
  - Validate HUD overlay rendering
  - Screenshot comparison tests (key scenes)
- [x] **Physics and movement integration tests**
  - Spawn player entity at known position
  - Apply movement inputs (forward, strafe, jump)
  - Run physics simulation for N frames
  - Verify position/velocity match expected values
  - Test collision with world geometry (walk into wall)
  - Test step climbing (walk up stairs)
  - Test falling and landing
  - Test water physics transitions
- [x] **Entity system integration tests**
  - Spawn various entity types (items, monsters, func entities)
  - Test entity thinking (AI, trigger logic)
  - Verify entity-entity interactions (pickup item, touch trigger)
  - Test entity removal and cleanup
  - Validate entity networking state (for future)
- [x] **Combat system integration tests**
  - Spawn player with weapon
  - Fire weapon (blaster, shotgun, etc.)
  - Trace bullet/projectile through world
  - Hit monster entity
  - Apply damage and verify health reduction
  - Test death and gibbing
  - Verify damage feedback (HUD blood flash, pain sounds)
- [x] **AI integration tests**
  - Spawn monster in view of player
  - Run AI perception (see/hear player)
  - Trigger attack behavior
  - Test pathfinding to player
  - Verify animation state changes
  - Test death behavior
- [x] **Audio integration tests**
  - Play 3D positional sound
  - Verify attenuation with distance
  - Test sound occlusion (behind wall)
  - Play music track
  - Test sound mixing (multiple simultaneous sounds)
  - Validate audio in WebAudio substitute
- [x] **Input and UI integration tests**
  - Inject keyboard input events
  - Verify input state propagation to game
  - Test menu navigation
  - Verify HUD updates from game state
  - Test console input and command execution
- [x] **Save/Load integration tests**
  - Play game for N frames
  - Serialize complete game state
  - Clear game state
  - Load saved state
  - Continue playing
  - Verify identical behavior after load
  - Test save file versioning
- [x] **Full gameplay scenario tests**
  - **Scenario 1: Complete base1 level**
    - ✅ Created `packages/game/tests/integration/scenario_base1.test.ts` that loads a real map (base1.bsp/demo1.bsp) from `pak.pak`.
    - ✅ Implemented real BSP collision model building and integration with physics engine for test.
    - ✅ Implemented entity spawning from map entity string.
    - ✅ Simulates player movement and verifies interaction with world (items/monsters).
    - ✅ Verifies collision trace against map geometry.
    - *Note: Requires `pak.pak` to be present in project root. Uses soft warnings if missing or map unloadable.*
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
- [x] Replay and comparison system
  - ✅ Defined Input Recording Schema in `packages/shared/src/replay/schema.ts`.
  - ✅ Implemented `GameRecorder` and `GameReplayer` in `packages/game/src/replay/`.
  - ✅ Implemented `hashEntitySystem` for deep state verification.
  - ✅ Added unit tests for recording, replaying, and state divergence detection.
  - [x] Record input sequence for gameplay session
  - [x] Replay inputs and compare state checksums
  - [x] Verify identical results across runs
  - [ ] Test on different platforms (Linux, macOS, Windows via CI)
- [x] Floating point consistency tests
  - ✅ Implemented `packages/shared/tests/determinism.test.ts`.
  - Verified math operations (arithmetic, trig) are deterministic.
  - Checked edge cases (NaN, Infinity, -0).
  - Validated Vector3 operations produce exact bit-wise results on the platform.
- [x] RNG determinism tests
  - ✅ Added MersenneTwister19937 seed consistency tests in `determinism.test.ts`.
  - Verified state serialization/restoration works for RNG.
  - Validated `RandomGenerator` helpers (frandom, crandom, etc.) are deterministic.
- [x] Physics determinism stress tests
  - ✅ Created `packages/game/tests/integration/physicsStress.test.ts`.
  - Runs 1000-frame simulations with mocked physics interactions.
  - Verifies exact state hash matches across multiple runs.
  - Confirmed entity system state hashing catches divergence.

### Cross-Section Dependency Validation
- [x] Create dependency graph validator
  - ✅ Created `packages/tools/src/validate-deps.ts` script.
  - Implements import rule checking (shared <- engine/game/client, no game -> client, etc.).
  - Successfully verified no circular or forbidden dependencies in current codebase.
- [x] Integration point smoke tests
  - ✅ Added `packages/engine/tests/integration/smoke.test.ts`.
  - Validates `EngineRuntime` lifecycle (init -> frame/render -> shutdown).
  - Verifies data flow from `GameSimulation` to `ClientRenderer` via `EngineHost`.
  - Ensures proper invocation order of entry points.
- [x] Build and packaging integration
  - ✅ Verified full workspace build (`pnpm run build`) succeeds.
  - ✅ Checked output bundle sizes (Engine: ~228KB, Game: ~344KB, Client: ~184KB, Shared: ~116KB).
  - ✅ Confirmed ESM and Browser (IIFE) builds are generated correctly.
  - ✅ Verified no type errors during build (`tsc -b` passes).

### Continuous Integration Setup
- [x] Set up integration test CI pipeline
  - ✅ Updated `.github/workflows/integration.yml`.
  - Added `pnpm run test` to run full suite.
  - Added dependency validation step.
  - Added test result artifact upload.
- [x] Regression detection
  - ✅ Implemented pixel-level comparison in `packages/tests/src/visual.ts`.
  - Uses `@napi-rs/canvas` for image data manipulation.
  - Flags regressions if pixel difference > 0.
- [ ] Performance monitoring (non-blocking)
  - Track test execution time trends
  - Monitor memory usage during tests
  - Log warnings for degradation (but don't fail)
  - Generate performance reports
- [ ] Test artifact archiving
  - ✅ Screenshots and state dumps are captured via artifact uploads in CI.

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
