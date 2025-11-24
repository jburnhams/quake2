# Section 14: Incorrectly Implemented Features

## Overview
This section documents features that are marked as complete in the existing section documents but have been implemented incorrectly or incompletely when compared against the original Quake II rerelease source code. These issues represent work that needs to be **corrected** rather than started from scratch.

## Dependencies
- **All Sections**: This section references work from all existing implementation sections
- **Original Source**: Requires comparison with `/home/user/quake2/rerelease/` and `/home/user/quake2/full/` source files

## Critical Issues Summary

### By Priority Level

**Priority 1 - Game Breaking Bugs:**
- Weapon fire rates and damage calculations
- BFG missing in-flight lasers
- Chaingun burst mechanics completely wrong
- Railgun damage values incorrect
- No quad damage multiplier support

**Priority 2 - Determinism Violations:**
- Math.random() used in 18+ files breaking save/load
- Non-deterministic AI decisions
- Incorrect random number generation

**Priority 3 - Incorrect Behavior:**
- Monster AI behaviors simplified or wrong
- Weapon projectile speeds incorrect
- Entity spawn properties not parsed

---

## Section 5: Combat, Weapons & Items

### Weapons Fire Implementation Issues

#### **1. Blaster - Wrong Projectile Speed**
**File**: `packages/game/src/combat/weapons/firing.ts` lines 300-305
**Status**: Marked complete in Section 5
**Issue**:
- **Current**: Speed = 1000
- **Correct**: Speed = **1500** (per rerelease `p_weapon.cpp` line 1340)
- **Impact**: Blaster feels sluggish and is less useful than intended
- **Fix**: Change `BLASTER_SPEED` constant to 1500

**Testing**: Fire blaster at wall from various distances, verify travel time matches original

---

#### **2. Chaingun - Completely Wrong Burst Logic**
**File**: `packages/game/src/combat/weapons/firing.ts` lines 260-276
**Status**: Marked complete in Section 5
**Critical Issues**:

1. **Wrong Damage Values**:
   - **Current**: 8 damage always
   - **Correct**: **6 in deathmatch, 8 in single player** (p_weapon.cpp lines 1556-1559)

2. **Missing Burst Mechanic**:
   - **Current**: Fires 1 bullet per frame
   - **Correct**: Fires 1-3 bullets per frame depending on spin-up state
   - **Missing**: Spin-up/spin-down animation state machine (lines 1561-1585)
   - **Missing**: Variable ammo consumption (1-3 per frame, line 1666)

3. **Missing Sound Loop**:
   - **Current**: No continuous sound
   - **Correct**: Plays "chngnl1a.wav" looping during firing

**Impact**: Chaingun is significantly weaker than intended (1/3 of actual fire rate)

**Fix Required**:
```typescript
// Add spin-up state tracking
interface ChaingunState {
  shots: number;  // 0-3, increases with sustained fire
  spinUp: boolean;
}

// Fire 1-3 shots based on state
function fireChaingun(state: ChaingunState) {
  const shots = state.spinUp ? Math.min(state.shots, 3) : 1;
  const damage = isDeathmatch() ? 6 : 8;

  for (let i = 0; i < shots; i++) {
    fireBullet(damage, kick, spread);
  }

  consumeAmmo(shots);
  state.shots = Math.min(state.shots + 1, 3);
}
```

**Testing**: Hold fire button, verify shots-per-second increases as barrel spins up

---

#### **3. Railgun - Wrong Damage and Kick**
**File**: `packages/game/src/combat/weapons/firing.ts` lines 278-287
**Status**: Marked complete in Section 5
**Issues**:
- **Current**: 150 damage, 1 kick
- **Correct Deathmatch**: **100 damage, 200 kick** (p_weapon.cpp lines 1788-1791)
- **Correct Single Player**: **125 damage, 225 kick** (p_weapon.cpp lines 1793-1797)
- **Impact**: Railgun is overpowered in DM (50% more damage), wrong feel due to no kick

**Fix**:
```typescript
const damage = isDeathmatch() ? 100 : 125;
const kick = isDeathmatch() ? 200 : 225;
```

**Testing**: Compare railgun effectiveness against monsters/players in both modes

---

