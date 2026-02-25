# Test Memory Leak Analysis

## Summary

Tests are consuming multiple gigabytes of memory when run together. This analysis tracks progress on implementing proper resource cleanup between tests to prevent memory accumulation.

## Completed Work

The following high-priority cleanup issues have been resolved:

1. ✅ **JSDOM Instance Cleanup** - Added `afterAll(teardownBrowserEnvironment)` hooks to all vitest.setup.ts files
2. ✅ **Complete Global Teardown** - Enhanced `teardownBrowserEnvironment()` to clean all globals (window, document, navigator, constructors, etc.)
3. ✅ **WebGPU Mock Cleanup** - Added `teardownWebGPUMocks()` function in `engine/mocks/webgpu.ts:277-291`
4. ✅ **Pointer Lock Cleanup** - Added `MockPointerLock.teardown()` method in `client/mocks/input.ts:139-151`
5. ✅ **Event Listener Cleanup** - Added `off()` and `removeAllListeners()` methods to `BrowserInputSource` in `client/mocks/input.ts:264-293`

## Next Priority Tasks

### 1. JSDOM/Node Test Splitting (HIGHEST PRIORITY)

**Goal**: Reduce memory footprint by only loading JSDOM for tests that need DOM APIs.

**Current State**:
- `vitest.node.ts` and `vitest.jsdom.ts` configs exist in engine package
- Test directories `tests/unit-node/` and `tests/unit-jsdom/` are empty
- All tests currently run with JSDOM environment

