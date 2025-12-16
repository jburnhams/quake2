# Library Enhancement Requests

This document outlines suggested improvements for the `quake2ts` library to facilitate testing and reduce the complexity of the consumer application (`quake2ts-explorer`).

## Testing & Reliability

- [ ] **Export Test Utilities**
    - [ ] Create a `@quake2ts/test-utils` package or export.
    - [ ] Include mocks for `NetChan`, `BinaryStream`, `BinaryWriter`.
    - [ ] Include factories for `GameStateSnapshot`, `PlayerState`, `EntityState` with valid default values.
    - [ ] **Goal**: Reduce boilerplate mock setup in application unit tests.

- [ ] **Interface Stability**
    - [ ] **`GameStateSnapshot` Consistency**: Ensure `GameStateSnapshot` (game) and `NetSnapshot` (network) interfaces are compatible or provide a built-in adapter.
    - [ ] **Explicit exports for `cgame` types**: Export `ClientPrediction` and related types from the main entry point or a stable subpath like `@quake2ts/client`.

- [ ] **Dependency Injection / Testability**
    - [ ] **`NetworkService`**: Allow injecting `NetChan` instance via constructor options to avoid mocking module internals.
    - [ ] **`ClientPrediction`**: Allow injecting trace functions via an interface rather than raw function pointers, to verify interactions easier.

## Feature Migration (Move Logic to Library)

- [ ] **Demo Recording**
    - [ ] **`DemoRecorder` serialization**: Implement `recordSnapshot(snapshot: GameStateSnapshot)` in `quake2ts/engine` that handles serialization to `.dm2` format (server commands).
    - [ ] Currently, the app has to handle this or it's stubbed. Moving this to the engine ensures correct protocol encoding.

- [ ] **Clip Extraction**
    - [ ] **`extractDemoRange`**: Implement methods to slice `.dm2` files buffer-to-buffer.
    - [ ] `(buffer: ArrayBuffer, startFrame: number, endFrame: number) => ArrayBuffer`.

- [ ] **HUD & UI Helpers**
    - [ ] **`getIconPath(statIndex: number)`**: Expose helper to map `STAT_SELECTED_ICON` to a VFS path string using `configstrings`.
    - [ ] **`Inventory Helpers`**: Provide `getAmmoCount(playerState, item)` logic in shared library.

- [ ] **Map & Asset Analysis**
    - [ ] **`BspAnalyzer` helpers**: Expose `calculatePVS(origin)` or `findLeaf(origin)` as public API on `BspMap` or `SceneGraph`.
    - [ ] **`Lightmap Export`**: Utility to export lightmaps as PNG buffers directly from `BspMap` without WebGL context (if possible, or via headless gl).

## API Improvements

- [ ] **`VirtualFileSystem`**
    - [ ] **`findByExtension`**: Support array of extensions or regex.
    - [ ] **`mountPak`**: Return the `PakArchive` instance handle for easier unmounting reference.

- [ ] **`InputController`**
    - [ ] Expose `getBoundKeys(command)` to reverse lookup bindings for UI display.
