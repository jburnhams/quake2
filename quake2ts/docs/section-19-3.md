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
  - Current: `createPlayerStateFactory()`, `createEntityStateFactory()`, `createGameStateSnapshotFactory()`

- [x] **1.2** Add `createEntityFactory()` with comprehensive defaults
  - Signature: `createEntityFactory(overrides?: Partial<Entity>): Entity`
  - Include: `classname`, `health`, `maxHealth`, `origin`, `velocity`, `angles`, `solid`, `moveType`
  - Enhance existing basic `createEntity()` from helpers.ts

- [x] **1.3** Add `createPlayerEntityFactory()` specialized for players
  - Signature: `createPlayerEntityFactory(overrides?: Partial<Entity>): Entity`
  - Pre-set: `classname: 'player'`, health: 100, playerState, client info

- [x] **1.4** Add `createMonsterEntityFactory()` for AI entities
  - Signature: `createMonsterEntityFactory(type: string, overrides?: Partial<Entity>): Entity`
  - Pre-set monster-specific fields: AI, ideal_yaw, enemy reference

- [x] **1.5** Add `createItemEntityFactory()` for pickups
  - Signature: `createItemEntityFactory(itemType: string, overrides?: Partial<Entity>): Entity`
  - Pre-set: `classname`, item-specific properties, respawn logic

- [x] **1.6** Add `createProjectileEntityFactory()` for bullets/rockets/etc
  - Signature: `createProjectileEntityFactory(projectileType: string, overrides?: Partial<Entity>): Entity`
  - Pre-set: velocity, owner, damage, moveType

- [x] **1.7** Add `createTriggerEntityFactory()` for triggers
  - Signature: `createTriggerEntityFactory(triggerType: string, overrides?: Partial<Entity>): Entity`
  - Pre-set: bounds, touch callback, solid type

- [ ] **1.8** Cleanup inline entity creation in `game/tests/entities/` directory
  - Replace manual entity creation with factories
  - Estimated files: ~25

- [ ] **1.9** Cleanup inline entity creation in `game/tests/combat/` directory
  - Same pattern
  - Estimated files: ~15

- [ ] **1.10** Cleanup inline entity creation in `game/tests/items/` directory
  - Same pattern
  - Estimated files: ~10

---

### 2. Expand Game Context Helpers (MEDIUM PRIORITY)

**Status:** Basic helpers exist, need enhancement
**Dependencies:** Task 1

- [x] **2.1** Enhance `createTestContext()` in `test-utils/src/game/helpers.ts`
  - Add optional entity pool pre-population
  - Add optional level/map configuration
  - Signature: `createTestContext(config?: TestContextConfig): TestContext`

- [x] **2.2** Add `createSpawnTestContext()` specialized for spawn testing
  - Signature: `createSpawnTestContext(mapName?: string): TestContext`
  - Pre-configure spawn points, player starts

- [x] **2.3** Add `createCombatTestContext()` specialized for combat testing
  - Signature: `createCombatTestContext(): TestContext`
  - Pre-configure attacker, target, weapons

- [x] **2.4** Add `createPhysicsTestContext()` for physics testing
  - Signature: `createPhysicsTestContext(bspModel?: BspModel): TestContext`
  - Include collision world, traces

- [ ] **2.5** Cleanup context creation in `game/tests/spawn/` directory
  - Replace custom contexts with factory functions
  - Estimated files: ~8

---

### 3. Create AI/Combat Mock Factories (HIGH PRIORITY)

**Status:** Currently scattered mocks
**Dependencies:** None

- [x] **3.1** Create `test-utils/src/game/mocks/ai.ts` file

- [x] **3.2** Add `createMockAI()` factory
  - Signature: `createMockAI(overrides?: Partial<AI>): AI`
  - Methods: `think()`, `stand()`, `walk()`, `run()`, `attack()`, `pain()`, `die()`

