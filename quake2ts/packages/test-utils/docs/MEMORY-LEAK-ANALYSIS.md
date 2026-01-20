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
3. Move DOM-dependent tests to `tests/unit-jsdom/` directories
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
