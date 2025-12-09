# Section 18: Client Integration & Final Polish

## Overview
This section focuses on making `quake2ts` usable by client applications, refining the API surface, fixing critical determinism issues, and ensuring a robust build and test pipeline. These tasks are essential for integrating the engine into a larger application (like a web-based game client) and ensuring the port is of high quality.

## Dependencies
- **All Packages**: API surface and build/test improvements affect all packages.
- **Game/Shared**: Determinism fixes are critical here.
- **Client**: Exposure of client-side APIs.

## Tasks

### 1. Fix Critical Determinism Issues (Math.random)
**Priority**: **CRITICAL**
**Description**: 18+ files use `Math.random()` which breaks deterministic replay and save/load.
**Tasks**:
- [x] **packages/engine/src/render/particleSystem.ts**: Change constructor to require `RandomGenerator`. (Verified already implemented and using RNG)
- [x] **packages/game/src/entities/monsters/*.ts**: Replace `Math.random()` with `game.random.frandom()`/`crandom()`. (Verified and fixed `rogue` monsters)
- [x] **packages/game/src/entities/utils.ts**: Update random helpers to use game RNG. (Verified no Math.random usage found)
- [x] **packages/game/src/entities/monsters/attack.ts**: Fix standalone `random()` usage. (Verified no Math.random usage found)
- [x] **Test**: Add a determinism test suite (same seed -> same state).

### 2. Complete Missing Critical Features (TODOs)
**Priority**: **HIGH**
**Description**: Address "TODO" comments that mark features as complete but are actually missing implementation.
**Tasks**:
- [ ] **Player State**: Wire up `pmFlags`, `viewangles`, `fov`, `ammo`, `damageAlpha` in `packages/game/src/index.ts`.
- [ ] **Worldspawn Configstrings**: Set `CS_SKY`, `CS_SKYROTATE`, `CS_SKYAXIS`, `CS_CDTRACK` in `packages/game/src/entities/worldspawn.ts`.
- [ ] **Gib Effects**: Add `TE_BLOOD` shower in `packages/game/src/entities/gibs.ts`.
- [ ] **Medic Cable**: Add `TE_MEDIC_CABLE_ATTACK` visual effect in `packages/game/src/entities/monsters/medic.ts`.

### 3. Improve Code Quality & Type Safety
**Priority**: **MEDIUM**
**Description**: Enhance type definitions and remove magic numbers.
**Tasks**:
- [ ] **Loose Entity Typing**: Define stricter interfaces for `DamageableEntity` and `MonsterEntity`.
- [ ] **Magic Numbers**: Extract constants for values like `BFG_LASER_RADIUS`, `JORG_ATTACK_CHANCE`.
- [ ] **Source References**: Add comments referencing original C++ source locations.

### 4. Build & Test Pipeline Improvements
**Priority**: **MEDIUM**
**Description**: Ensure robust CI/CD and testing.
**Tasks**:
- [ ] **Asset Validation**: Add scripts/tests to validate test assets in CI.
- [ ] **Bundle Size**: Add tracking for bundle sizes.
- [ ] **Regression Tests**: Add tests comparing ported functions to original behavior (e.g., Medic resurrection).

### 5. Documentation
**Priority**: **LOW**
**Description**: Create guides for determinism and porting.
**Tasks**:
- [ ] **Determinism Guide**: Create `docs/determinism.md`.
- [ ] **Porting Guide**: Create `docs/porting-guide.md`.

## Success Criteria
- Zero uses of `Math.random()` in game/shared code.
- Determinism tests passing.
- Critical TODOs resolved.
- Improved type safety and documentation.
