# Section 18.7: Rogue Mission Pack

**Priority**: 🔵 LOW

This phase covers Rogue mission pack content including monsters, AI enhancements, and game features.

---

## Phase 7: Rogue Mission Pack (🔵 LOW)

### 7.1 Rogue Monsters

**Priority**: 🔵 LOW
**Complexity**: VERY COMPLEX (100-150 hours total)

#### 7.1.1 Widow Monster
**Original Source**: `/rerelease/rogue/m_widow.cpp` (1,304 lines)
**TypeScript File**: `/packages/game/src/entities/monsters/rogue/widow.ts` (NEW)

- [ ] Create widow entity spawn function
  - Large stationary boss monster
  - Multiple attack phases
  - Reference: `m_widow.cpp` lines 50-150

- [ ] Implement web attack
  - Spawn web projectiles
  - Slow/trap players
  - Reference: `m_widow.cpp` lines 450-580

- [ ] Implement spawn minions attack
  - Summon stalker monsters
  - Limited spawn count
  - Reference: `m_widow.cpp` lines 582-720

- [ ] Implement rail gun attack
  - High-damage hitscan
  - Aim prediction
  - Reference: `m_widow.cpp` lines 722-850

- [ ] Implement death sequence
  - Multi-stage death
  - Explosions
  - Spawn rewards
  - Reference: `m_widow.cpp` lines 1150-1304

- [ ] Animation frames: idle, attack1, attack2, attack3, pain, death (80+ frames total)

#### 7.1.2 Carrier Monster
**Original Source**: `/rerelease/rogue/m_carrier.cpp` (1,153 lines)
**TypeScript File**: `/packages/game/src/entities/monsters/rogue/carrier.ts` (NEW)

- [ ] Create carrier entity spawn function
  - Flying monster
  - Egg-laying mechanics
  - Reference: `m_carrier.cpp` lines 50-150

- [ ] Implement egg spawning
  - Drop eggs during flight
  - Eggs hatch into small enemies
  - Reference: `m_carrier.cpp` lines 450-620

- [ ] Implement rocket attack
  - Fire rockets at player
  - Prediction leading
  - Reference: `m_carrier.cpp` lines 622-750

- [ ] Implement machine gun attack
  - Rapid-fire bullets
  - Spread pattern
  - Reference: `m_carrier.cpp` lines 752-850

- [ ] Implement death sequence
  - Crash to ground
  - Egg explosion
  - Reference: `m_carrier.cpp` lines 1000-1153

- [ ] Animation frames: stand, walk, fly, attack, pain, death (60+ frames)

#### 7.1.3 Complete Stalker Implementation
**Original Source**: `/rerelease/rogue/m_stalker.cpp` (full implementation)
**TypeScript File**: `/packages/game/src/entities/monsters/rogue/stalker.ts` (partial exists)

- [ ] Complete stalker spawn function
  - Add missing initialization
  - Reference: existing partial implementation

- [ ] Implement invisibility mechanic
  - Cloaking effect
  - Shimmer when moving
  - Fully visible when attacking
  - Reference: `m_stalker.cpp` lines 350-480

- [ ] Complete attack patterns
  - Melee slash
  - Plasma bolt ranged attack
  - Reference: `m_stalker.cpp` lines 280-340

---

### 7.2 Rogue AI Enhancements

**Priority**: 🔵 LOW
**Complexity**: COMPLEX (50-70 hours)
**Original Source**: `/rerelease/rogue/g_rogue_newai.cpp` (1,612 lines)
**TypeScript File**: `/packages/game/src/ai/rogue/` (NEW)

#### 7.2.1 Enhanced Targeting System
- [ ] Implement `ai_run_melee(entity: Entity): void`
  - Melee-focused AI behavior
  - Close-range rushing
  - Reference: `g_rogue_newai.cpp` lines 50-150

- [ ] Implement `ai_run_missile(entity: Entity): void`
  - Ranged attack AI
  - Maintain distance
  - Strafe while firing
  - Reference: `g_rogue_newai.cpp` lines 152-280

- [ ] Implement `ai_run_slide(entity: Entity, dist: number): void`
  - Sliding dodge movement
  - Avoid incoming fire
  - Reference: `g_rogue_newai.cpp` lines 282-380

#### 7.2.2 Advanced Attack Logic
- [ ] Implement blind fire
  - Fire at last known player position
  - Suppressive fire
  - Reference: `g_rogue_newai.cpp` lines 450-580

- [ ] Implement duck and cover
  - Hide behind obstacles
  - Peek out to fire
  - Reference: `g_rogue_newai.cpp` lines 582-720

- [ ] Implement cooperative tactics
  - Monsters coordinate attacks
  - Flanking maneuvers
  - Reference: `g_rogue_newai.cpp` lines 850-1000

#### 7.2.3 Special Movement
- [ ] Implement jump attack
  - Monsters leap toward player
  - Melee attack on landing
  - Reference: `g_rogue_newai.cpp` lines 1200-1350

- [ ] Implement wallclimbing
  - Stick to walls/ceilings
  - Attack from above
  - Reference: `g_rogue_newai.cpp` lines 1352-1500

---

### 7.3 Rogue Game Features

**Priority**: 🔵 LOW
**Complexity**: MODERATE-COMPLEX (30-50 hours)
**Original Source**: `/rerelease/rogue/g_rogue_newdm.cpp`, etc.
**TypeScript File**: `/packages/game/src/modes/rogue/` (NEW)

#### 7.3.1 Rogue Deathmatch
**Original Source**: `/rerelease/rogue/g_rogue_newdm.cpp` (297 lines)

- [ ] Implement Tag gameplay mode
  - One player is "it"
  - Tag others to transfer
  - Points for time as "it"
  - Reference: `g_rogue_newdm.cpp` lines 50-180

- [ ] Implement friendly fire variants
  - Team damage rules
  - Damage reflection
  - Reference: `g_rogue_newdm.cpp` lines 182-297

#### 7.3.2 Rogue Items
**Original Source**: `/rerelease/rogue/g_rogue_items.cpp` (228 lines)

- [ ] Implement sphere spawners
  - Power-up spheres
  - Defender sphere (damage shield)
  - Hunter sphere (seeking attack)
  - Reference: `g_rogue_items.cpp` lines 50-150

- [ ] Implement Rogue powerups
  - Double damage
  - Doppelganger (decoy)
  - Reference: `g_rogue_items.cpp` lines 152-228
