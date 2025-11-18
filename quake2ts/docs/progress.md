# Progress

## Current focus
- Lock the implementation plan to the rerelease import/export surfaces and configstring behavior so engine/game/client package scaffolding can begin.

## Recent additions
- Expanded `implementation.md` to mirror rerelease import/export tables, configstring/index flows, HUD renderer helpers, and readiness checkpoints tied to `docs/rerelease-mapping.md` and `docs/questions.md`.

## Artifacts in this stage
- `docs/rerelease-mapping.md`: structural map of the rerelease server/client/game modules and how they relate to the planned TypeScript/WebGL layers.
- `docs/questions.md`: open questions to resolve before committing to the porting approach.
- `implementation.md`: end-to-end implementation plan and milestones for the quake2ts port.

## Next up
- Draft TypeScript interface stubs for engine→game/client imports/exports and land pnpm workspace/tooling skeleton to host them.
- Sketch the browser asset-ingestion UX (file drop/selector, caching/error UX) aligned with the configstring/index pipeline documented in the plan.
- Enumerate renderer/input abstractions the HUD/client module needs from the engine (pic/font helpers, text metrics, cvars) to keep the UI sandboxed.