#### **4. Rocket Launcher - Fixed Damage Instead of Random**
**File**: `packages/game/src/combat/weapons/firing.ts` lines 308-318
**Status**: Marked complete in Section 5
**Issues**:
- **Current**: Fixed 100 damage
- **Correct**: `irandom(100, 120)` - random 100-120 damage (p_weapon.cpp line 1284)
- **Missing**: Separate radius damage of 120 (line 1285)
- **Impact**: Rockets are too predictable, slight damage nerf

**Fix**:
```typescript
const directDamage = game.irandom(100, 120);
const radiusDamage = 120;
// Both scale with quad damage
if (hasQuadDamage) {
  directDamage *= 4;
  radiusDamage *= 4;
}
```

---

#### **5. HyperBlaster - Wrong Damage in Deathmatch**
**File**: `packages/game/src/combat/weapons/firing.ts` lines 289-298
**Status**: Marked complete in Section 5
**Issues**:
- **Current**: 20 damage always
- **Correct**: **15 in deathmatch, 20 in single player** (p_weapon.cpp lines 1419-1422)
- **Missing**: Rotating barrel offset calculation (lines 1414-1417)

**Fix**:
```typescript
const damage = isDeathmatch() ? 15 : 20;

// Add barrel rotation for visual accuracy
const rotation = (gunframe - 5) * 2 * Math.PI / 6;
offset[0] = -4 * Math.sin(rotation);
offset[1] = 4 * Math.cos(rotation);
```

---

#### **6. BFG - Missing In-Flight Lasers (CRITICAL)**
**File**: `packages/game/src/combat/weapons/projectiles.ts` lines 152-225
**Status**: Marked complete in Section 5
**Critical Issues**:

1. **Wrong Damage**:
   - **Current**: 200 always
   - **Correct**: **200 in DM, 500 in SP** (p_weapon.cpp lines 1845-1848)

2. **Missing Core Mechanic - Flying Lasers**:
   - **Current**: Only fires lasers on explosion impact
   - **Correct**: Fires lasers every 100ms during flight (`bfg_think`, g_weapon.cpp lines 1070-1138)
   - **Impact**: BFG is 70% less effective - major weapon completely broken

**Required Implementation**:
```typescript
class BFGProjectile {
  think() {
    // Run every 100ms while flying
    const nearbyEntities = findRadius(this.origin, 256);

    for (const ent of nearbyEntities) {
      if (!isDamageable(ent)) continue;
      if (!hasLineOfSight(this.origin, ent.origin)) continue;

      // Fire piercing laser
      fireBFGLaser(this.origin, ent.origin, 5, 10);
      spawnLaserEffect(this.origin, ent.origin);
    }
  }

  explode() {
    // Multi-frame explosion that continues firing lasers
    for (let frame = 0; frame < 5; frame++) {
      this.think(); // Fire lasers during explosion too
      nextFrame();
    }
  }
}
```

**Testing**: Fire BFG in room with multiple monsters, verify lasers appear during flight and all monsters take damage before impact

---

#### **7. Super Shotgun - Wrong Spread Pattern**
**File**: `packages/game/src/combat/weapons/firing.ts` lines 205-247
**Status**: Marked complete in Section 5
**Issue**:
- **Current**: 20 pellets with simple spread
- **Correct**: Two separate volleys with horizontal offset (p_weapon.cpp lines 1745-1752)
  - First volley: 10 pellets at YAW - 5 degrees
  - Second volley: 10 pellets at YAW + 5 degrees
- **Impact**: Spread pattern doesn't match original feel, less distinctive

**Fix**:
```typescript
// First barrel (left)
fireMultiplePellets(10, yaw - 5, pitch, spread);
// Second barrel (right)
fireMultiplePellets(10, yaw + 5, pitch, spread);
```

---

#### **8. Missing Quad Damage Multiplier System**
**File**: Completely missing across all weapons
**Status**: Powerup listed as complete in Section 5
**Critical Issue**:
- **Current**: Quad damage powerup exists but doesn't affect weapon damage
- **Correct**: All weapon damage and kick multiplied by 4x (p_weapon.cpp lines 35-57)
- **Also Missing**: Double damage powerup (2x multiplier)
- **Impact**: Major powerup is non-functional

