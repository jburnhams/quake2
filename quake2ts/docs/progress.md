# Progress

## Current focus
- Extend the Quake II rerelease mapping into renderer/asset bridges (precache hooks, HUD draw utilities, protocol constants) so the quake2ts architecture can mirror the server/client split under the chosen scope (base campaign only, classic physics, user-supplied assets, TS-native saves, no bots).

## Artifacts in this stage
- `docs/rerelease-mapping.md`: structural map of the rerelease server/client/game modules and how they relate to the planned TypeScript/WebGL layers.
- `docs/questions.md`: open questions to resolve before committing to the porting approach.

## Next up
- Draft TypeScript-facing interfaces that mirror `game_export_t` / `cgame_export_t` after the renderer/asset bridge notes.
- Sketch browser-friendly asset ingestion steps (user-provided PAKs, precache indices) aligned with the rerelease import tables.
- Note engine protocol or asset differences that could impact browser-based parity.
