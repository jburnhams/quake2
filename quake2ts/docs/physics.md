# Physics and Collision

This document tracks the ongoing work to implement a faithful and robust physics and collision system for the Quake II TypeScript port. It serves as a central repository for research, analysis, and a detailed task list.

## Original Implementation Notes

After investigating the `rerelease` directory, I've determined that it contains the source code for the game logic module, not the game engine. The core collision detection and tracing functions, such as the fabled `CM_BoxTrace`, are part of the engine and their source is not present in this directory.

However, I have found the key interface between the engine and the game logic in `rerelease/game.h`. The `game_import_t` struct defines the `trace` function pointer that the engine provides to the game.

The `trace_t` struct, also defined in `game.h`, provides the following information about a collision:

- `allsolid`: `true` if the trace started and ended in a solid area.
- `startsolid`: `true` if the trace started in a solid area.
- `fraction`: The percentage of the trace that was completed before a collision occurred.
- `endpos`: The position where the collision occurred.
- `plane`: The plane of the surface that was hit.
- `surface`: The surface that was hit.
- `contents`: The contents of the brush that was hit.
- `ent`: The entity that was hit (if any).

I will use this information, along with the way the game logic in the `rerelease` directory calls the `trace` function, to infer the correct behavior of the original engine's implementation.

## TypeScript Implementation Analysis

The existing TypeScript implementation in `packages/shared/src/bsp/collision.ts` appears to be a reasonably complete port of the original engine's collision detection logic. The `traceBox` function is the equivalent of `CM_BoxTrace`, and the `TraceResult` and `CollisionTraceResult` interfaces are very similar to the `trace_t` struct.

This effort is focused on building a comprehensive test suite to verify the behavior of the `traceBox` function and ensure it matches the original Quake II code exactly. The tests have been refactored into a new file, `packages/shared/tests/bsp/trace.test.ts`.

## Task List

- [ ] Set up a testing environment for `traceBox`.
- [ ] Create a helper module to generate simple, verifiable BSP data fixtures for testing. (Used existing helpers).
- [ ] Implement a test for a trace with no collision.
- [ ] Implement a test for a trace that hits a single, axis-aligned plane.
- [ ] Implement a test for a trace that starts inside a solid object.
- [ ] Implement a test for a trace that grazes a surface.
- [ ] Implement tests for corner collisions.
- [ ] Continue to add more complex test cases to cover all edge cases.
- [ ] Refine the `traceBox` implementation to pass all tests.
- [ ] Update this document with any new findings or tasks.