**Required Implementation**:
```typescript
function getDamageModifier(player: Entity): number {
  if (player.quad_time > level.time && player.double_time > level.time) {
    return 8; // Both active
  }
  if (player.quad_time > level.time) {
    return 4; // Quad only
  }
  if (player.double_time > level.time) {
    return 2; // Double only
  }
  return 1;
}

// Apply to all weapon fire:
const finalDamage = baseDamage * getDamageModifier(attacker);
const finalKick = baseKick * getDamageModifier(attacker);
```

---

#### **9. Missing P_ProjectSource - Shot Origin Calculation**
**File**: Not implemented anywhere
**Status**: Weapon firing marked complete
**Critical Issue**:
- **Current**: All shots fire from player origin
- **Correct**: Shots should fire from weapon position using `P_ProjectSource` (p_weapon.cpp lines 91-135)
- **Missing Features**:
  - Eye position calculation (origin + viewheight)
  - Weapon offset projection (forward/right/up vectors)
  - Left/right/center hand support
  - Trace from eye to shot position (prevent shots through walls)
- **Impact**: Shots can go through walls, wrong visual origin, breaks railgun pierce

**Implementation Required**: Port entire `P_ProjectSource` function

---

#### **10. Tank Machinegun - Wrong Damage**
**File**: `packages/game/src/entities/monsters/tank.ts` line with TankMachineGun
**Status**: Tank marked complete in Section 6
**Issue**:
- **Current**: 10 damage
- **Correct**: **20 damage** (p_weapon.cpp line 1559)
- **Impact**: Tank is significantly weaker than intended

**Fix**: Change damage to 20

---

### Armor System Issues

#### **11. Armor Absorption - Simplified Implementation**
**File**: `packages/game/src/combat/damage.ts`
**Status**: Marked complete in Section 5
**Issue**: Armor absorption is simplified compared to rerelease `CheckArmor` (g_combat.cpp lines 94-203)

**Missing**:
- Power Screen cell consumption and angle checking
- Power Shield cell consumption
- Proper armor type switching (keep better armor)
- Shard accumulation logic
- N64 damage shrug system

**Impact**: Armor feels different from original, power armor may not work correctly

---

## Section 6: AI & Monster Behaviors

### Math.random() Determinism Violations (CRITICAL)

**Issue**: 18 files use `Math.random()` instead of deterministic RNG
**Status**: Monsters marked complete but use non-deterministic random
**Impact**:
- Breaks save/load system
- Makes gameplay non-reproducible
- Prevents deterministic testing
- Multiplayer desyncs (future)

**Files Affected**:
```
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

**Fix Required**: Replace ALL `Math.random()` with deterministic RNG:
```typescript
// WRONG:
const damage = 5 + Math.random() * 5;
if (Math.random() < 0.5) attack();

