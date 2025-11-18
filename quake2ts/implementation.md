# Implementation plan for quake2ts

This document outlines the concrete architecture, repository layout, and step-by-step path to build a browser-based TypeScript/WebGL port of the Quake II rerelease (base campaign only).

## Guiding constraints
- **Single-player only**, classic physics defaults; expansions/bots deferred but architecturally pluggable.
- **Browser delivery** using WebGL2 + WebAudio; all copyrighted assets are **user-provided PAKs** loaded through a file selector/drag-drop flow.
- **Deterministic simulation** with JSON-friendly saves; movement/shared physics compiled once and reused by both authoritative game logic and client prediction.
- **Modular packages** to mirror rerelease boundaries: engine (platform/render/audio), game (authoritative simulation), client (HUD + prediction), shared (math/protocol), tools (asset prep/build scripts).

## Repository/package layout
- `packages/engine`: Platform services (WebGL renderer, WebAudio, input, timing/loop, filesystem/asset ingestion, config/cvars). Exposes import tables analogous to `game_import_t`/`cgame_import_t` for game/client modules.
- `packages/game`: Authoritative simulation layer with entity system, physics/pmove wrapper, AI, combat, items, triggers, and deterministic save/load. Exports a surface mirroring `GetGameAPI` entry points (init, shutdown, spawn, client connect/think, save/read).
- `packages/client`: HUD + presentation + client prediction. Wraps shared movement for prediction, parses configstrings, draws HUD/menus, and owns local player-facing UI state. Exports a surface mirroring `GetCGameAPI` (init/shutdown, DrawHUD/TouchPics/layout flags, centerprint/notify handlers, pmove callback).
- `packages/shared`: Math primitives (vec3/quat/mat), protocol-like types (entity states, player state, pmove cmd/results), deterministic random helpers, and serialization utilities. No browser APIs.
- `packages/tools`: Asset converters (PAK/VFS reader, BSP/MD2/MD3/lightmap importers, sound re-encoders), build-time validation, and optional save-compat mappers for rerelease JSON.
- `apps/viewer` (optional bootstrap): Minimal BSP viewer harness that wires engine + client for early rendering/prediction smoke tests.

## Core architecture
### Engine layer (Web APIs & services)
- **Render subsystem:** WebGL2 abstraction with resource registries (models, textures, lightmaps) keyed by the same numeric indices/configstrings the game expects; material system supporting vertex-lit + lightmap passes and particle billboards. Scene graph organizes BSP nodes, static props, and animated models with frustum/PVS culling.
- **Audio subsystem:** WebAudio manager for spatialized playback, stream buffers for looping ambient sounds, and per-entity channel routing matching rerelease positioning rules.
- **Input subsystem:** Pointer lock + keyboard/gamepad mapping to pmove command buffers; configurable bindings stored in cvars/local storage.
- **Filesystem/asset ingestion:** Virtual file system backed by in-memory PAKs; async loaders for BSP/MD2/MD3/WAL/PCX/WAV/OGG; prefetch/cache with checksum validation; exposes `modelindex/soundindex/imageindex` style registries to the game layer.
- **Timing/loop:** Deterministic simulation tick at 40 Hz with frame interpolation for rendering; decoupled render loop using `requestAnimationFrame`; fixed-step accumulator safeguards.
- **Config/cvars:** Typed cvar registry with change callbacks, persistence, and sandbox-safe console exposure.

### Game layer (authoritative simulation)
- **Entity system:** Data-oriented entities with typed components for transform, physics body, render model refs, AI controller, inventory, and triggers. Spawn registry mirrors `g_spawn.cpp` classnames. Deterministic random seed per level.
- **Physics/movement:** Shared pmove module (from `packages/shared`) wrapping collision queries from the engine; brush/hull traces, step/climb, water physics, and legacy quirks preserved. Handles platform movers, doors, pushes, and damage triggers.
- **Combat/items:** Weapon firing logic, damage/knockback, powerups, ammo/health/armor items, respawn rules, and projectile tracking consistent with base campaign.
- **AI/monsters:** State machines for perception, pathing helpers (node graph stub), and attack behaviors per monster archetype; uses deterministic tick hooks to align with server frame rate.
- **Rules/scripting:** Level rules (deathmatch off for SP), intermission sequencing, trigger targets, and cinematic cues. Worldspawn seeds fog/sky/light settings for renderer handoff.
- **Save/load:** Structured state graph serialized to JSON-compatible objects; registration of serializable structures to mirror rerelease determinism. Optional mapper to rerelease JSON schema for compatibility.

