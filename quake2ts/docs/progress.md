# Progress

## Current focus
- Capture the import/export surfaces for game and client modules (renderer/HUD hooks, pmove sharing, save calls) and translate them into TypeScript-facing plans under the constrained scope (base campaign only, classic physics, user-supplied assets, TS-native saves, no bots).

## Artifacts in this stage
- `docs/rerelease-mapping.md`: structural map of the rerelease server/client/game modules and how they relate to the planned TypeScript/WebGL layers.
- `docs/questions.md`: open questions to resolve before committing to the porting approach.

## Next up
- Draft concrete TS interface stubs for engine→game/client imports/exports to guide scaffolding.
- Outline the browser asset-ingestion UX (file drop/selector, caching/error UX) mapped to configstring/index flows.
- Log renderer/input abstractions the HUD/client module expects so the engine layer stays cleanly separated.
