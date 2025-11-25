# Section 16: Code Quality & Determinism Fixes

## Overview
This section addresses code quality issues, determinism violations, incomplete TODOs, and technical debt discovered during the completeness audit. These issues don't prevent features from working but compromise correctness, maintainability, and the goal of a perfect port.

## Dependencies
- **All Packages**: Code quality issues span all packages
- **Shared Package**: Critical for determinism
- **Game Package**: Most determinism violations here

## Critical Determinism Issues

### Issue 1: Math.random() Violations (CRITICAL)
**Priority**: **CRITICAL** - Breaks core design goal
**Impact**: Save/load broken, non-reproducible gameplay, multiplayer incompatible

#### Files Affected (18 total):
```
packages/engine/src/render/particleSystem.ts:65
packages/game/src/entities/monsters/flyer.ts:96
packages/game/src/entities/monsters/attack.ts:11
packages/game/src/entities/monsters/parasite.ts:42
packages/game/src/entities/monsters/jorg.ts:90,108,161,166,178
packages/game/src/entities/monsters/mutant.ts:41
packages/game/src/entities/monsters/chick.ts:42
packages/game/src/entities/monsters/soldier.ts:307,333
packages/game/src/entities/monsters/flipper.ts:31
packages/game/src/entities/utils.ts:57-59
packages/game/src/entities/monsters/makron.ts:90,197,208
packages/game/src/entities/monsters/boss2.ts:91,103,147
packages/game/src/entities/monsters/brain.ts:33
packages/game/src/entities/monsters/tank.ts:91,97,297
packages/game/src/entities/monsters/gunner.ts:75,119,239
packages/game/src/entities/monsters/supertank.ts:131,195,209
packages/game/src/entities/monsters/medic.ts:151
```

#### Fix Pattern:
**WRONG**:
```typescript
// packages/game/src/entities/monsters/flyer.ts:96
const damage = 5 + Math.random() * 5;

// packages/game/src/entities/monsters/jorg.ts:90
if (Math.random() <= 0.75) {
  // attack logic
}

// packages/game/src/entities/utils.ts:57-59
const x = (Math.random() - 0.5) * 2;
const y = (Math.random() - 0.5) * 2;
const z = (Math.random() - 0.5) * 2;
```

**CORRECT**:
```typescript
// Use game-level deterministic RNG
const damage = 5 + game.random.frandom() * 5;

if (game.random.frandom() <= 0.75) {
  // attack logic
}

const x = game.random.crandom(); // -1 to 1
const y = game.random.crandom();
const z = game.random.crandom();
```

#### Implementation Tasks:
- [ ] **packages/engine/src/render/particleSystem.ts**:
  - Change constructor to require `RandomGenerator` instead of defaulting to Math.random
  - Update all callers to pass game RNG

