# Test Memory Leak Analysis

## Summary

Tests are consuming multiple gigabytes of memory when run together. Running all tests should take no more memory than the maximum usage of any single test file, but currently memory accumulates across test runs, suggesting resources are not being properly cleaned up between tests.

## Observed Symptoms

1. **High Import Time**: Game unit tests show 1426s import time for 257 test files running in ~110s wall clock
2. **Environment Setup Overhead**: Engine integration tests show 80s+ for environment setup
3. **Memory Accumulation**: Memory grows throughout test suite rather than staying constant

## Root Causes Identified

### 1. JSDOM Instance Not Destroyed (`setup/browser.ts`)

**Severity: HIGH**

The `setupBrowserEnvironment()` function at line 19-205:
- Creates a new JSDOM instance that gets assigned to globals
- The `dom` variable goes out of scope but JSDOM's window/document persist via global references
- `teardownBrowserEnvironment()` exists (lines 210-249) but is **never called** from vitest setup
- Multiple JSDOM instances can accumulate if tests run in the same process without cleanup

**Key globals set but not fully cleaned:**
- `global.window`, `global.document`, `global.navigator`
- Event constructors: `Event`, `CustomEvent`, `MouseEvent`, `KeyboardEvent`, etc.
- DOM constructors: `Document`, `Element`, `Node`, `HTMLElement`, `HTMLCanvasElement`
- Storage: `localStorage`, `createImageBitmap`, `btoa`, `atob`
- Animation: `requestAnimationFrame`, `cancelAnimationFrame`

### 2. Canvas Prototype Patches Without Restoration (`setup/browser.ts`)

**Severity: MEDIUM**

Lines 138-150 patch `HTMLCanvasElement.prototype.getContext` but save `originalProtoGetContext` locally without restoring it in teardown.

### 3. WebGPU Mock Globals Not Cleaned (`engine/mocks/webgpu.ts`)

**Severity: MEDIUM**

`setupWebGPUMocks()` at lines 24-68:
- Injects GPU constants via `Object.assign(globalThis, globals)`
- Modifies `navigator.gpu` via `Object.defineProperty`
- **No cleanup function exported** to restore original state

### 4. MockPointerLock Prototype Patching (`client/mocks/input.ts`)

**Severity: MEDIUM**

`MockPointerLock` class at lines 72-134:
- Patches `HTMLElement.prototype.requestPointerLock` globally (line 107)
- Sets `__mockPointerLockInstalled` flag to prevent re-patching but never cleans up
- Original stored at `__originalRequestPointerLock` but never restored

### 5. BrowserInputSource Event Listeners (`client/mocks/input.ts`)

**Severity: LOW**

Lines 209-224 - `BrowserInputSource.on()` adds event listeners via anonymous closures:
```typescript
this.target.addEventListener(event, (e: any) => {
  handler(e.code);  // Anonymous - can't be removed
});
```
No `off()` method or cleanup mechanism provided.

### 6. No Global afterAll Cleanup in Vitest Setup Files

**Severity: HIGH**

Current setup files (e.g., `engine/vitest.setup.ts`, `client/vitest.setup.ts`):
- Call `setupBrowserEnvironment()` at module level
- **Never call** `teardownBrowserEnvironment()` or any cleanup
- No `afterAll` hooks registered for cleanup

### 7. Test Context (`createTestContext`) Creates New Registries Per Test

**Severity: LOW** (by design, but worth noting)

`game/helpers.ts` lines 137-311:
- Creates new `SpawnRegistry` and `ScriptHookRegistry` per context
- This is correct behavior but means tests must let these be garbage collected
- Entity lists maintained as closures may retain references if tests don't clean up

### 8. Headless WebGPU Environment Persistence (`setup/webgpu.ts`)

**Severity: LOW**

`setupHeadlessWebGPUEnv()` modifies globals once and caches:
- Lines 39-66 check if navigator.gpu exists before creating
- Good pattern but `initHeadlessWebGPU()` returns cleanup function that must be called

### 9. Test Isolation Configuration Varies

**Severity: HIGH**

Different packages have different isolation settings:
- Game package: `isolate: true` but with `pool: 'threads'` - globals may leak
- Engine package: `isolate: true` only for integration/webgpu tests
- Unit tests often run with `isolate: false` for speed - sharing globals!

## File References

| File | Issue | Line Numbers |
|------|-------|--------------|
| `setup/browser.ts` | JSDOM not destroyed, prototype patches | 19-249 |
| `engine/mocks/webgpu.ts` | No cleanup for globals | 24-68 |
| `client/mocks/input.ts` | Prototype patches, event listeners | 72-134, 209-224 |
| `setup/webgpu.ts` | Cleanup function exists but optional | 72-108 |
| `setup/webgpu-lifecycle.ts` | Good pattern but must be used | All |

## Recommended Solutions

