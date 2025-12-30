# Section 19-3: Game/Entity Utilities Migration

**Work Stream:** Game logic and entity test utilities
**Priority:** HIGH - Core game testing functionality
**Dependencies:** Section 19-1 (shared helpers, collision helpers)
**Parallel Status:** Can start after Section 19-1 Task 4 completes

---

## Overview

This section covers migration and expansion of game-specific test utilities including entity factories, AI/combat mocks, physics test helpers, spawn utilities, and save/load test utilities.

---

## Tasks

### 1. Expand Entity Factories (HIGH PRIORITY)

**Status:** Basic entity factory exists, needs expansion
**Dependencies:** Section 19-1 Task 3 (math helpers)

- [x] **1.1** Audit current entity factories in `test-utils/src/game/factories.ts`
- [x] **1.2** Add `createEntityFactory()` with comprehensive defaults
- [x] **1.3** Add `createPlayerEntityFactory()` specialized for players
- [x] **1.4** Add `createMonsterEntityFactory()` for AI entities
- [x] **1.5** Add `createItemEntityFactory()` for pickups
- [x] **1.6** Add `createProjectileEntityFactory()` for bullets/rockets/etc
- [x] **1.7** Add `createTriggerEntityFactory()` for triggers
- [x] **1.8** Cleanup inline entity creation in `game/tests/entities/` directory
- [x] **1.9** Cleanup inline entity creation in `game/tests/combat/` directory
- [x] **1.10** Cleanup inline entity creation in `game/tests/items/` directory

---

### 2. Expand Game Context Helpers (MEDIUM PRIORITY)

**Status:** Basic helpers exist, need enhancement
**Dependencies:** Task 1

- [x] **2.1** Enhance `createTestContext()` in `test-utils/src/game/helpers.ts`
- [x] **2.2** Add `createSpawnTestContext()` specialized for spawn testing
- [x] **2.3** Add `createCombatTestContext()` specialized for combat testing
- [x] **2.4** Add `createPhysicsTestContext()` for physics testing
- [x] **2.5** Cleanup context creation in `game/tests/spawn/` directory

---

### 3. Create AI/Combat Mock Factories (HIGH PRIORITY)

**Status:** Currently scattered mocks
**Dependencies:** None

- [x] **3.1** Create `test-utils/src/game/mocks/ai.ts` file
- [x] **3.2** Add `createMockAI()` factory
- [x] **3.3** Add `createMockMonsterAI()` for monster-specific AI
- [x] **3.4** Create `test-utils/src/game/mocks/combat.ts` file
- [x] **3.5** Add `createMockWeapon()` factory
- [x] **3.6** Add mock attack functions
- [x] **3.7** Add `createMockDamageInfo()` factory
- [x] **3.8** Cleanup combat mocks in `game/tests/combat/` directory
- [x] **3.9** Cleanup AI mocks in `game/tests/ai/` directory
- [x] **3.10** Cleanup monster attack mocks in `game/tests/monsters/` directory
    - [x] Refactored `soldier_variants.test.ts`
    - [x] Refactored `infantry.test.ts`, `berserk.test.ts`, `gladiator.test.ts`, `medic.test.ts`, `mutant.test.ts`, `parasite.test.ts`
    - [x] Refactored `boss2.test.ts`, `brain.test.ts`, `chick.test.ts`, `flipper.test.ts`, `flyer.test.ts`, `gekk.test.ts`, `guardian.test.ts`, `gunner.test.ts`, `icarus.test.ts`, `insane.test.ts`, `soldier.test.ts`
    - [x] Refactored `tank-blindfire.test.ts`, `supertank-heat-seeking.test.ts`, `turret.test.ts`, `tankCommander.test.ts`
    - [ ] Replace inline attack function mocks
    - Estimated files: ~26 (Refactored 22)

---

### 4. Create Inventory/Item Mock Factories (MEDIUM PRIORITY)

**Status:** Partially completed
**Dependencies:** Task 1 (entity factories)

- [x] **4.1** Create `test-utils/src/game/mocks/items.ts` file
- [x] **4.2** Add `createMockInventory()` factory
- [x] **4.3** Add `createMockItem()` factory
- [x] **4.4** Add item-specific factories
- [x] **4.5** Add `createMockPowerup()` factory
- [ ] **4.6** Cleanup item mocks in `game/tests/items/` directory
    - [x] Refactored `ammo.test.ts` and `weapons.test.ts`
    - [x] Refactored `health.test.ts`
    - Estimated files: ~10

---

### 5. Create Physics Test Helpers (MEDIUM PRIORITY)

**Status:** Completed
**Dependencies:** Section 19-1 Task 4 (collision helpers)

- [x] **5.1** Create `test-utils/src/game/helpers/physics.ts` file
- [x] **5.2** Add `simulateMovement()` helper
- [x] **5.3** Add `simulateGravity()` helper
- [x] **5.4** Add `simulateJump()` helper
- [x] **5.5** Add `createPhysicsTestScenario()` helper
- [ ] **5.6** Cleanup physics tests in `game/tests/physics/` directory

---

### 6. Create Save/Load Test Utilities (MEDIUM PRIORITY)

**Status:** In Progress
**Dependencies:** Task 1, Task 2

- [x] **6.1** Create `test-utils/src/game/helpers/save.ts` file
- [x] **6.2** Add `createMockSaveGame()` factory
- [x] **6.3** Add `createSaveGameSnapshot()` helper
- [x] **6.4** Add `restoreSaveGameSnapshot()` helper
- [x] **6.5** Add `compareSaveGames()` helper
- [ ] **6.6** Cleanup save/load tests in `game/src/save/tests/` directory

---

### 7. Create Spawn System Utilities (LOW PRIORITY)

**Status:** Basic spawn context exists
**Dependencies:** Task 1, Task 2

- [x] **7.1** Create `test-utils/src/game/helpers/spawn.ts` file
- [x] **7.2** Add `createSpawnRegistry()` helper
- [x] **7.3** Add `registerTestSpawn()` helper
- [x] **7.4** Add `spawnTestEntity()` helper
- [x] **7.5** Cleanup spawn tests in `game/tests/spawn/` directory
    - Estimated files: ~10

---

### 8. Create Game State Factories (LOW PRIORITY)

**Status:** Basic snapshot factory exists
**Dependencies:** Task 1, Task 2

- [x] **8.1** Enhance `createGameStateSnapshotFactory()` in `test-utils/src/game/factories.ts`
- [x] **8.2** Add `createServerFrameFactory()` factory
- [x] **8.3** Add `createGameExportsFactory()` factory
- [x] **8.4** Add `createClientSnapshotFactory()` factory

---

### 9. Documentation and Exports (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Tasks 1-8

- [ ] **9.1** Add JSDoc comments to all game utilities
- [x] **9.2** Update `test-utils/README.md` with game utilities section
- [x] **9.3** Verify all game utilities exported from `test-utils/src/index.ts`
- [ ] **9.4** Add TypeScript type exports

---

## Summary

**Total Tasks:** 9
**Total Subtasks:** 64
**Estimated Impact:** ~150+ test files updated, ~800 lines of new utilities
**Critical Path:** Task 1 (entity factories) blocks most other tasks
**Parallel Opportunities:** Tasks 3-4 can run in parallel after Task 1; Tasks 5-8 can run in parallel after Task 2