// CORRECT:
const damage = 5 + game.random.frandom() * 5;
if (game.random.frandom() < 0.5) attack();
```

**Testing**: Record input sequence, replay twice, verify identical outcomes

---

### Monster AI Behavior Simplifications

#### **12. Medic Resurrection - Heavily Simplified**
**File**: `packages/game/src/entities/monsters/medic.ts`
**Status**: Marked complete in Section 6
**Issues**:
- **Current**: Single-frame heal function
- **Correct**: 9-frame cable animation (FRAME_attack42-51)
- **Missing**: Visual cable effect (TE_MEDIC_CABLE_ATTACK)
- **Missing**: Distance/obstruction checking during resurrection
- **Missing**: Multi-try logic with badMedic tracking
- **Missing**: Proper entity respawning with ED_CallSpawn
- **Impact**: Core medic feature doesn't work like original

---

#### **13. Berserk Jump Attack - Missing Physics**
**File**: `packages/game/src/entities/monsters/berserk.ts`
**Status**: Marked complete in Section 6
**Issues**:
- **Current**: Basic jump
- **Missing**: `berserk_high_gravity` variable gravity during jump
- **Missing**: `T_SlamRadiusDamage` custom radius damage (300 kick, 165 radius)
- **Missing**: `berserk_jump_touch` proper collision handling
- **Missing**: SPAWNFLAG_BERSERK_NOJUMPING flag
- **Impact**: Jump attack doesn't feel right, less impactful

---

#### **14. Soldier - Missing Variants**
**File**: `packages/game/src/entities/monsters/soldier.ts`
**Status**: Marked complete in Section 6
**Issue**:
- **Current**: 3 variants (10/20/30 HP)
- **Correct**: 6 variants with different weapons:
  - soldier_light (20 HP)
  - soldier (30 HP)
  - soldier_ss (40 HP)
  - soldier_ripper (50 HP)
  - soldier_hypergun (60 HP)
  - soldier_lasergun (70 HP)
- **Missing**: Ripper, hypergun, lasergun attacks
- **Impact**: 50% of soldier types missing

---

## Section 4: Entity System & Spawning

### Entity Spawn Functions - Missing Properties

#### **15. func_door - Incomplete Properties**
**File**: `packages/game/src/entities/funcs.ts`
**Status**: Marked complete in Section 4
**Missing Properties**:
- `lip` - How much door stays visible when open
- `accel` - Acceleration curve
- `decel` - Deceleration curve
- `dmg` - Damage when blocking
- `health` - Shootable door
- `sounds` - Sound set selection (0-4)
- `wait` - Time before auto-close
- **Spawnflags**: TOGGLE, START_OPEN, CRUSHER, NOMONSTER, ANIMATED (most not checked)

**Impact**: Doors don't behave exactly like original

---

#### **16. trigger_multiple - Missing Sound Support**
**File**: `packages/game/src/entities/triggers.ts`
**Status**: Marked complete in Section 4
**Missing**:
- `sounds` field with sound set 1-4
- Sound precaching and playback
- `message` field for centerprint
- LATCHED spawnflag for area query
- CLIP spawnflag support

---

## Section 3: Physics, Collision & Trace System

#### **17. Trace System - Missing Signed Offset Handling**
**File**: `packages/shared/src/bsp/collision.ts`
**Status**: Marked complete in Section 3
**Issue**: Documentation states "Signed bbox offsets when traversing BSP splits to preserve startsolid detection" is complete, but needs verification against rerelease `CM_ClipBoxToBrush` and `CM_TestBoxInBrush` (cm_trace.c)

**Verify**: Signed distance calculations in `PlaneDistance` function match C code exactly

---

## Section 2: Rendering System

#### **18. Lightmap Application - Animation Support**
**File**: `packages/engine/src/render/bsp/renderer.ts`
**Status**: Multi-style lightmaps marked "skipped pending fixes"
**Issue**: Animated lighting (flickering, pulsing) from multiple lightmap styles not working

**Impact**: Maps with animated lights look static

---

## Section 8: Input, UI & Client Systems

#### **19. View Effects - Incomplete Interpolation**
**File**: `packages/client/src/view-effects.ts`
**Status**: View bob, roll, kick marked complete
**Missing**:
- Weapon kick duration timing (should be 200ms)
- Kick interpolation over time (`P_CurrentKickFactor`)
- Kick origin offset (weapon pushback visual)
- Proper kick scaling with quad damage

---

## Testing Requirements

### Verification Tests for Each Fix
For each incorrectly implemented feature above:

1. **Weapon Damage/Speed Tests**:
   - Compare damage numbers against known monster HP
   - Measure projectile travel times with high-speed timer
   - Verify deathmatch vs single-player differences

2. **Determinism Tests**:
   - Record 1000-frame input sequence
   - Replay 10 times
   - Verify bit-identical final state every time

3. **Monster Behavior Tests**:
   - Place monster in test scenario
   - Verify attack patterns match video recordings of original
   - Check animation frame counts and timing

4. **Entity Property Tests**:
   - Load maps with various entity configurations
   - Verify all spawnflags and properties respected
   - Test edge cases (shootable doors, timed triggers)

### Integration Tests
- **Full level playthrough**: base1.bsp start to finish
- **Combat scenario**: All weapons + quad damage vs various monsters
- **Determinism marathon**: 10,000 frames with random inputs, replay verification

---

## Notes
- All fixes in this section are corrections to work marked complete
- Priority should be given to determinism violations and game-breaking bugs
- Many issues are simple value changes (damage, speed constants)
- Some require significant refactoring (BFG lasers, chaingun spin-up)
- Original source reference comments should be added with every fix
- Unit tests should be updated/added to prevent regression

---

## Success Criteria
- [ ] All Math.random() replaced with deterministic RNG
- [ ] All weapon damage/speed values match original
- [ ] BFG in-flight lasers working
- [ ] Chaingun burst mechanics correct
- [ ] Quad damage multiplier functional
- [ ] 1000-frame determinism test passes
- [ ] No visual/behavioral regressions in manual testing
