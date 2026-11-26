# Determinism in Quake2TS

## Overview
Quake2TS aims for **strict deterministic execution** of the game simulation. This means that given the same initial state (seed) and the same sequence of user inputs (commands), the game state must evolve identically on every run.

This is critical for:
- **Save/Load**: Loading a game must restore the state exactly.
- **Replays/Demos**: Playing back recorded inputs must produce the exact same visual and logical outcome.
- **Client Prediction**: The client predicts future frames based on shared logic; divergence causes "snapping" artifacts.

## Rules for Determinism

### 1. Random Number Generation
**NEVER** use `Math.random()`.
It is not seedable and not consistent across environments.

**ALWAYS** use the provided `RandomGenerator` instance:
- `game.random.frandom()`: Returns float [0, 1).
- `game.random.crandom()`: Returns float [-1, 1).
- `game.random.irandom(n)`: Returns integer [0, n-1].

Entities access this via `sys.rng` or `context.rng`.

### 2. Time
Do not use `Date.now()` or `performance.now()` for game logic.
Use `level.time` (or `sys.timeSeconds`) which advances by fixed time steps (e.g., 0.1s for monsters, 0.016s for physics).

### 3. Iteration Order
JavaScript `Map` and `Set` iterate in insertion order. This is generally safe **IF** insertion order is deterministic.
- Avoid iterating over collections where insertion order depends on nondeterministic events (like network packet arrival order, unless sequenced).
- When in doubt, sort by a stable key (e.g., `entity.index`) before processing.

### 4. Floating Point Math
JavaScript uses IEEE 754 doubles. This is generally consistent across modern browsers and Node.js.
- Be careful with precision accumulation.
- Avoid functions that might differ across implementations (though most standard `Math` functions are standardized now).

## Testing
Use the `tests/determinism.test.ts` suite to verify that your changes do not break determinism.
- Run the test suite: `pnpm test tests/determinism.test.ts`