- [ ] **packages/game/src/entities/monsters/*.ts** (All monster files):
  - Add `game: GameState` parameter to all monster functions that use random
  - Replace Math.random() with game.random.frandom()
  - Replace `Math.random() - 0.5` patterns with game.random.crandom()
  - Update all callers

- [ ] **packages/game/src/entities/utils.ts**:
  - Add game parameter to randomVector3 and similar functions
  - Use game.random.crandom() for all components

- [ ] **packages/game/src/entities/monsters/attack.ts**:
  - Remove standalone `random()` helper that uses Math.random
  - Make all functions take game parameter

#### Testing:
```typescript
// Determinism test
test('game state is deterministic with same seed', () => {
  const seed = 12345;

  // Run 1
  const game1 = createGame(seed);
  for (let i = 0; i < 1000; i++) {
    game1.runFrame();
  }
  const state1 = hashGameState(game1);

  // Run 2
  const game2 = createGame(seed);
  for (let i = 0; i < 1000; i++) {
    game2.runFrame();
  }
  const state2 = hashGameState(game2);

  expect(state1).toBe(state2); // Must be bit-identical
});
```

---

## Incomplete TODO Comments

### Category A: Critical Missing Features
These TODOs indicate features marked complete but actually missing:

#### TODO 1: Player State (Section 8)
**File**: `packages/game/src/index.ts:200-210`
```typescript
pmFlags: 0, // TODO: get from player
viewangles: [0, 0, 0], // TODO
fov: 90, // TODO
ammo: 0, // TODO: get current weapon ammo
damageAlpha: 0, // TODO
```

**Impact**: Player state in snapshots is incomplete
**Fix**: Wire up actual player entity fields to state

---

#### TODO 2: Worldspawn Configstrings (Section 4)
**File**: `packages/game/src/entities/worldspawn.ts:17-33`
```typescript
// TODO: Set configstring CS_SKY
// TODO: Set configstring CS_SKYROTATE
// TODO: Set configstring CS_SKYAXIS
// TODO: Set CD track (usually via configstring CS_CDTRACK)
```

**Impact**: Maps don't set sky/ambient settings
**Fix**: Add configstring API calls with parsed worldspawn properties

---

#### TODO 3: Gib Effects (Section 5/6)
**File**: `packages/game/src/entities/gibs.ts:67`
```typescript
// TODO: Spawn blood effect via TE_BLOOD shower if desired?
```

**Impact**: Gibbing doesn't have visual effects
**Fix**: Add temp entity blood spray on gib spawn

---

#### TODO 4: Medic Cable Effect (Section 6)
**File**: `packages/game/src/entities/monsters/medic.ts:125`
```typescript
// Spawn cable effect (TODO: visual effect)
```

**Impact**: Medic resurrection has no visual feedback
**Fix**: Add TE_MEDIC_CABLE_ATTACK temp entity

---

### Category B: Optimizations Deferred
These TODOs indicate known performance issues:

#### TODO 5: Spatial Hash for Collision (Section 3)
**File**: `packages/game/src/physics/collision.ts:45`
```typescript
// Optimization TODO: Add spatial hash/tree to EntitySystem for fast box queries.
```

**Impact**: O(N) collision queries can be slow with many entities
**Priority**: MEDIUM - Implement after correctness verified

**Implementation**:
- Add spatial grid/octree to EntitySystem
- Bin entities by position
- Query only nearby bins

---

### Category C: Nice-to-Have Polish
Lower priority TODOs that add polish:

#### TODO 6: Ammo Type Names (Section 5)
**File**: `packages/game/src/entities/items/ammo.ts:26`
```typescript
// TODO: Map ammo type to nice name
```

**Priority**: LOW - Cosmetic
**Fix**: Add display names for HUD

#### TODO 7: Extended Ammo Caps (Section 5)
**File**: `packages/game/src/inventory/ammo.ts:87`
```typescript
// TODO: Add caps for new ammo types if known, defaulting to 50 is safe for now.
```

**Priority**: LOW - Mission pack content
**Fix**: Add Rogue/Xatrix ammo type caps when implementing mission packs

---

## Code Smell Patterns

### Pattern 1: Placeholder Random Functions
**Files**: Multiple monster files
**Example**:
```typescript
// packages/game/src/entities/monsters/parasite.ts:41-42
// Helper to access deterministic RNG or Math.random
const random = () => Math.random();
```

**Issue**: Comment indicates awareness of correct approach but still uses Math.random
**Fix**: Remove these placeholder helpers, use game.random directly

---

### Pattern 2: Approximated Frame Counts
**Files**: All monster animation files
**Example**:
```typescript
const soldierStandFrames = Array.from({ length: 30 }, (_, i) => ({
  aifunc: ai_stand,
  dist: 0,
}));
```

**Issue**: Uses `Array.from` approximations instead of exact frame sequences from C++
**Problem**: Loses exact frame timing and per-frame callbacks
**Fix**: Port exact frame arrays from m_*.cpp files with frame-specific functions

---

### Pattern 3: Missing Frame Callbacks
**Files**: All monster files
**Issue**: Original has frame-specific callbacks (sounds, effects) that are missing

**Original** (m_soldier.cpp):
```cpp
static mframe_t soldier_frames_attack1[] = {
    {ai_charge, 0, NULL},
    {ai_charge, 0, NULL},
    {ai_charge, 0, soldier_fire1},  // Fire on frame 3
    {ai_charge, 0, NULL},
    {ai_charge, 0, NULL},
    {ai_charge, 0, soldier_cock},   // Cock weapon on frame 6
    // ...
};
```

**TypeScript** (simplified):
```typescript
const soldierAttack1Frames = Array.from({ length: 9 }, (_, i) => ({
  aifunc: ai_charge,
  dist: 0,
  // Missing: fire callback, cock callback
}));
```

**Fix**: Add `thinkfunc` field to frame definitions, call on specific frames

---

## Missing Error Handling

### Issue 1: Entity Spawn Failures
**Files**: `packages/game/src/entities/spawn.ts`
**Problem**: Missing classname just warns, doesn't track failed spawns

**Fix**:
```typescript
function spawnEntity(classname: string, spawndata: SpawnData): Entity | null {
  const spawnFunc = spawnRegistry[classname];

  if (!spawnFunc) {
    console.warn(`Unknown entity class: ${classname}`);
    // ADD: Track failed spawns for debugging
    level.spawn_failures = level.spawn_failures || [];
    level.spawn_failures.push({
      classname,
      origin: spawndata.origin,
      targetname: spawndata.targetname,
    });
    return null;
  }

  return spawnFunc(spawndata);
}
```

---

### Issue 2: Asset Loading Failures
**Problem**: Missing assets fail silently or with basic warnings
**Fix**: Add asset validation report on map load

```typescript
interface AssetValidationReport {
  missingModels: string[];
  missingSounds: string[];
  missingTextures: string[];
}

function validateMapAssets(bsp: BSP): AssetValidationReport {
  const report: AssetValidationReport = {
    missingModels: [],
    missingSounds: [],
    missingTextures: [],
  };

  // Check all referenced assets exist
  for (const model of bsp.models) {
    if (!assetExists(model)) {
      report.missingModels.push(model);
    }
  }

  // Display report to user
  if (report.missingModels.length > 0) {
    showAssetWarning(report);
  }

  return report;
}
```

---

## Documentation Gaps

### Issue 1: Missing Original Source References
**Problem**: Most ported code doesn't reference original source location
**Fix**: Add comments on all ported functions

**Pattern**:
```typescript
/**
 * Medic resurrection logic
 * @see rerelease/m_medic.cpp lines 387-425 medic_FindDeadMonster
 */