- [x] **3.3** Add `createMockMonsterAI()` for monster-specific AI
  - Signature: `createMockMonsterAI(monsterType: string, overrides?: Partial<MonsterAI>): MonsterAI`
  - Include move states, attack patterns

- [x] **3.4** Create `test-utils/src/game/mocks/combat.ts` file

- [x] **3.5** Add `createMockWeapon()` factory
  - Signature: `createMockWeapon(weaponType: string, overrides?: Partial<Weapon>): Weapon`
  - Include: damage, fire rate, ammo, projectile type

- [x] **3.6** Add mock attack functions
  - `mockMonsterFireBlaster()`, `mockMonsterFireRocket()`, `mockMonsterFireRailgun()`
  - Signature pattern: `mockMonsterFire*(entity: Entity, start: Vector3, dir: Vector3, damage: number)`

- [x] **3.7** Add `createMockDamageInfo()` factory
  - Signature: `createMockDamageInfo(overrides?: Partial<DamageInfo>): DamageInfo`
  - Include: attacker, target, amount, type, point, direction

- [ ] **3.8** Cleanup combat mocks in `game/tests/combat/` directory
  - Replace inline weapon/damage mocks
  - Estimated files: ~12

- [ ] **3.9** Cleanup AI mocks in `game/tests/ai/` directory
  - Replace inline AI mocks
  - Estimated files: ~20

- [ ] **3.10** Cleanup monster attack mocks in `game/tests/monsters/` directory
  - Replace inline attack function mocks
  - Estimated files: ~15

---

### 4. Create Inventory/Item Mock Factories (MEDIUM PRIORITY)

**Status:** Partially completed
**Dependencies:** Task 1 (entity factories)

- [x] **4.1** Create `test-utils/src/game/mocks/items.ts` file

- [x] **4.2** Add `createMockInventory()` factory
  - Signature: `createMockInventory(overrides?: Partial<Inventory>): Inventory`
  - Pre-populate with common items, ammo counts

- [x] **4.3** Add `createMockItem()` factory
  - Signature: `createMockItem(itemType: string, overrides?: Partial<Item>): Item`
  - Include: name, icon, pickup function, use function

- [x] **4.4** Add item-specific factories
  - `createMockWeaponItem()`, `createMockAmmoItem()`, `createMockArmorItem()`, `createMockHealthItem()`

- [x] **4.5** Add `createMockPowerup()` factory
  - Signature: `createMockPowerup(powerupType: string, duration?: number): Powerup`

- [ ] **4.6** Cleanup item mocks in `game/tests/items/` directory
  - Estimated files: ~10

---

### 5. Create Physics Test Helpers (MEDIUM PRIORITY)

**Status:** Some helpers exist, need expansion
**Dependencies:** Section 19-1 Task 4 (collision helpers)

- [ ] **5.1** Create `test-utils/src/game/helpers/physics.ts` file

- [ ] **5.2** Add `simulateMovement()` helper
  - Signature: `simulateMovement(entity: Entity, destination: Vector3, context: TestContext): Trace`
  - Simulate movement with collision detection

- [ ] **5.3** Add `simulateGravity()` helper
  - Signature: `simulateGravity(entity: Entity, deltaTime: number, context: TestContext): void`
  - Apply gravity and ground detection

- [ ] **5.4** Add `simulateJump()` helper
  - Signature: `simulateJump(entity: Entity, context: TestContext): void`
  - Apply jump velocity with ground check

- [ ] **5.5** Add `createPhysicsTestScenario()` helper
  - Signature: `createPhysicsTestScenario(scenarioType: 'stairs' | 'ladder' | 'platform' | 'slope'): PhysicsScenario`
  - Return pre-configured BSP model and entity setup

- [ ] **5.6** Cleanup physics tests in `game/tests/physics/` directory
  - Replace manual physics simulation with helpers
  - Estimated files: ~15

---

### 6. Create Save/Load Test Utilities (MEDIUM PRIORITY)

