# Library Enhancement Requests

This document outlines suggested improvements for the `quake2ts` library to facilitate testing and reduce the complexity of the consumer application (`quake2ts-explorer`).

## Testing & Reliability

- [x] **Export Test Utilities** (In Progress)
    - [x] Create a `@quake2ts/test-utils` package or export. (Package created, build configuration needs fixing)
    - [x] Include mocks for `NetChan`, `BinaryStream`, `BinaryWriter`.
    - [x] Include factories for `GameStateSnapshot`, `PlayerState`, `EntityState` with valid default values.
    - [x] **Goal**: Reduce boilerplate mock setup in application unit tests.

- [ ] **Interface Stability**
    - [x] **`GameStateSnapshot` Consistency**: Investigated, but `NetSnapshot` type was not found in the codebase. This task is currently not applicable.
    - [x] **Explicit exports for `cgame` types**: `ClientPrediction`, `interpolatePredictionState`, `defaultPredictionState` and related types are exported from `@quake2ts/client`.

- [x] **Dependency Injection / Testability**
    - [x] **`NetworkService`**: `MultiplayerConnection` (NetworkService) now accepts an optional `NetChan` instance in `MultiplayerConnectionOptions` for easier testing.
    - [x] **`ClientPrediction`**: `ClientPrediction` now accepts a `PredictionPhysics` interface instead of raw function pointers.

## Feature Migration (Move Logic to Library)

- [x] **Demo Recording**
    - [x] **`DemoRecorder` serialization**: Implement `recordSnapshot(snapshot: GameStateSnapshot)` in `quake2ts/engine` that handles serialization to `.dm2` format (server commands).
    - [x] Currently, the app has to handle this or it's stubbed. Moving this to the engine ensures correct protocol encoding.

- [ ] **Clip Extraction**
    - [ ] **`extractDemoRange`**: Implement methods to slice `.dm2` files buffer-to-buffer.
    - [ ] `(buffer: ArrayBuffer, startFrame: number, endFrame: number) => ArrayBuffer`.

- [x] **HUD & UI Helpers**
    - [x] **`getIconPath(statIndex: number)`**: Expose helper to map `STAT_SELECTED_ICON` to a VFS path string using `configstrings`.
    - [x] **`Inventory Helpers`**: Provide `getAmmoCount(playerState, item)` logic in shared library.

- [ ] **Map & Asset Analysis**
    - [ ] **`BspAnalyzer` helpers**: Expose `calculatePVS(origin)` or `findLeaf(origin)` as public API on `BspMap` or `SceneGraph`.
    - [ ] **`Lightmap Export`**: Utility to export lightmaps as PNG buffers directly from `BspMap` without WebGL context (if possible, or via headless gl).

## API Improvements

- [ ] **`VirtualFileSystem`**
    - [ ] **`findByExtension`**: Support array of extensions or regex.
    - [ ] **`mountPak`**: Return the `PakArchive` instance handle for easier unmounting reference.

- [ ] **`InputController`**
    - [ ] Expose `getBoundKeys(command)` to reverse lookup bindings for UI display.

## Testing Improvements (From Implementation Experience)

- [ ] **Protocol & Network Testing**
    - [ ] **`ClientConnection` Class**: Encapsulate the server message parsing loop (switch-case on `ServerCommand`) into a testable class in the library.
        - `class ClientConnection { handleMessage(data: ArrayBuffer): void; on(event, callback): void; }`
        - Allows testing protocol handling without mocking `WebSocket` or `NetChan` internals.
    - [ ] **`MockNetworkTransport`**: Export a mock transport layer that implements `NetChan` interfaces but records packets for inspection.

- [ ] **Rendering & WebGL**
    - [ ] **`TestRenderer`**: Provide a headless or mock WebGL2 context/renderer in `@quake2ts/test-utils` that mirrors the engine's expectations.
    - [ ] **`PostProcessing` Pipeline**: Move `PostProcessor` logic (quad rendering, shader compilation) into `quake2ts/engine`'s render system to avoid raw WebGL calls in the app.

- [ ] **Input Management**
    - [ ] **InputController Lifecycle**: Make `InputController` a standard class (constructor/dispose) rather than relying on global `initInputController`/`cleanupInputController` functions. This simplifies isolated unit testing.

- [ ] **Protocol Constants**
    - [x] **Export ConfigString Constants**: Export constants like `CS_NAME` (0), `CS_MAXCLIENTS` (30), `CS_MAPNAME`, etc., from `@quake2ts/shared`.
    - [x] **Reason**: Required to implement server query logic and correctly parse `ServerCommand.configstring` in `NetworkService` without hardcoding magic numbers. (Note: `CS_MAPNAME` is not a standard protocol constant and was omitted. `CS_MAXCLIENTS` exports as 60 to match the Rerelease protocol used by this engine.)


## Test Utilities

### [] 1. Export `test-utils` in Package Configuration
**Problem:** The `test-utils` package is present in `node_modules` but not exported via the main `package.json` `exports` field, requiring fragile path aliases to access.
**Request:** Add `./test-utils` to the `exports` map in `quake2ts/package.json`.

```json
"exports": {
  ...
  "./test-utils": {
    "types": "./packages/test-utils/dist/index.d.ts",
    "import": "./packages/test-utils/dist/esm/index.js",
    "require": "./packages/test-utils/dist/cjs/index.cjs"
  }
}
```

### [] 2. Rendering Mocks
**Problem:** Tests for `UniversalViewer` and adapters require extensive manual mocking of `quake2ts/engine` internals (WebGL context, Pipelines, Camera).
**Request:** Provide a `createMockRenderingContext` or similar in `test-utils` that returns a Jest/Vitest compatible mock of the engine's rendering layer.

**Proposed Signature:**
```typescript
interface MockRenderingContext {
  gl: WebGL2RenderingContext; // Mocked
  camera: Mock<Camera>;
  pipelines: {
    md2: Mock<Md2Pipeline>;
    bsp: Mock<BspSurfacePipeline>;
    // ...
  }
}
export function createMockRenderingContext(): MockRenderingContext;
```

### [] 3. Game Exports vs Internal MockGame
**Problem:** `createMockGame` returns an internal `MockGame` interface which doesn't match the `GameExports` interface returned by `createGame`. This makes it difficult to mock the return value of `createGame` when testing the service layer.
**Request:** Update `createMockGame` or add `createMockGameExports` to provide a mock that satisfies `GameExports` (init, frame, shutdown, snapshot, etc.).

**Proposed Signature:**
```typescript
export function createMockGameExports(overrides?: Partial<GameExports>): GameExports;
```

## API Improvements

### [] 4. Game Loop & Recording Integration
**Problem:** Recording frame data usually requires serializing the `GameStateSnapshot` to network protocol messages, which is complex to duplicate in the application layer.
**Request:** Expose a `serializeSnapshot(snapshot: GameStateSnapshot): Uint8Array` method in `quake2ts/game` or `quake2ts/shared`, or allow `DemoRecorder` to accept snapshots directly.

### [] 5. ConfigString Constants
**Problem:** `ConfigString` constants (e.g. `CS_NAME`, `CS_MAXCLIENTS`) are not exported, requiring re-definition in the app.
**Request:** Export `ConfigString` enum/constants from `quake2ts/shared`.

### [] 6. File System Interfaces
**Problem:** `PakArchive` does not expose `list()` in the interface, only `listEntries()`. `VirtualFileSystem` methods sometimes return different structures than expected in mocks.
**Request:** Standardize `PakArchive` interface to include `list(): string[]` for convenience.
