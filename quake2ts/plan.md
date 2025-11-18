High-level plan for quake2ts (single-player, WebGL/TypeScript)
1) Orient on existing codebase
Map the rerelease modules (combined baseq2/ctf/rogue/xatrix game code and thin client-game layer) to understand server vs. client responsibilities, movement exports, and protocol changes.

Inventory core systems needed for offline single-player: rendering, input, physics/pmove, AI, scripting/spawns, sound, save/load, and resource formats.

2) Define the TypeScript/WebGL architecture
Split into packages: engine (render, input, audio, filesystem/asset loading), game (entities, physics, AI, rules), client (prediction, HUD, UI), shared (protocol structs, math, utilities).

Establish strict typing for protocol-like data (e.g., entity states, pmove commands) to mirror the C structs while using idiomatic TS types/classes.

3) Rendering and assets
Choose WebGL2 (or WebGPU later) with a thin abstraction for buffers/shaders/textures; plan to support Quake II BSP, MD2/MD3 models, lightmaps, and particles.

Build a loader pipeline (possibly glTF as an intermediate) and a material system that can approximate Quake II lighting without fixed function.

4) Input, timing, and simulation loop
Implement a deterministic main loop (target 40 Hz simulation to match rerelease timing) with decoupled render framerate; design for client prediction hooks similar to pmove exports.

Map browser input (keyboard/mouse/locked pointer, gamepad) into command buffers.

5) Gameplay systems
Port entity system with component-style helpers to replace C structs; cover movement, combat, inventory, triggers, and AI behaviors needed for the base campaign.

Recreate physics quirks intentionally preserved in rerelease (trick jumps, compression artifacts) but encode them explicitly in TypeScript logic.

6) Audio
Use WebAudio for spatialized sound; design data converters for legacy sound assets and match positioning rules (e.g., beams/brush models) described in the rerelease notes.

7) Save/load and persistence
Mirror rerelease JSON-style saves (instead of pointer snapshots) using structured TS data; ensure deterministic serialization of entity state.

8) Tooling and testing
Set up monorepo scaffolding (pnpm workspace or similar), ESLint/Prettier, and Vitest/Jest for unit tests; add Playwright or Cypress for minimal smoke tests of the render loop.

Write golden tests for math/physics helpers and snapshot tests for serialized save data.

9) Milestone path
Bootstrap: project layout, math library, basic WebGL renderer, asset stubs.

Core loop: input + simulation tick + camera, simple map loading (BSP viewer).

Movement: player controller with pmove parity and collision.

Combat/AI: weapons, damage, and a minimal enemy to validate systems.

Campaign-ready: full entity set, triggers, saves, HUD, and menu.

Polish: performance passes, accessibility, and extensibility hooks.

10) Risks and mitigations
Asset licensing/packaging for browser delivery—plan for user-supplied data or patchers.

Performance on lower-end GPUs—budget-friendly shader paths and culling.

Network code can be deferred; keep architecture ready for future co-op.