function medicFindDeadMonster(self: Entity, game: GameState): Entity | null {
  // ...
}
```

---

### Issue 2: Deviation Documentation
**Problem**: Intentional deviations from original aren't documented
**Fix**: Add DEVIATION comments

```typescript
// DEVIATION: Original uses ED_CallSpawn to respawn monster.
// TypeScript version re-creates entity from scratch due to
// different entity lifecycle. Behavior should be equivalent.
function medicResurrect(corpse: Entity, game: GameState): void {
  // ...
}
```

---

## Type Safety Issues

### Issue 1: Loose Entity Typing
**Problem**: Entity fields are often `any` or optional when they should be required for specific entity types

**Current**:
```typescript
interface Entity {
  enemy?: Entity;
  movetarget?: Entity;
  health?: number;
  // ... many optional fields
}
```

**Better**:
```typescript
interface BaseEntity {
  // Common required fields
  origin: vec3;
  angles: vec3;
  classname: string;
}

interface DamageableEntity extends BaseEntity {
  health: number;  // Required, not optional
  max_health: number;
  takedamage: boolean;
  die: (self: Entity, attacker: Entity, damage: number) => void;
}

interface MonsterEntity extends DamageableEntity {
  enemy: Entity | null;  // Not optional, but can be null
  movetarget: Entity | null;
  ideal_yaw: number;  // Required
  // ...
}
```

---

### Issue 2: Magic Numbers
**Problem**: Many magic numbers without constants

**Examples**:
```typescript
// What does 256 mean?
const nearbyEntities = findRadius(origin, 256);

// What does 0.75 represent?
if (Math.random() <= 0.75) {
  attack();
}
```

**Fix**: Extract constants
```typescript
const BFG_LASER_RADIUS = 256;  // From g_weapon.cpp line 1073
const nearbyEntities = findRadius(origin, BFG_LASER_RADIUS);

