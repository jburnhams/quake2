# Questions

## Answered
- Which subset of expansions (CTF, Rogue, Xatrix) should the initial quake2ts scope cover, and should they be modular or bundled by default? → **None initially**; design the port to load only the base campaign at first while keeping expansion hooks modular for later.
- Are we targeting parity with rerelease-specific physics toggles (e.g., N64 mode, air acceleration cvar) or classic defaults only? → **Classic defaults only**; defer rerelease-exclusive toggles unless they can be layered without risking regressions.
- What is the preferred delivery path for copyrighted assets in the browser (user-provided PAKs, patcher workflow, or licensed redistribution)? → **User-provided PAKs** loaded through a browser-friendly file drop/selector; no baked redistribution.
- Should the save format aim to be compatible with rerelease JSON saves, or is a clean TS-specific schema acceptable if we preserve deterministic reloads? → **Use a TS-specific format** but ship a mapping utility that can read/write the rerelease JSON structure when feasible.
- How much of the bot support (weapon selection, trigger hooks) needs to be retained for single-player, given the exported bot callbacks in the rerelease game API? → **None for now**; strip bot-specific hooks from the initial scope.

## Needs More Info
- _None currently._

## New / Unanswered
- _None currently._
