# Section 18.1: Core Monster AI Systems

**Priority**: 🔴 CRITICAL

This phase covers the foundational AI systems required for monster behavior and movement.

---

## 1.1 Monster Movement & Pathfinding

**Priority**: 🔴 CRITICAL
**Complexity**: COMPLEX (80-120 hours)
**Original Source**: `/rerelease/m_move.cpp` (1,502 lines)
**TypeScript File**: `/packages/game/src/ai/movement.ts`

### 1.1.1 Core Movement Functions
- [x] Implement `M_MoveToGoal(entity: Entity, dist: number): boolean`
  - Goal-directed pathfinding toward `entity.goalentity`
  - Obstacle avoidance
  - Returns true if movement successful
  - Reference: `m_move.cpp` lines 30-180

- [x] Implement `M_ChangeYaw(entity: Entity): void`
  - Smooth rotation toward `entity.ideal_yaw`
  - Use `entity.yaw_speed` for turn rate
  - Reference: `m_move.cpp` lines 182-220

- [x] Implement `M_MoveStep(entity: Entity, move: Vec3, relink: boolean): boolean`
  - Single physics step with collision
  - Step climbing (18 unit steps)
  - Ground validation
  - Reference: `m_move.cpp` lines 222-380

- [x] Implement `M_MoveToPath(entity: Entity): void`
  - Follow explicit path_corner entities
  - Update `entity.movetarget` when reaching waypoints
  - Reference: `m_move.cpp` lines 450-520

### 1.1.2 Ground & Bottom Detection
- [x] Implement `M_CheckBottom(entity: Entity): boolean`
  - Validate entity is on solid ground
  - Check all 4 corners of bounding box
  - Detect slopes and edges
  - Reference: `m_move.cpp` lines 382-448

- [x] Implement `M_CheckBottomEx(entity: Entity): number`
  - Extended version returning bottom type
  - Returns: BOTTOM_SOLID, BOTTOM_WATER, BOTTOM_SLIME, BOTTOM_LAVA, BOTTOM_NONE
  - Reference: `m_move.cpp` lines 522-590

### 1.1.3 Flying Monster Movement
- [x] Implement `SV_flystep(entity: Entity, move: Vec3, relink: boolean): boolean`
  - Flying monster physics (no ground constraint)
  - Collision detection for flyers
  - Reference: `m_move.cpp` lines 592-680

- [x] Implement `G_IdealHoverPosition(entity: Entity): Vec3`
  - Calculate ideal hover height for flying monsters
  - Terrain following for hovers
  - Reference: `m_move.cpp` lines 890-950

### 1.1.4 Advanced Movement Features
- [x] Implement `M_walkmove(entity: Entity, yaw: number, dist: number): boolean`
  - High-level walk function
  - Direction-based movement
  - Reference: `m_move.cpp` lines 682-750

- [x] Implement `M_droptofloor(entity: Entity): void`
  - Drop entity to ground on spawn
  - Prevent spawning in air
  - Reference: `m_move.cpp` lines 752-810

- [ ] Implement gravity vector support for non-standard orientations
  - Wall-walking monsters
  - Ceiling crawlers
  - Reference: `m_move.cpp` lines 1200-1350

- [ ] Implement sloping surface traversal
  - Smooth movement on slopes
  - Slide prevention on steep angles
  - Reference: `m_move.cpp` lines 1352-1450

### 1.1.5 Water & Terrain Interaction
- [ ] Implement water current following
  - Read CONTENTS_CURRENT_* flags
  - Apply directional force to movement
  - Reference: `m_move.cpp` lines 812-888

- [x] Implement fall damage for monsters
  - Track falling distance
  - Apply damage on impact
  - Reference: `m_move.cpp` lines 1452-1502

---

## 1.2 AI Perception & Targeting

**Priority**: 🔴 CRITICAL
**Complexity**: MODERATE-COMPLEX (40-60 hours)
**Original Source**: `/rerelease/g_ai.cpp` (1,808 lines)
**TypeScript File**: `/packages/game/src/ai/targeting.ts`

### 1.2.1 Sight & Sound Perception
- [x] Implement `AI_GetSightClient(entity: Entity): Entity | null`
  - Find visible player from monster perspective
  - Line-of-sight checks
  - FOV restrictions
  - Reference: `g_ai.cpp` lines 50-150

- [x] Implement `ai_checkattack(entity: Entity): boolean`
  - Decide whether to attack or move
  - Range checks for different attack types
  - Cover detection
  - Reference: `g_ai.cpp` lines 152-350

- [ ] Implement sound-based targeting
  - Track sound events from players
  - Investigate sound sources
  - Pinger entity support
  - Reference: `g_ai.cpp` lines 352-450

### 1.2.2 AI Movement Routines
- [x] Implement `ai_stand(entity: Entity, dist: number): void`
  - Standing idle behavior
  - Look for targets while standing
  - Ground check integration
  - Reference: `g_ai.cpp` lines 452-550

- [x] Implement `ai_walk(entity: Entity, dist: number): void`
  - Walking patrol behavior
  - Call M_MoveToGoal internally
  - Animation frame advancement
  - Reference: `g_ai.cpp` lines 552-650

