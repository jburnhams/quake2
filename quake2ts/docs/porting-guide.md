# Porting Guide: C to TypeScript

## Overview
This guide outlines the patterns and conventions for porting standard Quake II C code (`game` module) to TypeScript (`@quake2ts/game`).

## Naming Conventions
- **Functions**: Retain original C names where possible (e.g., `SP_monster_medic`, `G_RunFrame`) to make searching easy, OR use camelCase for new/utility functions.
- **Variables**: Use camelCase (e.g., `current_move` -> `currentMove` is preferred, but `monsterinfo` often keeps snake_case properties to match C structs).
- **Constants**: UPPER_CASE (e.g., `FOFS_0`).

## Structs vs Interfaces
- C `structs` map to TS `interfaces`.
- `edict_t` maps to `Entity` class (in `packages/game/src/entities/entity.ts`).
- `gclient_t` maps to `PlayerClient` interface.

## Memory Management
- C uses manual memory (`G_Spawn`, `G_FreeEdict`).
- TS uses `EntitySystem.spawn()` and `EntitySystem.free()`.
- **Garbage Collection**: TS handles memory, but `EntitySystem` manages the *lifecycle* and re-use of entity slots (indices). Always use `free()` to mark an entity as removed from the game world.

## Math
- Use `@quake2ts/shared` for vector math (`Vec3`, `addVec3`, `dotProduct`, etc.).
- Do not overload operators (TS doesn't support it).
- `VectorMA(origin, scale, dir, out)` -> `out = addVec3(origin, scaleVec3(dir, scale))`.

## Global State
- Avoid global variables (`level`, `game`, `globals`).
- Pass `EntitySystem` (context) to functions.
- Access global state via `context.level`, `context.game`.

## Source References
- Add comments referencing the original file and function name when porting complex logic.
  ```typescript
  // Source: g_weapon.c : fire_bfg
  ```

## Common Patterns
- **Think Functions**: `ent->think = func` becomes `ent.think = (self, ctx) => func(self, ctx)`.
- **Touch Functions**: `ent->touch = func` becomes `ent.touch = (self, other, plane, surf) => func(...)`.
- **Spawn Functions**: Register via `SpawnRegistry`.

## Checking for regressions
- Write unit tests that mirror the logic of the C code.
- Use `determinism.test.ts` to ensure stability.