### Option A: Global Vitest Setup/Teardown (Recommended First Step)

Create or modify `vitest.setup.ts` files to include cleanup:

```typescript
// vitest.setup.ts
import { setupBrowserEnvironment, teardownBrowserEnvironment } from '@quake2ts/test-utils';
import { afterAll } from 'vitest';

setupBrowserEnvironment({ enableWebGL2: true });

afterAll(() => {
  teardownBrowserEnvironment();
});
```

**Pros**: Simple, addresses highest impact issue
**Cons**: afterAll runs per file, not per test - may not be granular enough

### Option B: Per-Test Cleanup Pattern

Use `beforeEach`/`afterEach` for heavier cleanup:

```typescript
import { vi } from 'vitest';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  // Additional cleanup if needed
});
```

**Pros**: More thorough
**Cons**: Performance overhead

### Option C: Fix teardownBrowserEnvironment() Completeness

Current `teardownBrowserEnvironment()` is incomplete. Add:

```typescript
export function teardownBrowserEnvironment() {
  // Existing deletes...

  // Add missing cleanups:
  // @ts-ignore
  delete global.btoa;
  // @ts-ignore
  delete global.atob;
  // @ts-ignore
  delete global.requestAnimationFrame;
  // @ts-ignore
  delete global.cancelAnimationFrame;

  // Restore prototype patches
  if ((global.HTMLElement?.prototype as any)?.__originalRequestPointerLock) {
    (global.HTMLElement.prototype as any).requestPointerLock =
      (global.HTMLElement.prototype as any).__originalRequestPointerLock;
  }
}
```

### Option D: Add WebGPU Mock Cleanup Function

```typescript
// engine/mocks/webgpu.ts
export function teardownWebGPUMocks(): void {
  // Remove navigator.gpu
  try {
    delete (globalThis.navigator as any).gpu;
  } catch (e) {
    (globalThis.navigator as any).gpu = undefined;
  }

  // Note: GPU* globals are harder to clean up as they're spread across globalThis
  // Consider storing original values in setup and restoring
}
```

### Option E: Wrapper Pattern for Auto-Cleanup (Larger Refactor)

Create a test context that auto-cleans:

```typescript
export function withTestContext<T>(
  setup: () => T,
  cleanup: (ctx: T) => void
) {
  return (testFn: (ctx: T) => void | Promise<void>) => {
    return async () => {
      const ctx = setup();
      try {
        await testFn(ctx);
      } finally {
        cleanup(ctx);
      }
    };
  };
}
```

### Option F: Process Isolation for Heavy Tests

Already partially implemented in vitest configs:
- Use `pool: 'forks'` for tests that need complete isolation
- Set `maxForks: 1` for sequential execution with fresh process each file

## JSDOM Test Splitting (In Progress)

The codebase has started splitting tests into `unit-node` and `unit-jsdom`:
- `vitest.node.ts` and `vitest.jsdom.ts` exist in engine package
- Directories `tests/unit-node/` and `tests/unit-jsdom/` are empty

**Recommendation**: Complete this migration:
1. Move tests that don't need DOM to `unit-node`
2. Only load JSDOM for tests that actually need it
3. Run node tests with `environment: 'node'` - no global pollution

## Quick Wins (Small Code Changes)

### 1. Add afterAll to setup files

Modify `engine/vitest.setup.ts`:
```typescript
import { setupBrowserEnvironment, teardownBrowserEnvironment } from '@quake2ts/test-utils';
import { afterAll } from 'vitest';

setupBrowserEnvironment({ enableWebGL2: true });

afterAll(teardownBrowserEnvironment);
```

### 2. Export WebGPU cleanup

Add to `engine/mocks/webgpu.ts`:
```typescript
export function teardownWebGPUMocks(): void {
  if (globalThis.navigator?.gpu) {
    delete (globalThis.navigator as any).gpu;
  }
}
```

### 3. Add MockPointerLock cleanup method

Add to `MockPointerLock` class:
```typescript
teardown() {
  if ((global.HTMLElement?.prototype as any)?.__originalRequestPointerLock) {
    (global.HTMLElement.prototype as any).requestPointerLock =
      (global.HTMLElement.prototype as any).__originalRequestPointerLock;
    delete (global.HTMLElement.prototype as any).__originalRequestPointerLock;
  }
  delete (this._doc as any).__mockPointerLockInstalled;
}
```

## Priority Order

1. **HIGH**: Add `afterAll(teardownBrowserEnvironment)` to all vitest.setup.ts files
2. **HIGH**: Complete `teardownBrowserEnvironment()` to clean all globals
3. **MEDIUM**: Add `teardownWebGPUMocks()` and call it in cleanup
4. **MEDIUM**: Add `MockPointerLock.teardown()` method
5. **LOW**: Add `off()` method to `BrowserInputSource`
6. **FUTURE**: Complete jsdom/node test splitting

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
