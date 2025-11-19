# Implementation plan for quake2ts

This document outlines the concrete architecture, repository layout, and step-by-step path to build a browser-based TypeScript/WebGL port of the Quake II rerelease (base campaign only).

## Guiding constraints
- **Single-player only**, classic physics defaults; expansions/bots deferred but architecturally pluggable.
- **Browser delivery** using WebGL2 + WebAudio; all copyrighted assets are **user-provided PAKs** loaded through a file selector/drag-drop flow.
- **Deterministic simulation** with JSON-friendly saves; movement/shared physics compiled once and reused by both authoritative game logic and client prediction.
- **Modular packages** to mirror rerelease boundaries: engine (platform/render/audio), game (authoritative simulation), client (HUD + prediction), shared (math/protocol), tools (asset prep/build scripts).

## Repository/package layout
- `packages/engine`: Platform services (WebGL renderer, WebAudio, input, timing/loop, filesystem/asset ingestion, config/cvars). Exposes import tables analogous to `game_import_t`/`cgame_import_t` for game/client modules. Provides the configstring/index registry the rerelease expects so the game/client layers can resolve assets deterministically.
- `packages/game`: Authoritative simulation layer with entity system, physics/pmove wrapper, AI, combat, items, triggers, and deterministic save/load. Exports a surface mirroring `GetGameAPI` entry points (init, shutdown, spawn, client connect/think, save/read). Owns authoritative configstring publication and asset precache calls into the engine registries.
- `packages/client`: HUD + presentation + client prediction. Wraps shared movement for prediction, parses configstrings, draws HUD/menus, and owns local player-facing UI state. Exports a surface mirroring `GetCGameAPI` (init/shutdown, DrawHUD/TouchPics/layout flags, centerprint/notify handlers, pmove callback). Consumes engine-provided renderer helpers for HUD pic/font metrics.
- `packages/shared`: Math primitives (vec3/quat/mat), protocol-like types (entity states, player state, pmove cmd/results), deterministic random helpers, and serialization utilities. No browser APIs.
- `packages/tools`: Asset converters (PAK/VFS reader, BSP/MD2/MD3/lightmap importers, sound re-encoders), build-time validation, and optional save-compat mappers for rerelease JSON.
- `apps/viewer` (optional bootstrap): Minimal BSP viewer harness that wires engine + client for early rendering/prediction smoke tests.

## Core architecture
### Interfaces to mirror from the rerelease
- **Engine → game (`game_import_t` analog):** Message dispatch (print/centerprint), asset indexers (`modelindex`, `soundindex`, `imageindex`), collision queries (`trace`, `clip`, `pointcontents`), and model binding (`setmodel`). The engine package must expose these as typed callbacks and record configstring mutations for the client package.
- **Game → engine (`game_export_t` analog):** Lifecycle (PreInit/Init/Shutdown), level spawning, frame tick, client connect/think, and save/load entrypoints. The game package emits configstrings and uses engine registries to precache assets, keeping authoritative ownership over gameplay state.
- **Engine → client (`cgame_import_t` analog):** Configstring accessors, cvar plumbing, renderer HUD helpers (pic registration/size queries, text metrics), and timing/protocol constants surfaced through typed imports.
- **Client → engine (`cgame_export_t` analog):** HUD lifecycle and draw entrypoints (DrawHUD, TouchPics), layout flags, prediction pmove callback, and centerprint/notify parsing hooks. The client package uses the engine renderer but stays UI-only.

