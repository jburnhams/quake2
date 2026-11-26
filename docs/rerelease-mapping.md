# Rerelease codebase mapping (quake2ts intake)

## Scope and objectives
- Identify how the rerelease splits responsibilities between the server-side game DLL, the client game/HUD layer, shared movement code, and expansion packs.
- Translate those boundaries into actionable notes for the TypeScript/WebGL architecture planned in `plan.md`.

## Layout highlights
- `g_main.cpp` exposes the game DLL entry points (`PreInit`, `Init`, `Shutdown`, `SpawnEntities`, `Pmove`, client connect/think, save/load hooks, bot callbacks) via `GetGameAPI`, defining what the engine expects from the server-side module.【F:rerelease/g_main.cpp†L403-L457】
- `cg_main.cpp` provides the client-game exports (`Pmove`, HUD drawing, layout flags, parsing config strings/centerprint/notify) in `GetCGameAPI`, framing the thin presentation and prediction layer that sits beside the engine renderer.【F:rerelease/cg_main.cpp†L7-L123】
- `p_move.cpp` includes `bg_local.h` with `GAME_INCLUDE` to share player-movement code between server and client builds, preserving deterministic behavior across both sides.【F:rerelease/p_move.cpp†L4-L158】
- `game.h` centralizes API versions, limits (clients, edicts, models, sounds), vector aliases, and cvar definitions shared by the game and client modules.【F:rerelease/game.h†L111-L200】
- Expansion/variant logic (e.g., CTF match/election state, team scores, asset precaches) lives under subdirectories like `ctf/`, extending the base game through the same server-side entry points.【F:rerelease/ctf/g_ctf.cpp†L25-L98】

## Server-side gameplay map
- **Lifecycle & integration (`g_main.cpp`):** Implements engine callbacks for initialization, level spawning, frame ticking, client lifecycle, save/load, and bot hooks, defining the authoritative simulation API surface quake2ts must mirror.【F:rerelease/g_main.cpp†L403-L457】
- **Game rules & world systems:** `g_*.cpp` files cover combat (`g_combat`, `g_weapon`), entities/spawns (`g_spawn`, `g_func`, `g_trigger`, `g_misc`), AI (`g_ai`, per-monster `m_*.cpp`), physics (`g_phys`), and utilities (`g_utils`). These will inform entity components and rule systems in TypeScript.
- **Save/load:** JSON-oriented save functions (`WriteGameJson`, `ReadGameJson`, level variants) are part of the exported surface, signaling the need for deterministic serialization in the TS port.【F:rerelease/g_main.cpp†L421-L427】

### Gameplay subsystems (deep dive)
- **Entity/spawn registry:** `g_spawn.cpp` maps every `classname` to a spawn function across players, movers, triggers, targets, worldspawn, decorative misc, and monsters—this is the authoritative list quake2ts must mirror when parsing map files.【F:rerelease/g_spawn.cpp†L6-L200】
- **Items/inventory:** `g_items.cpp` centralizes item definitions, lookup helpers (by index/ammo/powerup/classname), and respawn logic for pickup entities, including deathmatch and random respawn behavior.【F:rerelease/g_items.cpp†L6-L198】
- **Monster AI:** `g_ai.cpp` drives perception (target search, visibility), movement helpers, and engagement loops (stand/walk/run/check attack), forming the baseline behavior model for AI-controlled entities.【F:rerelease/g_ai.cpp†L20-L158】
- **Save system internals:** `g_save.cpp` implements the JSON save format with type-tag metadata, hash maps for registered structures, and strict validation paths; quake2ts needs equivalent registration and schema discipline to support compatible exports/mapping.【F:rerelease/g_save.cpp†L18-L200】

## Client-game (HUD/prediction) map
- **Exports (`cg_main.cpp`):** Provides `Pmove` for client prediction, HUD rendering (`DrawHUD`), layout flags, picture touching/precache, and helpers for weapon/powerup wheel state, keeping client display in sync with server stats.【F:rerelease/cg_main.cpp†L15-L123】
- **Config handling:** Parses configstrings affecting movement (N64 physics toggle, air acceleration) to align local prediction with server physics choices.【F:rerelease/cg_main.cpp†L67-L74】
- **HUD/state plumbing:** `cg_screen.cpp` defines HUD layout constants, split-screen HUD storage (centerprints, notifications), and helpers for layout visibility; the TS client module will need comparable presentation state and cvar-driven rendering toggles.【F:rerelease/cg_screen.cpp†L5-L159】

## Shared movement/physics
- **`p_move.cpp`:** Shared pmove implementation with utilities for resolving stuck positions and ensuring identical state across client/server invocations; establishes the deterministic movement core quake2ts must port first.【F:rerelease/p_move.cpp†L4-L158】

## Expansion packs & variants
- **CTF (`ctf/g_ctf.cpp`):** Manages team scores, match/election state, cvars, and precached assets—illustrating how game-mode extensions hook into the base systems. Similar patterns will appear in `rogue/` and `xatrix/` directories.【F:rerelease/ctf/g_ctf.cpp†L25-L98】
- **Rogue:** Adds physics and gameplay variants (e.g., `SV_Physics_NewToss` for expanded toss/bounce handling) plus new items/monsters/weapons via parallel `g_rogue_*` modules, showing how expansion rules override or extend base behaviors.【F:rerelease/rogue/g_rogue_phys.cpp†L6-L118】
- **Xatrix (The Reckoning):** Introduces expansion-specific pickups and combat variations (e.g., `SP_item_foodcube` with health and sound tweaks), reinforcing the need for modular content loading in quake2ts.【F:rerelease/xatrix/g_xatrix_items.cpp†L6-L30】