**Status:** Not started
**Dependencies:** Task 1, Task 2

- [ ] **6.1** Create `test-utils/src/game/helpers/save.ts` file

- [ ] **6.2** Add `createMockSaveGame()` factory
  - Signature: `createMockSaveGame(overrides?: Partial<SaveGame>): SaveGame`
  - Include: game state, entities, level info, player state

- [ ] **6.3** Add `createSaveGameSnapshot()` helper
  - Signature: `createSaveGameSnapshot(context: TestContext): SaveGame`
  - Capture current test context as save game

- [ ] **6.4** Add `restoreSaveGameSnapshot()` helper
  - Signature: `restoreSaveGameSnapshot(saveGame: SaveGame, context: TestContext): void`
  - Restore test context from save game

- [ ] **6.5** Add `compareSaveGames()` helper
  - Signature: `compareSaveGames(a: SaveGame, b: SaveGame): SaveGameDiff`
  - Find differences for testing save/load integrity

- [ ] **6.6** Cleanup save/load tests in `game/src/save/tests/` directory
  - Replace inline save game creation
  - Estimated files: ~8

---

### 7. Create Spawn System Utilities (LOW PRIORITY)

**Status:** Basic spawn context exists
**Dependencies:** Task 1, Task 2

- [ ] **7.1** Create `test-utils/src/game/helpers/spawn.ts` file

- [ ] **7.2** Add `createSpawnRegistry()` helper
  - Signature: `createSpawnRegistry(): SpawnRegistry`
  - Pre-register common entity types

- [ ] **7.3** Add `registerTestSpawn()` helper
  - Signature: `registerTestSpawn(classname: string, spawnFunc: SpawnFunction): void`
  - Register test-specific spawn functions

- [ ] **7.4** Add `spawnTestEntity()` helper
  - Signature: `spawnTestEntity(classname: string, spawnData: SpawnData, context: TestContext): Entity`
  - Convenience function for spawning with context

- [ ] **7.5** Cleanup spawn tests in `game/tests/spawn/` directory
  - Estimated files: ~10

---

### 8. Create Game State Factories (LOW PRIORITY)

**Status:** Basic snapshot factory exists
**Dependencies:** Task 1, Task 2

- [ ] **8.1** Enhance `createGameStateSnapshotFactory()` in `test-utils/src/game/factories.ts`

- [ ] **8.2** Add `createServerFrameFactory()` factory
  - Signature: `createServerFrameFactory(overrides?: Partial<ServerFrame>): ServerFrame`

- [ ] **8.3** Add `createGameExportsFactory()` factory
  - Signature: `createGameExportsFactory(overrides?: Partial<GameExports>): GameExports`
  - Mock all game DLL exports

- [ ] **8.4** Add `createClientSnapshotFactory()` factory
  - Signature: `createClientSnapshotFactory(overrides?: Partial<ClientSnapshot>): ClientSnapshot`

---

### 9. Documentation and Exports (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Tasks 1-8

- [ ] **9.1** Add JSDoc comments to all game utilities
  - Include usage examples for entity factories, combat mocks, physics helpers

- [ ] **9.2** Update `test-utils/README.md` with game utilities section
  - Document: entity factories, AI/combat mocks, physics helpers, save utilities

- [x] **9.3** Verify all game utilities exported from `test-utils/src/index.ts`
  - Organized by category: `game/factories/*`, `game/mocks/*`, `game/helpers/*`

- [ ] **9.4** Add TypeScript type exports
  - Export all mock types and helper return types

---

## Summary

**Total Tasks:** 9
**Total Subtasks:** 64
**Estimated Impact:** ~150+ test files updated, ~800 lines of new utilities
**Critical Path:** Task 1 (entity factories) blocks most other tasks
**Parallel Opportunities:** Tasks 3-4 can run in parallel after Task 1; Tasks 5-8 can run in parallel after Task 2