**Action Items**:
1. Audit existing tests to identify which require DOM APIs
2. ✅ Move pure logic tests in shared package to `tests/unit-node/` directories (vec3, mat4, angles, contents, color, constants)
   - Moved: `categorize`, `duck`, `water-physics`, `water`, `configstrings`, `contracts`, `currents`, `entityCollision`, `flymove`, `inventory-helpers`, `pmove-viewangles`, `serialization`, `slide`, `snap`, `special`, `stuck`, `usercmd`, `view`.
   - Moved: `pmove/*` (jump, apply)
   - Moved: `net/*` (netchan, fragments, reliable, timeout, process, transmit)
   - Moved: `protocol/*` (bitpack, cvar, entityState, ops, stats)
   - Moved: `audio/*` (constants)
   - Moved: `io/*` (binaryStream, binaryWriter, messageBuilder)
   - Moved: `items/*` (ammo, powerups, weaponInfo, weapons)
   - Moved: `bsp/*` (trace, collision, etc.)
   - Moved: `integration/pmove.test.ts` (renamed to `pmove-integration.test.ts`)
   - Moved: `determinism.test.ts`
   - Moved: `test/random.test.ts` (renamed to `random-parity.test.ts`)
   - Moved: `game/tests/ai` tests to `game/tests/unit-node/ai`
   - Moved: `game/tests/inventory` tests to `game/tests/unit-node/inventory`
   - Moved: `game/tests/physics` tests to `game/tests/unit-node/physics`
   - Moved: `game/tests/entities/target_autosave`, `target_healthbar`, `target_music`, `target_blaster`, `target_crosslevel`, `target_laser`, `target_spawner`, `target_speaker`, `trigger_conditions`, `trigger_multiple`, `triggers`, `ai-fields`, `bfg_ball`, `edge_cases`, `entity-bounds` to `game/tests/unit-node/entities/`
   - Moved: `game/tests/integration/determinism.test.ts`, `createGame.test.ts` to `game/tests/unit-node/integration/`
   - Moved: `game/tests/custom_entity.test.ts`, `custom_entity_registration.test.ts`, `custom_weapon.test.ts`, `difficulty.test.ts`, `dm-items.test.ts`, `dm-spawn.test.ts`, `items_respawn.test.ts` to `game/tests/unit-node/`
   - Moved: `admin_cheat_api.test.ts`, `level.test.ts`, `loop.test.ts`, `player-state-fields.test.ts`, `player-state.test.ts`, `weapons.test.ts` to `game/tests/unit-node/`
   - Moved: `game/tests/dm` tests (`chat`, `killbox`, `scoreboard`, `game`, `dm-items`) to `game/tests/unit-node/dm/`
   - Moved: `game/tests/entities` tests (`func_areaportal`, `func_door_new`, `func_rotating`) to `game/tests/unit-node/entities/`
   - Moved: `game/tests/entities` (remaining tests) to `game/tests/unit-node/entities/`
   - Moved: `game/tests/integration` tests (`combat`, `physicsStress`, `saveLoad`) to `game/tests/unit-node/integration/`
   - Moved: `game/tests/unit/combat` tests (`damage.test.ts`, `damage_mechanics.test.ts`) to `game/tests/unit-node/combat/`
   - Moved: `game/tests/unit/scripting` tests (`hooks.test.ts`) to `game/tests/unit-node/scripting/`
   - Moved: `game/tests/integration/combat/firing.test.ts` to `game/tests/unit-node/integration/combat/`
   - Moved: `game/tests/integration/scenario_saveload.test.ts` to `game/tests/unit-node/integration/`
   - Moved: `game/tests/integration/gameplay.test.ts` to `game/tests/unit-node/integration/`
   - Moved: `game/tests/unit/entities/system.test.ts` to `game/tests/unit-node/entities/`
   - Moved: `game/tests/integration` tests (`scenario_base1.test.ts`, `scenario_gauntlet.test.ts`, `scenario_platforming.test.ts`) to `game/tests/unit-node/integration/`
   - Moved: `game/tests/integration/entities/spawning.test.ts` to `game/tests/unit-node/integration/entities/`
   - Moved: `game/tests/integration/ai` tests (`ai.test.ts`, `hearing.test.ts`) to `game/tests/unit-node/integration/ai/`
   - Moved: `game/tests/integration/assets` tests (`loading.test.ts`) to `game/tests/unit-node/integration/assets/`
   - Moved: `game/tests/integration/performance` tests (`entity_scaling.test.ts`, `spawn.test.ts`) to `game/tests/unit-node/integration/performance/`
   - Moved: `game/tests/mod` tests (`hooks.test.ts`) to `game/tests/unit-node/mod/`
   - Moved: `game/tests/save` tests (`rerelease-conversion`, `rerelease`, `robustness`, `save`, `storage`) to `game/tests/unit-node/save/`
   - Moved: `game/tests/editor` tests (`analysis`, `graph`, `metadata`, `search`, `selection`, `selection_obb`) to `game/tests/unit-node/editor/`
   - Moved: `game/tests/modes` tests to `game/tests/unit-node/modes/`
   - Moved: `game/tests/regression` tests to `game/tests/unit-node/regression/`
   - Moved: `game/tests/replay` tests to `game/tests/unit-node/replay/`
   - Moved: `game/src/save/tests/*` (callbacks, adapter, playerInventory) to `game/tests/unit-node/save/`
   - Moved: `engine/tests/unit-jsdom/editor/*` (`ent.test.ts`, `bsp-inspector.test.ts`) to `engine/tests/unit-node/editor/`
   - Moved: `engine/tests/unit-jsdom/render/*` (`bspTraversalAreas.test.ts`, `cameraController.test.ts`) to `engine/tests/unit-node/render/`
   - Moved: `engine/tests/integration/pak.test.ts` to `engine/tests/unit-node/integration/`
   - Moved: `engine/tests/integration/pak0.test.ts` to `engine/tests/unit-node/integration/`
   - Moved: `engine/tests/unit-jsdom/audio.test.ts` to `engine/tests/unit-node/assets/audioRegistry.test.ts`
   - Moved: `engine/tests/integration` tests (`assetLoading`, `physics`, `initialization`, `mapLoading`) to `engine/tests/unit-node/integration/`
   - Moved: `engine/tests/unit-jsdom/audio/*` (`channels`, `music`, `playback_rate`, `registry-worker`, `system`) to `engine/tests/unit-node/audio/`
   - Moved: `engine/tests/unit-jsdom/assets/bsp-worker.test.ts` to `engine/tests/unit-node/assets/`
   - Moved: `engine/tests/integration/host.test.ts` to `engine/tests/unit-node/integration/`
   - Moved: `engine/tests/integration` tests (`audio/*`, `demo/playback.test.ts`, `smoke.test.ts`) to `engine/tests/unit-node/integration/`
   - Moved: `engine/tests/integration/performance` tests (`memory.test.ts`, `parser-performance.test.ts`, `pipeline_memory.test.ts`) to `engine/tests/unit-node/integration/performance/`
   - Moved: `client/tests/unit-jsdom/fov.test.ts` to `client/tests/unit-node/fov.test.ts`
   - Moved: `client/tests/unit-jsdom/render-config.test.ts` to `client/tests/unit-node/render-config.test.ts`
   - Moved: `client/tests/integration/cgame-integration.test.ts` to `client/tests/unit-node/integration/cgame-integration.test.ts`
   - Moved: `client/tests/integration/integration.test.ts` to `client/tests/unit-node/integration/integration.test.ts`
   - Moved: `client/tests/integration/demo-render-integration.test.ts` to `client/tests/unit-node/integration/demo-render-integration.test.ts`
   - Moved: `client/tests/integration/effects-integration.test.ts` to `client/tests/unit-node/integration/effects-integration.test.ts`
   - Moved: `client/tests/integration/music-integration.test.ts` to `client/tests/unit-node/integration/music-integration.test.ts`
   - Moved: `client/tests/integration/session-integration.test.ts` to `client/tests/unit-node/integration/session-integration.test.ts`
   - Moved: `client/tests/unit-jsdom/demo/camera.test.ts` to `client/tests/unit-node/demo/camera.test.ts`
   - Moved: `client/tests/integration/input/input-integration.test.ts` to `client/tests/unit-node/integration/input/input-integration.test.ts`
   - Moved: `client/tests/integration/inputUI.test.ts` to `client/tests/unit-node/integration/inputUI.test.ts`
   - Moved: `client/tests/integration/menu_lifecycle.test.ts` to `client/tests/unit-node/integration/menu_lifecycle.test.ts`
   - Moved: `client/tests/integration/save-menu.test.ts` to `client/tests/unit-node/integration/save-menu.test.ts`
   - Moved: `client/tests/integration/wiring.test.ts` to `client/tests/unit-node/integration/wiring.test.ts` (with mocked localStorage)
   - Moved: `client/tests/integration/demo/demo-playback-integration.test.ts` to `client/tests/unit-node/integration/demo-playback-integration.test.ts` (mocked Driver/WebSocket)
   - Moved: `client/tests/integration/demo/demo-recording-integration.test.ts` to `client/tests/unit-node/integration/demo-recording-integration.test.ts` (mocked Driver/WebSocket)
   - Moved: `engine/tests/unit-jsdom/render/render-options.test.ts` to `engine/tests/unit-node/render/`
   - Moved: `engine/tests/unit-jsdom/render/rendererStats.test.ts` to `engine/tests/unit-node/render/`
   - Moved: `game/tests/render/headless.test.ts` to `game/tests/unit-node/render/`
   - Moved: `engine/tests/integration/rendering.test.ts` to `engine/tests/unit-node/integration/` (removed JSDOM dependency)
   - Moved: `engine/tests/render/performance/baselines.test.ts` and `benchmark.ts` to `engine/tests/unit-node/render/performance/`
   - Moved: `engine/tests/integration/render` tests (`animation.test.ts`, `camera-state.test.ts`, `lightstyles.test.ts`, `matrix-builders.test.ts`, `system.test.ts`) to `engine/tests/unit-node/render/`
   - Moved: `engine/tests/integration/render/culling.test.ts` to `engine/tests/unit-node/render/culling-integration.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/lightStyles.test.ts` to `engine/tests/unit-node/render/lightStyleManager.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/lod.test.ts` to `engine/tests/unit-node/render/lod.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/bloom.test.ts` to `engine/tests/unit-node/render/bloom.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/render.resources.test.ts` to `engine/tests/unit-node/render/render.resources.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/render.shaderProgram.test.ts` to `engine/tests/unit-node/render/render.shaderProgram.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/frame.test.ts` to `engine/tests/unit-node/render/frame.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/render.particleSystem.test.ts` to `engine/tests/unit-node/render/render.particleSystem.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/renderer.test.ts` to `engine/tests/unit-node/render/renderer.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/bsp.test.ts` to `engine/tests/unit-node/render/bsp.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/skybox.test.ts` to `engine/tests/unit-node/render/skybox.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/bspPipeline.test.ts` to `engine/tests/unit-node/render/bspPipeline.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/bspPipelineDlights.test.ts` to `engine/tests/unit-node/render/bspPipelineDlights.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/dlight.test.ts` to `engine/tests/unit-node/render/dlight.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/gizmo.test.ts` to `engine/tests/unit-node/render/gizmo.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/gpuProfiler.test.ts` to `engine/tests/unit-node/render/gpuProfiler.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/lighting.test.ts` to `engine/tests/unit-node/render/lighting.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/materialLoader.test.ts` to `engine/tests/unit-node/render/materialLoader.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/bspNative.test.ts` to `engine/tests/unit-node/render/bspNative.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/md2PipelineDlights.test.ts` to `engine/tests/unit-node/render/md2PipelineDlights.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/instancing.test.ts` to `engine/tests/unit-node/render/instancing.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/md3Pipeline.test.ts` to `engine/tests/unit-node/render/md3Pipeline.test.ts`
   - Moved: `engine/tests/render/integration/webgl-adapter.test.ts` to `engine/tests/unit-node/render/webgl-adapter.test.ts`
   - Deleted: `engine/tests/render/adapters/webglCamera.test.ts` (obsolete/covered by matrix-builders)
   - Deleted: `engine/tests/integration/setup.ts` (unused)
   - Moved: `engine/tests/unit-jsdom/render/lightCulling.test.ts` to `engine/tests/unit-node/render/lightCulling.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/render.md2Pipeline.test.ts` to `engine/tests/unit-node/render/md2Pipeline.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/render.md3Pipeline.test.ts` to `engine/tests/unit-node/render/md3Pipeline.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/debugMode.test.ts` to `engine/tests/unit-node/render/debugMode.test.ts`
   - Moved: `engine/tests/unit-jsdom/render/postProcess.test.ts` to `engine/tests/unit-node/render/postProcess.test.ts`
   - Deleted: `engine/tests/unit-jsdom/render/render.bspPipeline.test.ts` (redundant with `bspPipeline.test.ts`)
   - Deleted: `engine/tests/unit-jsdom/render/render.skybox.test.ts` (redundant with `skybox.test.ts`)
   - Deleted: `engine/tests/unit-jsdom/render/render.md3Pipeline.test.ts` (redundant with `md3Pipeline.test.ts`)
   - Moved: `engine/tests/unit-jsdom/render/context.test.ts` to `engine/tests/unit-node/render/context.test.ts` (with mocked HTMLCanvasElement)
   - Cleaned up: `engine/tests/render` and `engine/tests/integration` directories
