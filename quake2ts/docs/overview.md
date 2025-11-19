# Quake II TS overview

This repo is a browser-first TypeScript/WebGL port of the Quake II rerelease, scoped to the single-player base campaign with deterministic simulation and user-provided PAK assets. The goal is a faithful, testable recreation that mirrors the rerelease import/export surfaces while remaining modular and browser-safe.

## What we are building
- **Engine package (`packages/engine`)**: Web-facing services (WebGL2 renderer, WebAudio, input, VFS/PAK ingestion, config/cvars) plus the fixed 40 Hz loop, configstring/asset registries, and import tables that mirror `game_import_t`/`cgame_import_t` expectations.
- **Game package (`packages/game`)**: Authoritative simulation and entity system that owns configstring emission and uses engine callbacks for tracing, asset indexing, and model binding. Exports entrypoints analogous to `GetGameAPI`.
- **Client package (`packages/client`)**: HUD and client-side prediction layer consuming engine renderer helpers and configstrings, exporting a `GetCGameAPI`-style surface.
- **Shared package (`packages/shared`)**: Pure math/protocol/predictable movement helpers used by both game and client for deterministic behavior.
- **Tools/package + viewer app**: Asset preparation utilities and a minimal `apps/viewer` harness to exercise the renderer and loop early.

## How it fits together
- A **fixed-timestep loop** (40 Hz) with interpolation drives the authoritative simulation; rendering/prediction consume latest snapshots to stay in sync.
- The **EngineHost/EngineRuntime** wraps loop control with init/shutdown of engine services, ensuring game/client entrypoints run in a deterministic order and receive the latest frame state.
- **Configstrings and registries** mirror rerelease behavior so game-authored asset indices resolve identically in the engine and client.
- **Shared movement/math** utilities provide the same physics code to both sides, reducing drift between authoritative simulation and prediction.
- **Browser asset ingestion** accepts user-provided PAKs, builds a virtual filesystem, and streams BSP/MD2/MD3/texture/audio data into renderer/audio caches.

## Architecture touchpoints
- Import/export tables follow rerelease naming to ease cross-referencing with the original C++ sources in `rerelease/`.
- Deterministic saves and snapshotting are prioritized so simulation remains reproducible in tests and across reloads.
- Modularity: expansions, alternative render backends (e.g., WebGPU), and networking can slot into the same package boundaries without changing the core contracts.

For deeper sequencing and milestones, see `implementation.md` and `docs/progress.md`.
