# Progress

## Current focus
- Stand up the TypeScript workspace skeleton (pnpm + project references) with placeholder packages and a CI loop that exercises builds/tests.
- Solidify the shared physics helpers (friction, ground/air acceleration, and screen-blend math) so the engine, client, and game can reuse deterministic movement semantics from `rerelease/p_move.cpp` and `q_std.h`.

## Recent additions
- Ported `PM_AirAccelerate` semantics into the shared pmove helpers with Vitest coverage that verifies the 30-unit clamp and wishspeed-driven acceleration (see `rerelease/p_move.cpp` lines 612-636).
- Tightened the shared `G_AddBlend` expectations to mirror `rerelease/q_std.h` line 151 so fully opaque blends accumulate based on the stored alpha fraction before hitting 1.0.
- Added pnpm workspace scaffolding (`packages/{engine,game,client,shared,tools}` and `apps/viewer`) with `tsc -b` wiring for project references.
- Seeded Vitest with an initial shared math test to validate the harness and strict TypeScript settings.
- Introduced a GitHub Actions workflow that installs dependencies and runs the workspace build/test steps on pushes/PRs touching `quake2ts/**`.

## Artifacts in this stage
- `docs/rerelease-mapping.md`: structural map of the rerelease server/client/game modules and how they relate to the planned TypeScript/WebGL layers.
- `docs/questions.md`: open questions to resolve before committing to the porting approach.
- `implementation.md`: end-to-end implementation plan and milestones for the quake2ts port.

## Next up
- Expand the engine→game/client interface stubs beyond the placeholder lifecycle/hooks now in the scaffolding packages.
- Sketch the browser asset-ingestion UX (file drop/selector, caching/error UX) aligned with the configstring/index pipeline documented in the plan.
- Enumerate renderer/input abstractions the HUD/client module needs from the engine (pic/font helpers, text metrics, cvars) to keep the UI sandboxed.
- Continue building out the shared pmove helpers (air/water move, clipping/slide helpers, etc.) so client prediction and the authoritative game layer can share identical movement math.