3. Move DOM-dependent tests to `tests/unit-jsdom/` directories
   - Moved: `engine/tests/integration/browserIngestion.test.ts` to `engine/tests/unit-jsdom/assets/`
   - Retained: `client/tests/unit-jsdom/ui/` tests (pakLoader, menu/demo) as they verify DOM interactions
4. Update test scripts in `package.json` to run both test suites
   - Updated `packages/game/package.json` with `test:unit:node` and `test:unit:jsdom`
5. Configure node tests with `environment: 'node'` in vitest config
   - Updated `packages/game/vitest.config.ts` to support split environments

**Expected Impact**: 50-70% reduction in memory usage for tests that don't need JSDOM

### 2. Test Isolation Configuration Audit (HIGH PRIORITY)

**Goal**: Standardize isolation settings across packages to prevent global state leakage.

**Current Issues**:
- Game package: `isolate: true` but with `pool: 'threads'` - globals may leak between tests
- Engine package: `isolate: true` only for integration/webgpu tests
- Unit tests often run with `isolate: false` for speed - sharing globals across tests

**Action Items**:
1. Review isolation settings in all vitest config files
2. Document trade-offs between isolation and performance
3. Standardize settings or document intentional differences
4. Consider `pool: 'forks'` for tests that must have complete isolation