const JORG_ATTACK_CHANCE = 0.75;  // From m_boss31.cpp line 245
if (game.random.frandom() <= JORG_ATTACK_CHANCE) {
  attack();
}
```

---

## Testing Gaps

### Issue 1: Missing Regression Tests for Ported Code
**Problem**: Ported code has no tests verifying it matches original behavior

**Required**: For each ported function, add test comparing output to known original output

**Example**:
```typescript
describe('Medic resurrection', () => {
  it('matches original FindDeadMonster logic', () => {
    // Set up scenario from known original test case
    const self = createMedic({ origin: [100, 100, 0] });
    const corpse = createDeadMonster({ origin: [150, 100, 0] });

    const found = medicFindDeadMonster(self, game);

    // Verify matches documented original behavior
    expect(found).toBe(corpse);
  });

  it('respects MEDIC_MAX_HEAL_DISTANCE', () => {
    const self = createMedic({ origin: [0, 0, 0] });
    const tooFar = createDeadMonster({ origin: [500, 0, 0] });

    const found = medicFindDeadMonster(self, game);

    expect(found).toBeNull(); // Too far, shouldn't find
  });
});
```

---

### Issue 2: No Determinism Test Suite
**Problem**: Determinism is claimed but not systematically tested

**Required**:
```typescript
describe('Determinism', () => {
  it('produces identical state after 1000 frames with same seed', () => {
    const runs = 10;
    const frames = 1000;
    const seed = 12345;

    const hashes = [];
    for (let run = 0; run < runs; run++) {
      const game = createGame(seed);
      for (let frame = 0; frame < frames; frame++) {
        game.runFrame();
      }
      hashes.push(hashGameState(game));
    }

    // All hashes must be identical
    const firstHash = hashes[0];
    for (const hash of hashes) {
      expect(hash).toBe(firstHash);
    }
  });

  it('produces different state with different seed', () => {
    const game1 = createGame(12345);
    const game2 = createGame(54321);

    for (let i = 0; i < 100; i++) {
      game1.runFrame();
      game2.runFrame();
    }

    expect(hashGameState(game1)).not.toBe(hashGameState(game2));
  });

  it('save/load produces identical future state', () => {
    const game = createGame(12345);

    // Run 500 frames
    for (let i = 0; i < 500; i++) {
      game.runFrame();
    }

    // Save state
    const saveData = serializeGame(game);

    // Run 500 more frames
    for (let i = 0; i < 500; i++) {
      game.runFrame();
    }
    const endState1 = hashGameState(game);

    // Load and run 500 frames
    const loadedGame = deserializeGame(saveData);
    for (let i = 0; i < 500; i++) {
      loadedGame.runFrame();
    }
    const endState2 = hashGameState(loadedGame);

    expect(endState1).toBe(endState2);
  });
});
```

---

## Build & Deployment Issues

### Issue 1: No Asset Validation in CI
**Problem**: CI doesn't verify asset loading
**Fix**: Add asset validation tests to CI

```yaml
# .github/workflows/integration.yml
- name: Validate test assets
  run: |
    node scripts/validate-test-assets.js
    # Verifies test PAK files are present and valid
```

---

### Issue 2: No Bundle Size Tracking
**Problem**: Bundle size can grow without notice
**Fix**: Add bundle size reporting

```yaml
- name: Check bundle sizes
  run: |
    npm run build
    node scripts/report-bundle-sizes.js
    # Fails if bundles exceed thresholds
```

---

## Documentation Tasks

### Task 1: Create Determinism Guide
**File**: `docs/determinism.md`
**Content**:
- Why determinism matters
- How RNG system works
- Common pitfalls (Math.random, Date.now, etc.)
- Testing determinism
- Debugging non-determinism

### Task 2: Create Porting Guide
**File**: `docs/porting-guide.md`
**Content**:
- How to port from C++ to TypeScript
- Naming conventions
- Type patterns
- Testing approach
- Documentation requirements

### Task 3: Update Section Status
**Action**: Mark all sections with determinism issues as incomplete until fixed

---

## Priority Matrix

### P0 - Critical (Blocks Determinism):
1. Replace all Math.random() with game.random
2. Add determinism test suite
3. Fix particle system RNG dependency

### P1 - High (Correctness):
4. Complete all critical TODOs (player state, worldspawn, etc.)
5. Add exact frame sequences to monsters
6. Add frame-specific callbacks
7. Extract magic numbers to constants

### P2 - Medium (Quality):
8. Add source references to all ported code
9. Document deviations
10. Add regression tests for ported functions
11. Improve type safety
12. Add error tracking

### P3 - Low (Polish):
13. Add asset validation
14. Complete nice-to-have TODOs
15. Add bundle size tracking
16. Create documentation guides

---

## Success Criteria
- [ ] Zero uses of Math.random() in game/shared packages
- [ ] 10-run determinism test passes for 10,000 frames
- [ ] Save/load determinism test passes
- [ ] All P0 and P1 issues resolved
- [ ] >80% of ported functions have tests
- [ ] All ported functions have source references
- [ ] Documentation guides completed
- [ ] CI includes determinism checks

---

## Notes
- Determinism is THE top priority - without it, save/load is broken
- Many issues are simple find-and-replace (Math.random)
- Frame-specific callbacks are tedious but important for accuracy
- Type safety improvements make future changes easier
- Good documentation prevents same mistakes being repeated
- Tests verify correctness, prevent regression