### Initial scope decisions (per answers)
- Target **base campaign only** for the first milestone; keep CTF/Rogue/Xatrix hooks modular but disabled by default.
- Emulate **classic physics defaults** only; defer rerelease-only toggles (e.g., N64 mode, air acceleration cvar) unless they can be layered without altering the baseline.
- Require **user-provided PAK assets** loaded through a browser flow (file selector/drag-drop); do not redistribute copyrighted data.
- Use a **TypeScript-native save format** with a compatibility mapper capable of reading/writing rerelease JSON saves when parity allows.
- Omit **bot-specific callbacks** from the initial port; revisit only if future modes need them.

## TypeScript/WebGL mapping cues
- Mirror the **game vs. client-game split**: a TypeScript `engine` package should host renderer/input/loop services, while `game` encapsulates authoritative simulation APIs analogous to `GetGameAPI`; a `client` package should cover HUD/prediction exports parallel to `GetCGameAPI`.
- Treat **shared movement** as a dedicated module compiled for both server and client contexts to guarantee parity (akin to `p_move.cpp` with `GAME_INCLUDE`).
- Preserve **save/load determinism** by designing structured state serialization compatible with JSON-based saves exposed in the rerelease exports.【F:rerelease/g_main.cpp†L421-L427】
- Model **game-mode extensions** as pluggable feature modules so CTF/Rogue/Xatrix behaviors can be layered without forking the core simulation.【F:rerelease/ctf/g_ctf.cpp†L25-L98】
- Map the **asset/renderer bridge** explicitly: server-side imports handle model/sound/image registration (`modelindex`, `soundindex`, `imageindex`) and apply models to entities via `setmodel`, so the TS engine must expose equivalent precache/index bookkeeping to feed WebGL/WebAudio loaders.【F:rerelease/game.h†L1909-L1919】
- Mirror **client-render hooks**: the client import table offers HUD drawing and asset lookup utilities (`Draw_RegisterPic`, `Draw_GetPicSize`, `SCR_DrawPic/ColorPic`, font metrics) that the TS renderer layer should surface for the HUD module, matching the `cgame_export_t` expectations for `DrawHUD`, `TouchPics`, and layout flag queries.【F:rerelease/game.h†L2188-L2233】【F:rerelease/game.h†L2260-L2314】
- Track **protocol/compatibility constants** like `PROTOCOL_VERSION` and `PROTOCOL_VERSION_DEMOS` to keep any browser-side networking/demo playback aligned with rerelease expectations, even if initial scope remains offline.【F:rerelease/game.h†L2172-L2174】

## Game/client interfaces to mirror in TypeScript
- **Engine→game imports (`game_import_t`):** Message dispatch (`Broadcast_Print`, `Client_Print`, centerprint), asset indexers (`modelindex`, `soundindex`, `imageindex`) plus `setmodel`, and collision queries (`trace`, `clip`, `pointcontents`) define the minimal services the TS engine must expose to the game simulation.【F:rerelease/game.h†L1882-L1925】
- **Game exports (`game_export_t`):** Lifecycle (`PreInit`, `Init`, `Shutdown`), level spawning, JSON save/read pairs for game/level, and client lifecycle/command hooks form the authoritative surface the engine calls into; TS should keep parity so save serialization stays deterministic.【F:rerelease/game.h†L2063-L2104】
- **Engine→client imports (`cgame_import_t`):** Configstring access, cvar plumbing, renderer/HUD drawing helpers, and client timing/protocol accessors bound the HUD/prediction module to engine services the TS runtime must provide.【F:rerelease/game.h†L2180-L2255】
- **Client exports (`cgame_export_t`):** HUD lifecycle (`Init`/`Shutdown`), draw entry points (`DrawHUD`, `TouchPics`), layout flags, weapon/powerup wheel helpers, pmove export, and configstring/centerprint parsing callbacks capture the TS HUD module responsibilities.【F:rerelease/game.h†L2260-L2314】

### Asset ingestion notes for the browser pipeline
- Use the rerelease **configstring/index pattern** as the contract: TS engine should accept user-provided PAKs, register models/sounds/images via indexers, and feed hashed/configstring identifiers to the client module for HUD/level use.【F:rerelease/game.h†L1909-L1919】【F:rerelease/game.h†L2188-L2233】
- Mirror **save-call expectations** by keeping JSON-friendly, deterministic structures so rerelease saves can be mapped even if internal TS schemas differ.【F:rerelease/game.h†L2078-L2088】
- Keep **pmove callable from both game and client** as shared logic compiled twice (or imported as a pure module) to maintain prediction parity without duplicating behavior.【F:rerelease/game.h†L2132-L2149】【F:rerelease/game.h†L2292-L2299】

## Immediate follow-ups
- Compile a TS-facing interface draft (types/packages) directly from the import/export lists to guide scaffolding.
- Outline asset ingestion UX for the browser (drop/selector, cache policies, error handling) tied to the index/configstring flow.
- Identify renderer/input abstractions required for the HUD/client module to stay sandboxed from engine details.