### 3. WebGPU Environment Cleanup (MEDIUM PRIORITY)

**Goal**: Ensure WebGPU headless environment properly cleans up between tests.

**Current State**:
- `setup/webgpu.ts` has cleanup function but usage is optional
- `initHeadlessWebGPU()` returns cleanup function that should be called
- Tests may not be consistently cleaning up GPU resources

**Action Items**:
1. Audit WebGPU integration tests for proper cleanup
2. Ensure all tests using `setupHeadlessWebGPUEnv()` call cleanup
3. Consider adding automatic cleanup in test lifecycle hooks
4. Verify `device.destroy()` is called for all created devices

### 4. Test Context Memory Profiling (LOW PRIORITY)

**Goal**: Verify game test contexts (`createTestContext`) don't retain references.

**Current Behavior**:
- `game/helpers.ts:137-311` creates new registries per context
- Entity lists maintained as closures may retain references
- This is intended behavior but requires proper garbage collection

**Action Items**:
1. Run memory profiler on game unit tests
2. Verify contexts are garbage collected after tests complete
3. Add explicit cleanup to test helpers if needed

## Testing the Fix

After implementing fixes, verify with:

```bash
# Run tests and check memory doesn't grow
node --expose-gc -e "
  const v8 = require('v8');
  setInterval(() => {
    global.gc();
    console.log('Heap:', (v8.getHeapStatistics().used_heap_size / 1024 / 1024).toFixed(2), 'MB');
  }, 5000);
" &
pnpm test:unit --no-isolate
```

Or use vitest's memory reporting if available in v4.
