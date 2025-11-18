# Progress

## Current focus
- Stand up the TypeScript workspace skeleton (pnpm + project references) with placeholder packages and a CI loop that exercises builds/tests.

## Recent additions
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