### Engine layer (Web APIs & services)
- **Render subsystem:** WebGL2 abstraction with resource registries (models, textures, lightmaps) keyed by the same numeric indices/configstrings the game expects; material system supporting vertex-lit + lightmap passes and particle billboards. Scene graph organizes BSP nodes, static props, and animated models with frustum/PVS culling. HUD helpers expose `Draw_RegisterPic`, `Draw_GetPicSize`, and text metrics equivalents for the client module.
- **Audio subsystem:** WebAudio manager for spatialized playback, stream buffers for looping ambient sounds, and per-entity channel routing matching rerelease positioning rules.
- **Input subsystem:** Pointer lock + keyboard/gamepad mapping to pmove command buffers; configurable bindings stored in cvars/local storage.
- **Filesystem/asset ingestion:** Virtual file system backed by in-memory PAKs; async loaders for BSP/MD2/MD3/WAL/PCX/WAV/OGG; prefetch/cache with checksum validation; exposes `modelindex/soundindex/imageindex` style registries to the game layer.
- **Timing/loop:** Deterministic simulation tick at 40 Hz with frame interpolation for rendering; decoupled render loop using `requestAnimationFrame`; fixed-step accumulator safeguards.
- **Config/cvars:** Typed cvar registry with change callbacks, persistence, and sandbox-safe console exposure.

### Game layer (authoritative simulation)
- **Entity system:** Data-oriented entities with typed components for transform, physics body, render model refs, AI controller, inventory, and triggers. Spawn registry mirrors `g_spawn.cpp` classnames. Deterministic random seed per level. Configstrings (models/sounds/images/csbcs) are emitted here to drive renderer/HUD asset binding.
- **Physics/movement:** Shared pmove module (from `packages/shared`) wrapping collision queries from the engine; brush/hull traces, step/climb, water physics, and legacy quirks preserved. Handles platform movers, doors, pushes, and damage triggers.
- **Combat/items:** Weapon firing logic, damage/knockback, powerups, ammo/health/armor items, respawn rules, and projectile tracking consistent with base campaign.
- **AI/monsters:** State machines for perception, pathing helpers (node graph stub), and attack behaviors per monster archetype; uses deterministic tick hooks to align with server frame rate.
- **Rules/scripting:** Level rules (deathmatch off for SP), intermission sequencing, trigger targets, and cinematic cues. Worldspawn seeds fog/sky/light settings for renderer handoff. Campaign progression hooks for cinematics/intermissions preserved for parity with rerelease entrypoints.
- **Save/load:** Structured state graph serialized to JSON-compatible objects; registration of serializable structures to mirror rerelease determinism. Optional mapper to rerelease JSON schema for compatibility.

### Client layer (HUD & prediction)
- **Prediction:** Invokes shared pmove with local cmd queue; reconciles with authoritative game snapshots (even offline) for consistency. Maintains local view angles, bob/roll effects, and weapon animation timers.
- **HUD/UI:** Centerprint/notification buffers, status bar, weapon/powerup wheels, inventory display, damage indicators, and menu scaffolding. Uses engine renderer helpers for fonts/pics and layout metrics.
- **Configstring parsing:** Consumes asset/config strings from the engine to align prediction physics toggles and HUD resources with game state.
- **Demo/replay hooks:** Stub support for future demo playback using shared protocol types; not required for first milestone but shaped by `PROTOCOL_VERSION` constants.

### Asset/configstring ingestion flow (browser)
1. User drops/selects PAKs; engine VFS indexes them and surfaces a list of available BSPs/maps.
2. Game package requests precaches during level load, invoking engine `modelindex/soundindex/imageindex` and emitting configstrings; engine records these for the client package.
3. Engine asynchronously loads resources (BSP geometry/lightmaps, MD2/MD3 meshes, WAL/PCX textures, WAV/OGG audio) and resolves indices to GPU/Audio handles.
4. Client package receives configstrings, registers HUD pics/fonts through renderer helpers, and uses the same indices to request HUD assets.
5. Save/load uses deterministic identifiers so cached assets can be revalidated between sessions without diverging configstring order.

