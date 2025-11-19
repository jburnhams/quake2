# Progress

## Current focus
- Stand up the TypeScript workspace skeleton (pnpm + project references) with placeholder packages and a CI loop that exercises builds/tests.
- Solidify the shared physics helpers (friction, ground/air acceleration, and screen-blend math) so the engine, client, and game can reuse deterministic movement semantics from `rerelease/p_move.cpp` and `q_std.h`.
- Build a deterministic main loop in the engine package that drives a 40 Hz simulation tick with render-time interpolation so the client/game layers can start wiring real frame execution paths.

## Recent additions
- Ported `PM_AirAccelerate` semantics into the shared pmove helpers with Vitest coverage that verifies the 30-unit clamp and wishspeed-driven acceleration (see `rerelease/p_move.cpp` lines 612-636).
- Tightened the shared `G_AddBlend` expectations to mirror `rerelease/q_std.h` line 151 so fully opaque blends accumulate based on the stored alpha fraction before hitting 1.0.
- Added pnpm workspace scaffolding (`packages/{engine,game,client,shared,tools}` and `apps/viewer`) with `tsc -b` wiring for project references.
- Seeded Vitest with an initial shared math test to validate the harness and strict TypeScript settings.
- Introduced a GitHub Actions workflow that installs dependencies and runs the workspace build/test steps on pushes/PRs touching `quake2ts/**`.
- Implemented `clipVelocityVec3`/`clipVelocityAgainstPlanes` to mirror `PM_ClipVelocity` and the plane resolution loop in `PM_StepSlideMove_Generic`, with unit tests covering crease projection and STOP_EPSILON zeroing.
- Ported `PM_CmdScale` as `pmoveCmdScale` so movement wishvel mixes stay capped at the configured max speed, with Vitest coverage for cardinal, diagonal, and vertical input combinations.
- Added wishdir/wishspeed builders for ground/air and water movement that mirror the setup phases of `PM_AirMove` and `PM_WaterMove`, including the water upward bias and maxspeed halving, with dedicated unit coverage.
- Added an engine-level `FixedTimestepLoop` with accumulator/catch-up limits and interpolation reporting, plus Vitest coverage for accumulator progression, substep capping, and start/stop scheduling.
- Built an `EngineHost` wrapper around the fixed-step loop to drive game simulation snapshots and feed previous/latest frames to the client renderer, with unit coverage for init/shutdown ordering and manual pump control.
- Introduced an `EngineRuntime` harness that wires engine init/shutdown around the host and client/game lifecycles so embedders can spin the fixed-step loop up with a single call; the viewer bootstrap now uses it.
- Added `resolveSlideMove`, a pure clip-plane accumulator mirroring the inner loop of `PM_StepSlideMove_Generic` so slide/crease resolution can be unit-tested outside of the full pmove trace path.
- Added a trace-driven `slideMove` helper that mirrors `PM_SlideMoveGeneric` (minus gravity/stepping) and scripts collision planes through unit tests to verify multi-bump handling.
- Added a pmove-style `stepSlideMove` that mirrors `PM_StepSlideMove`, including the pm_time velocity preservation flag and bounding-box-aware traces, with tests that step onto a 16u ledge and fall back to the flat slide path when stepping is blocked.

## Artifacts in this stage
- `docs/rerelease-mapping.md`: structural map of the rerelease server/client/game modules and how they relate to the planned TypeScript/WebGL layers.
- `docs/questions.md`: open questions to resolve before committing to the porting approach.
- `implementation.md`: end-to-end implementation plan and milestones for the quake2ts port.

## Next up
- Expand the engine→game/client interface stubs beyond the placeholder lifecycle/hooks now in the scaffolding packages, now that the fixed-step loop surface exists.
- Sketch the browser asset-ingestion UX (file drop/selector, caching/error UX) aligned with the configstring/index pipeline documented in the plan.
- Enumerate renderer/input abstractions the HUD/client module needs from the engine (pic/font helpers, text metrics, cvars) to keep the UI sandboxed.
- Continue building out the shared pmove helpers (air/water move, clipping/slide helpers, etc.) so client prediction and the authoritative game layer can share identical movement math, now including the clip-plane resolution helper mirrored from `PM_StepSlideMove_Generic` and the stepped variant of `PM_StepSlideMove`.