### Client layer (HUD & prediction)
- **Prediction:** Invokes shared pmove with local cmd queue; reconciles with authoritative game snapshots (even offline) for consistency. Maintains local view angles, bob/roll effects, and weapon animation timers.
- **HUD/UI:** Centerprint/notification buffers, status bar, weapon/powerup wheels, inventory display, damage indicators, and menu scaffolding. Uses engine renderer helpers for fonts/pics and layout metrics.
- **Configstring parsing:** Consumes asset/config strings from the engine to align prediction physics toggles and HUD resources with game state.
- **Demo/replay hooks:** Stub support for future demo playback using shared protocol types; not required for first milestone but shaped by `PROTOCOL_VERSION` constants.

## Build/test/tooling pipeline
- **Package manager/build:** pnpm monorepo with `tsconfig` project references; Vite-based dev server for `apps/viewer`; Rollup/ESBuild for library bundles.
- **Linting/formatting:** ESLint + Prettier + TypeScript strict mode; Husky/lint-staged for pre-commit checks.
- **Testing:** Vitest unit tests for math/serialization/pmove; Playwright smoke tests for render loop + input capture; snapshot tests for save/load determinism.
- **CI:** GitHub Actions (node + headless WebGL) running lint/test/build; artifacts publish static preview of viewer app.

## Implementation steps
1. **Bootstrap repo tooling**: pnpm workspace, base tsconfig, ESLint/Prettier, Vitest, CI workflow skeleton.
2. **Shared math/types**: Implement vector/matrix math, deterministic RNG, protocol-like TypeScript types for entity/player state and pmove structs.
3. **Filesystem & asset intake**: PAK reader and VFS; loaders for BSP (geometry + lightmaps + visibility), MD2/MD3 models, textures (WAL/PCX), and WAV/OGG audio; caching/index registry APIs.
4. **Render MVP**: WebGL2 context wrapper, shader setup, vertex/index buffer utilities, texture upload, basic BSP traversal + lightmap drawing, model rendering, and particle billboards. Ship `apps/viewer` to display a map with free-fly camera.
5. **Input + loop**: Pointer lock + keyboard/gamepad mapping, command buffer, fixed-step simulation loop with interpolation hooks for rendering.
6. **Shared pmove module**: Port rerelease movement to TypeScript in `packages/shared`; validate with golden tests for known edge cases (stairs, slides, water, air control quirks).
7. **Game scaffolding**: Game API surface mirroring `GetGameAPI`; entity registry and spawn table; collision hooks to engine; minimal rules (worldspawn, player spawn, pickups); deterministic random + save registry.
8. **Client/HUD scaffolding**: Client API surface mirroring `GetCGameAPI`; HUD drawing using renderer helpers; configstring parsing; prediction wiring using shared pmove; placeholder assets/fonts.
9. **Combat/items/AI**: Flesh out weapons, damage handling, powerups, and a subset of monsters; ensure deterministic behavior through tick-based logic and shared math utilities.
10. **Save/load path**: Serialize game + level state; implement rerelease JSON mapper; add snapshot tests for round-trip fidelity.
11. **Browser asset UX**: File selector/drag-drop UI; progress/error reporting; caching policy (indexedDB-backed optional); validation against expected PAK structure.
12. **Performance/stability pass**: Profiling hooks, culling refinements, shader variants for low-end GPUs, audio channel management, and input latency checks.
13. **Polish milestone**: Complete HUD, menus, accessibility toggles (FOV, subtitles), configurable bindings, and documented mod/expansion extension points.

## Extension hooks for later
- Expansion modules (CTF/Rogue/Xatrix) as opt-in packages that register additional spawn tables, assets, and rules via the same API surfaces.
- Networking/co-op scaffolding with protocol serializers reused from shared types.
- WebGPU renderer backend as an optional engine implementation.