## Build/test/tooling pipeline
- **Package manager/build:** pnpm monorepo with `tsconfig` project references; Vite-based dev server for `apps/viewer`; tsup-powered library bundles so publishable packages emit dual CJS/ESM artifacts plus a browser-friendly build. A workspace skeleton now exists with `packages/{engine,game,client,shared,tools}` and `apps/viewer` wired to `tsc -b`, and the root build script now fans out to each package/app's own `build` script so shared bundlers stay in lockstep with the TypeScript project references (which now emit declaration-only output for the shared package).
- **Linting/formatting:** ESLint + Prettier + TypeScript strict mode; Husky/lint-staged for pre-commit checks.
- **Testing:** Vitest unit tests for math/serialization/pmove; Playwright smoke tests for render loop + input capture; snapshot tests for save/load determinism. Initial unit coverage is seeded in the shared math helpers to prove the test harness.
- **CI:** GitHub Actions (node + headless WebGL) running lint/test/build; artifacts publish static preview of viewer app. A bootstrap workflow runs pnpm install/build/test on pushes/PRs touching `quake2ts/**`.

## Implementation steps
1. **Bootstrap repo tooling**: pnpm workspace, base tsconfig, ESLint/Prettier, Vitest, CI workflow skeleton. _Status:_ pnpm workspace + TypeScript project references + Vitest harness and CI workflow are in place.
2. **Shared math/types**: Implement vector/matrix math, deterministic RNG, protocol-like TypeScript types for entity/player state and pmove structs. The initial `vec3`/angle helpers are now extended with movement-oriented functions (`ClipVelocity`, `SlideClipVelocity`, `clipVelocityAgainstPlanes`, `G_ProjectSource`, `slerp` equivalents) closely mirroring rerelease `q_vec3` semantics and backed by Vitest coverage. The vec3 toolkit now also includes the bounds/matrix helpers from `q_vec3.h` (`ClearBounds`, `AddPointToBounds`, `boxes_intersect`, `R_ConcatRotations`, `RotatePointAroundVector`) so weapon offsets, collision volumes, and camera rotations can reuse the same math as the C++ rerelease. A shared pmove helper module (`applyPmoveFriction`, `applyPmoveAccelerate`, `pmoveCmdScale`, `buildAirGroundWish`, `buildWaterWish`) mirrors `PM_Friction`/`PM_Accelerate`/`PM_CmdScale`/`PM_AirMove`/`PM_WaterMove` setup from `p_move.cpp` as pure functions with detailed unit tests, ready to be reused by both game and client-side prediction. Screen-blend math (`G_AddBlend` equivalent) lives in shared color helpers so client HUD/effects can reuse the exact accumulation rules. Collision bitflag definitions for contents/surfaces (`CONTENTS_*`, `SURF_*`, `MASK_*`) now live in `shared/bsp/contents.ts`, keeping the TypeScript side numerically aligned with `game.h` and exercised via exhaustive unit tests. A deterministic `MersenneTwister19937` implementation plus `frandom`/`crandom`/`irandom`/`randomTime` helpers mirror the rerelease's `std::mt19937` usage in `g_local.h`, ensuring gameplay systems can reproduce the same random-time distributions and giving us reference-sequence Vitest coverage for multiple seeds.
3. **Filesystem & asset intake**: PAK reader and VFS; loaders for BSP (geometry + lightmaps + visibility), MD2/MD3 models, textures (WAL/PCX), and WAV/OGG audio; caching/index registry APIs.
4. **Render MVP**: WebGL2 context wrapper, shader setup, vertex/index buffer utilities, texture upload, basic BSP traversal + lightmap drawing, model rendering, and particle billboards. Ship `apps/viewer` to display a map with free-fly camera.
5. **Input + loop**: Pointer lock + keyboard/gamepad mapping, command buffer, fixed-step simulation loop with interpolation hooks for rendering.
6. **Shared pmove module**: Port rerelease movement to TypeScript in `packages/shared`; validate with golden tests for known edge cases (stairs, slides, water, air control quirks). The shared helpers now include pure mirrors of `PM_AirAccelerate`, `PM_CmdScale`, and the wishdir/wishspeed setup from `PM_AirMove`/`PM_WaterMove`, plus color blend math matching `G_AddBlend` from `rerelease/q_std.h` (line 151) so HUD/effects color math remains faithful. Clip-plane resolution now mirrors the inner loop of `PM_StepSlideMove_Generic` through a pure `resolveSlideMove` helper, enabling isolated tests for crease-vs-corner handling before wiring a full trace pipeline. A trace-driven `slideMove` wrapper now mirrors `PM_SlideMoveGeneric` (minus gravity/steps) so callers can exercise multi-bump collisions against scripted traces in unit tests, and a `stepSlideMove` helper mirrors `PM_StepSlideMove` including the pm_time velocity reset to validate stair-stepping independently of the full player state. Additional guards stop movement immediately when traces report the player starting inside solid geometry and clamp ceiling clips so upward impulses do not invert into downward bounces, matching rerelease behavior. A stuck-object fixer (`fixStuckObjectGeneric`) now mirrors `G_FixStuckObject_Generic` from `rerelease/p_move.cpp`, probing each face of a bounding box until it finds the smallest displacement out of solid space so both the authoritative game and client prediction can recover when spawn points or movers wedge entities.
7. **Game scaffolding**: Game API surface mirroring `GetGameAPI`; entity registry and spawn table; collision hooks to engine; minimal rules (worldspawn, player spawn, pickups); deterministic random + save registry. The new `GameFrameLoop` mirrors the rerelease `G_PrepFrame`/`G_RunFrame` cadence from `rerelease/g_main.cpp` by bumping `level.time` (now `frameLoop.time`) before world logic and sequencing prep/sim/post hooks so future systems can register deterministic work in the same order, and it now exposes stage registration/disposal so subsystems can plug into those phases dynamically. A lightweight `LevelClock` mirrors the rerelease `level.time` bookkeeping, with `createGame` subscribing it to the prep stage so gravity integration snapshots also report `frameNumber`/`timeSeconds`, giving the engine/client layers a faithful snapshot pipeline to hang tests on.
8. **Client/HUD scaffolding**: Client API surface mirroring `GetCGameAPI`; HUD drawing using renderer helpers; configstring parsing; prediction wiring using shared pmove; placeholder assets/fonts.
9. **Combat/items/AI**: Flesh out weapons, damage handling, powerups, and a subset of monsters; ensure deterministic behavior through tick-based logic and shared math utilities.
10. **Save/load path**: Serialize game + level state; implement rerelease JSON mapper; add snapshot tests for round-trip fidelity.
11. **Browser asset UX**: File selector/drag-drop UI; progress/error reporting; caching policy (indexedDB-backed optional); validation against expected PAK structure.
12. **Performance/stability pass**: Profiling hooks, culling refinements, shader variants for low-end GPUs, audio channel management, and input latency checks.
13. **Polish milestone**: Complete HUD, menus, accessibility toggles (FOV, subtitles), configurable bindings, and documented mod/expansion extension points.

## Readiness notes
- The rerelease mapping (`docs/rerelease-mapping.md`) provides the authoritative import/export and configstring behavior; the TS plan now mirrors those boundaries directly.
- All open questions in `docs/questions.md` are answered for the base-campaign scope; no further research is blocking bootstrap.
- Next concrete action: start exercising the fixed 40 Hz loop against the engine→game/client entrypoints (init/spawn/frame hooks) so we can validate the scheduling contract while fleshing out import/export tables. The `EngineHost` wrapper now wires the fixed-step loop to game/client snapshots, so the viewer/bootstrap app can be hooked up quickly. An `EngineRuntime` layer now starts/stops the engine alongside the host so embedders can spin up the loop with a single call.

## Extension hooks for later
- Expansion modules (CTF/Rogue/Xatrix) as opt-in packages that register additional spawn tables, assets, and rules via the same API surfaces.
- Networking/co-op scaffolding with protocol serializers reused from shared types.
- WebGPU renderer backend as an optional engine implementation.