- [x] Implement `ai_run(entity: Entity, dist: number): void`
  - Running/chasing behavior
  - Aggressive pursuit
  - Melee range detection
  - Reference: `g_ai.cpp` lines 652-750

- [x] Implement `ai_charge(entity: Entity, dist: number): void`
  - Charging attack movement
  - Close-range rush
  - Reference: `g_ai.cpp` lines 752-820

### 1.2.3 Combat Positioning
- [x] Implement dodge/sidestep logic
  - Strafe 8 units left/right
  - Avoid incoming projectiles
  - Reference: `g_ai.cpp` lines 822-920

- [ ] Implement cover-seeking behavior
  - Find point_combat entities
  - Move to tactical positions
  - Reference: `g_ai.cpp` lines 922-1020

- [ ] Implement third-eye detection
  - Monsters can "see" through obstacles at close range
  - Player detection behind walls
  - Reference: `g_ai.cpp` lines 1022-1100

### 1.2.4 Damage & Pain Reactions
- [ ] Implement damage push system
  - Knockback from damage
  - Pain animation triggers
  - Interruption of attacks
  - Reference: `g_ai.cpp` lines 1102-1200

- [ ] Implement enemy priority system
  - Track multiple potential targets
  - Switch targets based on threat
  - Reference: `g_ai.cpp` lines 1202-1300

### 1.2.5 Path Following
- [ ] Implement hint path system
  - Follow monster_path_corner entities
  - Multi-stage monster behavior
  - Path speed modifiers
  - Reference: `g_ai.cpp` lines 1302-1500

- [ ] Implement patrol route looping
  - Circular patrol paths
  - Wait times at waypoints
  - Reference: `g_ai.cpp` lines 1502-1600

---

## 1.3 Monster-Specific Implementations

**Priority**: 🟡 HIGH
**Complexity**: MODERATE-COMPLEX per monster (15-40 hours each)

### 1.3.1 Float Monster
**Original Source**: `/rerelease/m_float.cpp` (880 lines)
**TypeScript File**: `/packages/game/src/entities/monsters/float.ts` (NEW)

- [ ] Create float monster entity
- [ ] Implement floating movement physics
  - Hover at specific height
  - Bob up and down animation
- [ ] Implement attack patterns
  - Blaster attacks
  - Melee tentacle
- [ ] Implement death sequence
  - Fall from sky
  - Explosion on ground impact
- [ ] Animation frames: stand, walk, attack, pain, death (40+ frames)

### 1.3.2 Guardian Monster
**Original Source**: `/rerelease/m_guardian.cpp` (320 lines)
**TypeScript File**: `/packages/game/src/entities/monsters/guardian.ts` (stub exists)

- [ ] Complete guardian spawn function
- [ ] Implement laser attack
  - Sustained beam weapon
  - Damage over time
- [ ] Implement shield behavior
  - Damage reduction when shield active
  - Visual shield effect
- [ ] Animation frames: stand, walk, attack, pain, death (25+ frames)

### 1.3.3 Gun Commander
**Original Source**: `/rerelease/m_guncmdr.cpp` (850 lines)
**TypeScript File**: `/packages/game/src/entities/monsters/guncmdr.ts` (NEW)

- [ ] Create gun commander entity (soldier variant)
- [ ] Implement enhanced AI
  - More aggressive than base soldier
  - Better accuracy
  - Grenade throwing
- [ ] Implement command abilities
  - Spawn reinforcements
  - Coordinate attacks
- [ ] Animation frames: stand, walk, attack, pain, death, duck (50+ frames)

### 1.3.4 Medic Resurrection System
**Original Source**: `/rerelease/m_medic.cpp` (specific resurrection logic)
**TypeScript File**: `/packages/game/src/entities/monsters/medic.ts`

- [ ] Implement monster resurrection
  - Find dead monster corpses within range
  - Revive with heal beam
  - Restore partial health
  - Reference: `m_medic.cpp` lines 450-580

- [ ] Implement heal beam visual effect
  - Particle beam from medic to target
  - Green healing particles
  - Reference: `m_medic.cpp` lines 350-420

### 1.3.5 Parasite Life Cycle
**Original Source**: `/rerelease/m_parasite.cpp` (specific spawn logic)
**TypeScript File**: `/packages/game/src/entities/monsters/parasite.ts`

- [ ] Implement egg laying behavior
  - Create parasite eggs on surfaces
  - Egg hatch timing
  - Reference: `m_parasite.cpp` lines 520-650

- [ ] Implement leaping attack
  - Jump toward player
  - Latch onto player face
  - Drain health over time
  - Reference: `m_parasite.cpp` lines 380-500

### 1.3.6 Brain Tentacle Attacks
**Original Source**: `/rerelease/m_brain.cpp` (tentacle sequence)
**TypeScript File**: `/packages/game/src/entities/monsters/brain.ts`

- [ ] Implement tentacle spawn attack
  - Create tentacle entities
  - Multi-hit attack pattern
  - Reference: `m_brain.cpp` lines 420-580

- [ ] Implement melee grab attack
  - Pull player toward brain
  - Damage while held
  - Reference: `m_brain.cpp` lines 300-400
