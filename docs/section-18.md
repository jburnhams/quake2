# Section 18: Perfect Port Completion Tasks

## Overview

This document outlines the remaining work to achieve a "perfect port" of Quake II from the original C/C++ source to TypeScript. The quake2ts port currently covers approximately 51% of the original rerelease source code (~32,715 lines ported from ~63,591 original lines).

**Estimated Total Effort**: 800-1,200 hours across ~40 major systems

**Source Code References**:
- `/home/user/quake2/rerelease/` - Quake II Rerelease C++ source (primary reference)
- `/home/user/quake2/full/` - Original Quake II 1.11 C source (fallback reference)
- `/home/user/quake2/quake2ts/packages/` - TypeScript port

---

## Priority Classification

Tasks are organized by priority and complexity:

- **🔴 CRITICAL**: Blocks core gameplay functionality
- **🟡 HIGH**: Required for feature parity with original
- **🟢 MEDIUM**: Polish and completeness
- **🔵 LOW**: Expansion content and advanced features

**Complexity Levels**:
- **SIMPLE**: 1-3 hours
- **SIMPLE-MODERATE**: 3-8 hours
- **MODERATE**: 8-20 hours
- **MODERATE-COMPLEX**: 20-50 hours
- **COMPLEX**: 50+ hours

---

## Phase 1: Core Monster AI Systems (🔴 CRITICAL)

### 1.1 Monster Movement & Pathfinding

**Priority**: 🔴 CRITICAL
**Complexity**: COMPLEX (80-120 hours)
**Original Source**: `/rerelease/m_move.cpp` (1,502 lines)
**TypeScript File**: `/packages/game/src/ai/movement.ts`

#### 1.1.1 Core Movement Functions
- [ ] Implement `M_MoveToGoal(entity: Entity, dist: number): boolean`
  - Goal-directed pathfinding toward `entity.goalentity`
  - Obstacle avoidance
  - Returns true if movement successful
  - Reference: `m_move.cpp` lines 30-180

- [ ] Implement `M_ChangeYaw(entity: Entity): void`
  - Smooth rotation toward `entity.ideal_yaw`
  - Use `entity.yaw_speed` for turn rate
  - Reference: `m_move.cpp` lines 182-220

- [ ] Implement `M_MoveStep(entity: Entity, move: Vec3, relink: boolean): boolean`
  - Single physics step with collision
  - Step climbing (18 unit steps)
  - Ground validation
  - Reference: `m_move.cpp` lines 222-380

- [ ] Implement `M_MoveToPath(entity: Entity): void`
  - Follow explicit path_corner entities
  - Update `entity.movetarget` when reaching waypoints
  - Reference: `m_move.cpp` lines 450-520

#### 1.1.2 Ground & Bottom Detection
- [ ] Implement `M_CheckBottom(entity: Entity): boolean`
  - Validate entity is on solid ground
  - Check all 4 corners of bounding box
  - Detect slopes and edges
  - Reference: `m_move.cpp` lines 382-448

- [ ] Implement `M_CheckBottomEx(entity: Entity): number`
  - Extended version returning bottom type
  - Returns: BOTTOM_SOLID, BOTTOM_WATER, BOTTOM_SLIME, BOTTOM_LAVA, BOTTOM_NONE
  - Reference: `m_move.cpp` lines 522-590

#### 1.1.3 Flying Monster Movement
- [ ] Implement `SV_flystep(entity: Entity, move: Vec3, relink: boolean): boolean`
  - Flying monster physics (no ground constraint)
  - Collision detection for flyers
  - Reference: `m_move.cpp` lines 592-680

- [ ] Implement `G_IdealHoverPosition(entity: Entity): Vec3`
  - Calculate ideal hover height for flying monsters
  - Terrain following for hovers
  - Reference: `m_move.cpp` lines 890-950

#### 1.1.4 Advanced Movement Features
- [ ] Implement `M_walkmove(entity: Entity, yaw: number, dist: number): boolean`
  - High-level walk function
  - Direction-based movement
  - Reference: `m_move.cpp` lines 682-750

- [ ] Implement `M_droptofloor(entity: Entity): void`
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

#### 1.1.5 Water & Terrain Interaction
- [ ] Implement water current following
  - Read CONTENTS_CURRENT_* flags
  - Apply directional force to movement
  - Reference: `m_move.cpp` lines 812-888

- [ ] Implement fall damage for monsters
  - Track falling distance
  - Apply damage on impact
  - Reference: `m_move.cpp` lines 1452-1502

---

### 1.2 AI Perception & Targeting

**Priority**: 🔴 CRITICAL
**Complexity**: MODERATE-COMPLEX (40-60 hours)
**Original Source**: `/rerelease/g_ai.cpp` (1,808 lines)
**TypeScript File**: `/packages/game/src/ai/targeting.ts`

#### 1.2.1 Sight & Sound Perception
- [ ] Implement `AI_GetSightClient(entity: Entity): Entity | null`
  - Find visible player from monster perspective
  - Line-of-sight checks
  - FOV restrictions
  - Reference: `g_ai.cpp` lines 50-150

- [ ] Implement `ai_checkattack(entity: Entity): boolean`
  - Decide whether to attack or move
  - Range checks for different attack types
  - Cover detection
  - Reference: `g_ai.cpp` lines 152-350

- [ ] Implement sound-based targeting
  - Track sound events from players
  - Investigate sound sources
  - Pinger entity support
  - Reference: `g_ai.cpp` lines 352-450

#### 1.2.2 AI Movement Routines
- [ ] Implement `ai_stand(entity: Entity, dist: number): void`
  - Standing idle behavior
  - Look for targets while standing
  - Ground check integration
  - Reference: `g_ai.cpp` lines 452-550

- [ ] Implement `ai_walk(entity: Entity, dist: number): void`
  - Walking patrol behavior
  - Call M_MoveToGoal internally
  - Animation frame advancement
  - Reference: `g_ai.cpp` lines 552-650

- [ ] Implement `ai_run(entity: Entity, dist: number): void`
  - Running/chasing behavior
  - Aggressive pursuit
  - Melee range detection
  - Reference: `g_ai.cpp` lines 652-750

- [ ] Implement `ai_charge(entity: Entity, dist: number): void`
  - Charging attack movement
  - Close-range rush
  - Reference: `g_ai.cpp` lines 752-820

#### 1.2.3 Combat Positioning
- [ ] Implement dodge/sidestep logic
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

#### 1.2.4 Damage & Pain Reactions
- [ ] Implement damage push system
  - Knockback from damage
  - Pain animation triggers
  - Interruption of attacks
  - Reference: `g_ai.cpp` lines 1102-1200

- [ ] Implement enemy priority system
  - Track multiple potential targets
  - Switch targets based on threat
  - Reference: `g_ai.cpp` lines 1202-1300

#### 1.2.5 Path Following
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

### 1.3 Monster-Specific Implementations

**Priority**: 🟡 HIGH
**Complexity**: MODERATE-COMPLEX per monster (15-40 hours each)

#### 1.3.1 Float Monster
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

#### 1.3.2 Guardian Monster
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

#### 1.3.3 Gun Commander
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

#### 1.3.4 Medic Resurrection System
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

#### 1.3.5 Parasite Life Cycle
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

#### 1.3.6 Brain Tentacle Attacks
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

---

## Phase 2: Game Mechanics & Rules (🔴 CRITICAL)

### 2.1 Trigger System

**Priority**: 🔴 CRITICAL
**Complexity**: MODERATE (30-50 hours)
**Original Source**: `/rerelease/g_trigger.cpp` (1,332 lines)
**TypeScript File**: `/packages/game/src/entities/triggers.ts`

#### 2.1.1 Basic Triggers
- [ ] Implement `SP_trigger_multiple(entity: Entity): void`
  - Repeatable trigger with wait time
  - Touch detection for players/monsters
  - Target activation
  - Reference: `g_trigger.cpp` lines 50-150

- [ ] Implement `SP_trigger_once(entity: Entity): void`
  - Single-use trigger
  - Auto-remove after activation
  - Reference: `g_trigger.cpp` lines 152-200

- [ ] Implement `SP_trigger_relay(entity: Entity): void`
  - Relay signal to other entities
  - Delay support
  - Reference: `g_trigger.cpp` lines 202-280

- [ ] Implement `SP_trigger_counter(entity: Entity): void`
  - Count activations before firing
  - Multi-activation requirement
  - Reference: `g_trigger.cpp` lines 282-360

#### 2.1.2 Movement Triggers
- [ ] Implement `SP_trigger_push(entity: Entity): void`
  - Apply velocity to entities in volume
  - Jump pads, wind tunnels
  - Configurable push speed and angle
  - Reference: `g_trigger.cpp` lines 362-480

- [ ] Implement `SP_trigger_hurt(entity: Entity): void`
  - Damage entities in volume
  - Configurable damage amount and type
  - Death triggers (lava, slime)
  - Reference: `g_trigger.cpp` lines 482-580

- [ ] Implement `SP_trigger_gravity(entity: Entity): void`
  - Modify gravity in volume
  - Low-gravity zones
  - Reference: `g_trigger.cpp` lines 582-650

#### 2.1.3 Special Triggers
- [ ] Implement `SP_trigger_teleport(entity: Entity): void`
  - Teleport entities to destination
  - info_teleport_destination support
  - Velocity preservation/zeroing
  - Reference: `g_trigger.cpp` lines 652-780

- [ ] Implement `SP_trigger_secret(entity: Entity): void`
  - Secret area tracking
  - Update client stats for secrets found
  - Message display
  - Reference: `g_trigger.cpp` lines 782-850

- [ ] Implement `SP_trigger_monsterjump(entity: Entity): void`
  - Help monsters navigate jumps
  - Apply jump velocity to monsters only
  - Reference: `g_trigger.cpp` lines 852-920

#### 2.1.4 Advanced Triggers
- [ ] Implement `SP_trigger_always(entity: Entity): void`
  - Fire immediately on spawn
  - Level start events
  - Reference: `g_trigger.cpp` lines 922-980

- [ ] Implement `SP_trigger_look(entity: Entity): void`
  - Activate when player looks at entity
  - FOV-based detection
  - Reference: `g_trigger.cpp` lines 982-1080

- [ ] Implement `SP_trigger_key(entity: Entity): void`
  - Require specific key item
  - Key consumption or preservation
  - Reference: `g_trigger.cpp` lines 1082-1180

- [ ] Implement water current triggers
  - CONTENTS_CURRENT_* application
  - Directional water flow
  - Reference: `g_trigger.cpp` lines 1182-1280

---

### 2.2 Dynamic Entities (func_*)

**Priority**: 🔴 CRITICAL
**Complexity**: MODERATE-COMPLEX (60-90 hours)
**Original Source**: `/rerelease/g_func.cpp` (2,000+ lines)
**TypeScript File**: `/packages/game/src/entities/funcs.ts`

#### 2.2.1 Doors
- [ ] Implement `SP_func_door(entity: Entity): void`
  - Sliding doors (linear movement)
  - Configurable open/close speed
  - Auto-close with wait time
  - Lock support (requires key)
  - Reference: `g_func.cpp` lines 50-250

- [ ] Implement `SP_func_door_rotating(entity: Entity): void`
  - Rotating doors (angular movement)
  - Hinge point configuration
  - Reverse opening direction
  - Reference: `g_func.cpp` lines 252-420

- [ ] Implement door state machine
  - States: CLOSED, OPENING, OPEN, CLOSING, BLOCKED
  - Crush damage when blocked
  - Sound events (start, stop, locked)
  - Reference: `g_func.cpp` lines 100-180

#### 2.2.2 Platforms & Elevators
- [ ] Implement `SP_func_plat(entity: Entity): void`
  - Platform elevator
  - Auto-lower when player stands on it
  - Wait at top/bottom
  - Reference: `g_func.cpp` lines 422-580

- [ ] Implement `SP_func_plat2(entity: Entity): void`
  - Enhanced platform with more states
  - Configurable movement paths
  - Reference: `g_func.cpp` lines 582-720

- [ ] Implement `SP_func_train(entity: Entity): void`
  - Track-based movement
  - Follow path_corner entities
  - Variable speed
  - Reference: `g_func.cpp` lines 722-900

#### 2.2.3 Buttons
- [ ] Implement `SP_func_button(entity: Entity): void`
  - Pressable button
  - Move distance on activation
  - Return to rest position
  - Activation sounds
  - Reference: `g_func.cpp` lines 902-1020

- [ ] Implement touch vs use activation
  - Touch: activate on contact
  - Use: require +use button press
  - Reference: `g_func.cpp` lines 950-1000

#### 2.2.4 Movers
- [ ] Implement `SP_func_rotating(entity: Entity): void`
  - Continuously rotating entity
  - Configurable rotation axis and speed
  - Fan blades, gears, etc.
  - Reference: `g_func.cpp` lines 1022-1150

- [ ] Implement `SP_func_pendulum(entity: Entity): void`
  - Swinging pendulum motion
  - Arc angle and period configuration
  - Swinging blades, chandeliers
  - Reference: `g_func.cpp` lines 1152-1280

- [ ] Implement `SP_func_conveyor(entity: Entity): void`
  - Conveyor belt
  - Move entities standing on surface
  - Configurable speed and direction
  - Reference: `g_func.cpp` lines 1282-1380

#### 2.2.5 Walls & Crushers
- [ ] Implement `SP_func_wall(entity: Entity): void`
  - Movable wall
  - Crush players between wall and obstacle
  - Configurable crush damage
  - Reference: `g_func.cpp` lines 1382-1520

- [ ] Implement crusher death sequence
  - Instant death if crushed
  - Gib spawning
  - Sound effects
  - Reference: `g_func.cpp` lines 1450-1500

#### 2.2.6 Special Functions
- [ ] Implement `SP_func_timer(entity: Entity): void`
  - Periodic event trigger
  - Configurable interval
  - Random variance support
  - Reference: `g_func.cpp` lines 1522-1620

- [ ] Implement `SP_func_explosive(entity: Entity): void`
  - Destructible entity
  - Explode on death
  - Damage radius
  - Reference: `g_func.cpp` lines 1622-1750

- [ ] Implement `SP_func_killbox(entity: Entity): void`
  - Instant death volume
  - Kill all entities inside
  - Used for level cleanup
  - Reference: `g_func.cpp` lines 1752-1820

---

### 2.3 Target Entities

**Priority**: 🟡 HIGH
**Complexity**: MODERATE (20-30 hours)
**Original Source**: `/rerelease/g_target.cpp` (various)
**TypeScript File**: `/packages/game/src/entities/targets.ts`

#### 2.3.1 Visual Effects
- [ ] Implement `SP_target_explosion(entity: Entity): void`
  - Create explosion effect
  - Damage radius (optional)
  - Reference: `g_target.cpp` lines 50-150

- [ ] Implement `SP_target_splash(entity: Entity): void`
  - Water splash effect
  - Configurable particle count
  - Reference: `g_target.cpp` lines 152-220

- [ ] Implement `SP_target_laser(entity: Entity): void`
  - Laser beam between points
  - Damage on touch
  - Reference: `g_target.cpp` lines 222-350

#### 2.3.2 Audio Targets
- [ ] Implement `SP_target_speaker(entity: Entity): void`
  - Ambient sound emitter
  - Looping or one-shot
  - Volume and attenuation
  - Reference: `g_target.cpp` lines 352-480

- [ ] Implement sound triggering system
  - Activate/deactivate speakers
  - Change sound files dynamically
  - Reference: `g_target.cpp` lines 420-470

#### 2.3.3 Gameplay Targets
- [ ] Implement `SP_target_changelevel(entity: Entity): void`
  - Transition to next map
  - Save player inventory
  - Reference: `g_target.cpp` lines 482-580

- [ ] Implement `SP_target_secret(entity: Entity): void`
  - Mark secret area found
  - Update player stats
  - Reference: `g_target.cpp` lines 582-650

- [ ] Implement `SP_target_goal(entity: Entity): void`
  - Mission objective marker
  - CTF flag capture point
  - Reference: `g_target.cpp` lines 652-720

#### 2.3.4 Spawning Targets
- [ ] Implement `SP_target_spawner(entity: Entity): void`
  - Spawn entities on activation
  - Configurable spawn count
  - Reference: `g_target.cpp` lines 722-850

- [ ] Implement `SP_target_monster_spawner(entity: Entity): void`
  - Spawn monsters dynamically
  - Ambush system support
  - Reference: `g_target.cpp` lines 852-950

---

### 2.4 Deathmatch Rules

**Priority**: 🟡 HIGH
**Complexity**: MODERATE (25-35 hours)
**Original Source**: `/rerelease/g_main.cpp`, `/rerelease/g_cmds.cpp`
**TypeScript File**: `/packages/game/src/modes/deathmatch.ts` (NEW)

#### 2.4.1 Scoring System
- [ ] Implement frag tracking
  - Increment frags on kill
  - Decrement frags on suicide
  - Reference: `g_combat.cpp` lines 450-520

- [ ] Implement scoreboard updates
  - Real-time score display
  - Sort by frags
  - Reference: `g_cmds.cpp` lines 1200-1350

- [ ] Implement death messages
  - Obituary system per weapon
  - Suicide messages
  - Environmental death messages
  - Reference: `g_combat.cpp` lines 350-440

#### 2.4.2 Respawn System
- [ ] Implement player respawn logic
  - Find farthest spawn point from enemies
  - Random spawn if equidistant
  - Anti-telefrag protection
  - Reference: `g_main.cpp` lines 850-1000

- [ ] Implement spawn invulnerability
  - 2 second protection on spawn
  - Visual effect (glow)
  - Reference: `g_main.cpp` lines 920-980

- [ ] Implement corpse removal
  - Remove after respawn
  - Body queue system
  - Reference: `g_main.cpp` lines 1002-1080

#### 2.4.3 Item Respawn
- [ ] Implement item respawn timers
  - Weapons: 30 seconds
  - Ammo: 20 seconds
  - Powerups: 60 seconds
  - Health/Armor: 20 seconds
  - Reference: `g_items.cpp` lines 650-750

- [ ] Implement respawn prediction
  - Visual cue before respawn
  - Transparent item model
  - Reference: `g_items.cpp` lines 700-740

#### 2.4.4 Deathmatch-Specific Mechanics
- [ ] Implement self-damage
  - Rocket jumping (player damages self)
  - Grenade jumping
  - Reference: `g_combat.cpp` lines 180-250

- [ ] Implement telefrag
  - Instant kill if spawn on occupied space
  - Award frag to victim
  - Reference: `g_utils.cpp` lines 520-590

- [ ] Implement fall damage
  - Calculate based on fall distance
  - Apply damage on impact
  - Reference: `g_phys.cpp` lines 420-510

---

## Phase 3: Weapon Systems (🟡 HIGH)

### 3.1 Weapon Alt-Fires

**Priority**: 🟡 HIGH
**Complexity**: MODERATE (30-40 hours)
**Original Source**: `/rerelease/p_weapon.cpp` (1,970+ lines)
**TypeScript File**: `/packages/game/src/combat/weapons/` (various)

#### 3.1.1 Grenade Launcher Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/grenadelauncher.ts`

- [ ] Implement timed grenade mode
  - Hold to set timer (1-3 seconds)
  - Explode after timer expires
  - Reference: `p_weapon.cpp` lines 850-950

#### 3.1.2 Rocket Launcher Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/rocketlauncher.ts`

- [ ] Implement guided missile mode
  - Laser-guided rocket
  - Follow crosshair aim
  - Reduced speed but perfect accuracy
  - Reference: `p_weapon.cpp` lines 1050-1180

- [ ] Implement missile tracking logic
  - Update missile trajectory each frame
  - Steer toward aim point
  - Max turn rate limit
  - Reference: `p_weapon.cpp` lines 1100-1170

#### 3.1.3 Hyperblaster Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/hyperblaster.ts`

- [ ] Implement sustained beam mode
  - Hold fire for continuous beam
  - Increased ammo consumption
  - Heat buildup mechanic
  - Reference: `p_weapon.cpp` lines 1280-1380

#### 3.1.4 Chaingun Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/chaingun.ts`

- [ ] Implement wind-up mode
  - Hold to spin barrels
  - Instant fire when spun up
  - Faster fire rate when wound
  - Reference: `p_weapon.cpp` lines 680-780

#### 3.1.5 Super Shotgun Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/supershotgun.ts`

- [ ] Implement precision mode
  - Tighter pellet spread
  - Reduced damage per pellet
  - Longer range effectiveness
  - Reference: `p_weapon.cpp` lines 480-550

#### 3.1.6 Blaster Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/blaster.ts`

- [ ] Implement melee extension
  - Blaster as bayonet
  - Close-range stab attack
  - No ammo consumption
  - Reference: `p_weapon.cpp` lines 320-390

---

### 3.2 Weapon Effects & Refinements

**Priority**: 🟡 HIGH
**Complexity**: SIMPLE-MODERATE (15-25 hours)
**Original Source**: `/rerelease/p_weapon.cpp`, `/rerelease/p_view.cpp`
**TypeScript File**: `/packages/game/src/combat/weapons/` (various)

#### 3.2.1 Weapon Kick & Recoil
- [ ] Implement view kick for all weapons
  - Camera angle adjustment on fire
  - Recoil pattern per weapon
  - Recovery over time
  - Reference: `p_weapon.cpp` lines 120-220

- [ ] Add kick to PlayerState
  - Store `kick_angles` in player state
  - Apply in view calculation
  - Reference: `p_view.cpp` lines 350-420

#### 3.2.2 Muzzle Flash Positioning
- [ ] Implement muzzle flash entities
  - Create temporary light entity on fire
  - Position at weapon muzzle
  - Duration and intensity per weapon
  - Reference: `p_weapon.cpp` lines 50-110

- [ ] Add flash offset per weapon model
  - MD3 tag-based positioning
  - Hardcoded offsets for MD2
  - Reference: `p_weapon.cpp` lines 70-100

#### 3.2.3 Damage Falloff
- [ ] Implement range-based damage scaling
  - Blaster: no falloff
  - Shotgun: 50% at 500 units
  - Machinegun: 80% at 1000 units
  - Reference: `g_combat.cpp` lines 80-150

#### 3.2.4 Quad Damage Modifier
- [ ] Implement quad damage powerup effect
  - 4x damage multiplication
  - Blue screen tint
  - Distinct firing sound
  - Reference: `g_items.cpp` lines 1350-1420

---

### 3.3 Rogue Mission Pack Weapons

**Priority**: 🔵 LOW
**Complexity**: MODERATE (20-30 hours)
**Original Source**: `/rerelease/rogue/p_rogue_weapon.cpp` (445 lines)
**TypeScript File**: `/packages/game/src/combat/weapons/rogue/` (NEW)

#### 3.3.1 Ionripper
- [ ] Create ionripper weapon entity
  - Electrical projectile weapon
  - Bounces off walls
  - Chains between enemies
  - Reference: `p_rogue_weapon.cpp` lines 50-120

- [ ] Implement ripper projectile
  - Bounce physics
  - Arc electricity effect
  - Multi-target damage
  - Reference: `p_rogue_weapon.cpp` lines 90-110

#### 3.3.2 Phalanx Plasma Gun
- [ ] Create phalanx weapon entity
  - Rapid-fire plasma bolts
  - Splash damage
  - Reference: `p_rogue_weapon.cpp` lines 122-200

#### 3.3.3 Trap Weapon
- [ ] Create trap weapon (Rogue version)
  - Deployable proximity mine
  - Laser tripwire
  - Remote detonation
  - Reference: `p_rogue_weapon.cpp` lines 202-320

#### 3.3.4 ETF Rifle
- [ ] Create ETF rifle weapon
  - Flechette projectiles
  - Armor-piercing rounds
  - Reference: `p_rogue_weapon.cpp` lines 322-400

---

### 3.4 Xatrix Mission Pack Weapons

**Priority**: 🔵 LOW
**Complexity**: MODERATE (15-25 hours)
**Original Source**: `/rerelease/xatrix/p_xatrix_weapon.cpp` (164 lines)
**TypeScript File**: `/packages/game/src/combat/weapons/xatrix/` (NEW)

#### 3.4.1 Plasmabeam
- [ ] Create plasmabeam weapon
  - Sustained beam weapon
  - Heat buildup mechanic
  - Reference: `p_xatrix_weapon.cpp` lines 20-80

#### 3.4.2 Disruptor
- [ ] Create disruptor weapon
  - Disintegration effect
  - Instant kill on weak enemies
  - Damage over time on strong enemies
  - Reference: `p_xatrix_weapon.cpp` lines 82-140

#### 3.4.3 Proximity Launcher
- [ ] Create proximity mine launcher
  - Stick to surfaces
  - Proximity detection
  - Timed detonation fallback
  - Reference: `p_xatrix_weapon.cpp` lines 142-164

---

## Phase 4: Rendering Enhancements (🟢 MEDIUM)

### 4.1 Dynamic Lighting

**Priority**: 🟢 MEDIUM
**Complexity**: MODERATE (15-25 hours)
**Original Source**: `/rerelease/cl_fx.cpp` (particle/light effects)
**TypeScript File**: `/packages/engine/src/render/dlight.ts`

#### 4.1.1 GPU Dynamic Light Implementation
- [ ] Implement per-pixel dynamic lighting shader
  - Point light attenuation
  - Multiple lights per fragment
  - Reference: existing `dlight.ts` structure

- [ ] Integrate dynamic lights with BSP renderer
  - Add light uniforms to BSP shader
  - Limit to nearest 8 lights per surface
  - Reference: `/packages/engine/src/render/pipelines/bsp.ts`

- [ ] Add dynamic light culling
  - Frustum cull lights
  - Distance cull based on radius
  - Reference: `/packages/engine/src/render/renderer.ts`

#### 4.1.2 Muzzle Flash Lights
- [ ] Create muzzle flash lights on weapon fire
  - Duration: 100ms
  - Color: yellow-orange
  - Intensity based on weapon
  - Reference: client handling in `cl_fx.cpp` lines 50-120

#### 4.1.3 Explosion Lights
- [ ] Create explosion lights
  - Duration: 500ms with fade
  - Expanding radius
  - Orange-red color
  - Reference: `cl_fx.cpp` lines 122-200

#### 4.1.4 Rocket/Projectile Lights
- [ ] Attach lights to projectiles
  - Follow projectile position
  - Color based on projectile type
  - Trail effect
  - Reference: `cl_fx.cpp` lines 202-280

---

### 4.2 Particle Effects

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE-MODERATE (10-20 hours)
**Original Source**: `/rerelease/cl_fx.cpp` (various effect functions)
**TypeScript File**: `/packages/engine/src/render/particleSystem.ts`

#### 4.2.1 Weapon Impact Effects
- [ ] Implement bullet impact particles
  - Dust puff on wall hit
  - Sparks on metal
  - Reference: `cl_fx.cpp` lines 350-420

- [ ] Implement blood splatter
  - Blood spray on flesh hit
  - Decal on nearby surfaces
  - Reference: `cl_fx.cpp` lines 422-500

- [ ] Implement explosion particles
  - Fire ball expanding
  - Smoke trailing
  - Debris chunks
  - Reference: `cl_fx.cpp` lines 502-620

#### 4.2.2 Environmental Effects
- [ ] Implement water splash
  - Ripples on water surface
  - Spray particles
  - Reference: `cl_fx.cpp` lines 622-700

- [ ] Implement steam effects
  - Rising steam particles
  - Hot water/lava proximity
  - Reference: `cl_fx.cpp` lines 702-780

#### 4.2.3 Monster Effects
- [ ] Implement monster blood trail
  - Leave blood particles when wounded
  - Different colors per monster type
  - Reference: `cl_fx.cpp` lines 782-850

- [ ] Implement gib particles
  - Chunks of flesh/metal on death
  - Physics-based trajectories
  - Reference: `cl_fx.cpp` lines 852-950

---

### 4.3 View Effects & Screen Blends

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE (8-15 hours)
**Original Source**: `/rerelease/p_view.cpp` (view calculations)
**TypeScript File**: `/packages/client/src/view.ts`

#### 4.3.1 Damage Flash
- [ ] Implement damage screen flash
  - Red blend on taking damage
  - Intensity based on damage amount
  - Fade over 200ms
  - Reference: `p_view.cpp` lines 180-250

- [ ] Apply blend to PlayerState
  - Set `blend` RGBA values
  - Client applies in render
  - Reference: existing blend system

#### 4.3.2 Powerup Effects
- [ ] Implement quad damage blue tint
  - Constant blue blend while active
  - Pulsing intensity
  - Reference: `p_view.cpp` lines 252-300

- [ ] Implement invulnerability white glow
  - White screen border
  - Full-screen flash on activation
  - Reference: `p_view.cpp` lines 302-350

- [ ] Implement environment suit green tint
  - Green blend when wearing
  - Reference: `p_view.cpp` lines 352-380

#### 4.3.3 Environmental Blends
- [ ] Implement underwater blue tint
  - Constant blue when submerged
  - Intensity based on water depth
  - Reference: `p_view.cpp` lines 382-430

- [ ] Implement lava red tint
  - Red blend when in lava
  - Pulsing effect
  - Reference: `p_view.cpp` lines 432-470

#### 4.3.4 Motion Effects
- [ ] Implement screen shake on explosions
  - Camera offset randomization
  - Duration and intensity based on distance
  - Reference: `p_view.cpp` lines 520-590

- [ ] Implement viewmodel bobbing refinements
  - Smooth weapon sway while walking
  - Running vs walking difference
  - Reference: `p_view.cpp` lines 80-170

---

### 4.4 Water Rendering

**Priority**: 🟢 MEDIUM
**Complexity**: MODERATE (20-30 hours)
**Original Source**: N/A (renderer-specific)
**TypeScript File**: `/packages/engine/src/render/pipelines/water.ts` (NEW)

#### 4.4.1 Water Surface Shader
- [ ] Create water surface rendering pipeline
  - Transparent rendering pass
  - Alpha blending
  - Reference: BSP pipeline structure

- [ ] Implement wave animation
  - Vertex displacement in shader
  - Time-based sine wave
  - Configurable wave parameters

- [ ] Implement water texture scrolling
  - Animate UV coordinates
  - SURF_FLOWING support
  - Reference: existing surface flag handling

#### 4.4.2 Refraction Effect
- [ ] Implement screen-space refraction
  - Distort background behind water
  - Render to texture
  - Apply distortion in water shader

#### 4.4.3 Underwater Caustics
- [ ] Implement animated caustic lighting
  - Projected texture animation
  - Multiply with lightmap
  - Only when underwater

---

### 4.5 Sky Rendering Enhancements

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE (5-10 hours)
**Original Source**: `/rerelease/g_spawn.cpp` (worldspawn configstrings)
**TypeScript File**: `/packages/engine/src/render/pipelines/skybox.ts`

#### 4.5.1 Sky Rotation
- [ ] Implement sky rotation
  - Read CS_SKYROTATE configstring
  - Rotate skybox matrix each frame
  - Reference: `g_spawn.cpp` lines 850-900

- [ ] Implement sky rotation axis
  - Read CS_SKYAXIS configstring
  - Custom rotation axis (not just vertical)
  - Reference: `g_spawn.cpp` lines 880-920

#### 4.5.2 Animated Sky
- [ ] Implement cloud layer scrolling
  - Dual-layer skybox
  - Independent scroll speeds
  - Reference: BSP sky surface handling

---

## Phase 5: Audio Systems (🟡 HIGH)

### 5.1 Ambient Sound System

**Priority**: 🟡 HIGH
**Complexity**: SIMPLE-MODERATE (10-15 hours)
**Original Source**: `/rerelease/g_target.cpp` (target_speaker)
**TypeScript File**: `/packages/engine/src/audio/ambient.ts` (NEW)

#### 5.1.1 Target Speaker Entity
- [ ] Implement `SP_target_speaker(entity: Entity): void`
  - Ambient sound emitter
  - Looping vs one-shot mode
  - Volume configuration
  - Attenuation distance
  - Reference: `g_target.cpp` lines 352-480

- [ ] Add to entity spawn registry
  - Register classname: "target_speaker"
  - Reference: `/packages/game/src/entities/index.ts`

#### 5.1.2 Ambient Sound Playback
- [ ] Implement looping ambient sounds
  - Create looping audio source
  - 3D spatialization
  - Auto-restart when complete
  - Reference: existing audio system

- [ ] Implement ambient sound triggering
  - Enable/disable speakers via triggers
  - Change sound file dynamically
  - Reference: `g_target.cpp` lines 420-470

---

### 5.2 Environmental Audio

**Priority**: 🟢 MEDIUM
**Complexity**: MODERATE (15-20 hours)
**Original Source**: N/A (audio-specific)
**TypeScript File**: `/packages/engine/src/audio/reverb.ts` (NEW)

#### 5.2.1 Reverb System
- [ ] Implement convolution reverb using Web Audio API
  - ConvolverNode for reverb
  - Impulse response files for different spaces

- [ ] Implement room size detection
  - Estimate room dimensions from BSP
  - Select reverb based on size
  - Small room: short decay
  - Large room: long decay

- [ ] Add reverb to audio system
  - Route sounds through reverb
  - Configurable wet/dry mix
  - Reference: `/packages/engine/src/audio/system.ts`

#### 5.2.2 Sound Occlusion
- [ ] Implement sound occlusion
  - Trace from listener to sound source
  - If blocked, apply low-pass filter
  - BiquadFilterNode in Web Audio

- [ ] Implement distance-based low-pass
  - Attenuate high frequencies at distance
  - Realistic distant sound

---

### 5.3 Music System

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE (5-10 hours)
**Original Source**: `/rerelease/g_spawn.cpp` (worldspawn)
**TypeScript File**: `/packages/engine/src/audio/music.ts`

#### 5.3.1 CD Track System
- [ ] Implement CD track configstring handling
  - Read CS_CDTRACK from worldspawn
  - Map track numbers to music files
  - Reference: `g_spawn.cpp` lines 920-970

- [ ] Add configstring parsing in worldspawn
  - Set CS_CDTRACK in `SP_worldspawn`
  - Reference: `/packages/game/src/entities/worldspawn.ts`

#### 5.3.2 Music Transitions
- [ ] Implement music crossfading
  - Fade out current track
  - Fade in new track
  - Configurable fade duration (1-3 seconds)

- [ ] Implement track looping
  - Seamless loop points
  - Restart on completion

---

## Phase 6: CTF Mode (🔵 LOW)

### 6.1 CTF Core Systems

**Priority**: 🔵 LOW
**Complexity**: COMPLEX (60-80 hours)
**Original Source**: `/rerelease/ctf/` (4 files, 1,500+ lines)
**TypeScript File**: `/packages/game/src/modes/ctf/` (NEW)

#### 6.1.1 Flag Entities
**Original Source**: `/rerelease/ctf/g_ctf.cpp` (lines 50-300)
**TypeScript File**: `/packages/game/src/modes/ctf/flag.ts` (NEW)

- [ ] Implement red flag entity
  - `SP_item_flag_red(entity: Entity): void`
  - Visual: red flag model
  - Reference: `g_ctf.cpp` lines 50-120

- [ ] Implement blue flag entity
  - `SP_item_flag_blue(entity: Entity): void`
  - Visual: blue flag model
  - Reference: `g_ctf.cpp` lines 122-190

- [ ] Implement flag physics
  - Can be picked up by players
  - Drops on player death
  - Returns to base after timeout
  - Reference: `g_ctf.cpp` lines 192-300

#### 6.1.2 Flag State Management
**Original Source**: `/rerelease/ctf/g_ctf.cpp` (lines 302-550)
**TypeScript File**: `/packages/game/src/modes/ctf/state.ts` (NEW)

- [ ] Implement flag states
  - States: AT_BASE, CARRIED, DROPPED
  - State transitions
  - Reference: `g_ctf.cpp` lines 302-380

- [ ] Implement flag pickup logic
  - Team validation (can't pick up own flag)
  - Can pick up enemy flag
  - Can return own flag to base
  - Reference: `g_ctf.cpp` lines 382-480

- [ ] Implement flag drop logic
  - Drop on death
  - Manual drop with command
  - Auto-return timer (30 seconds)
  - Reference: `g_ctf.cpp` lines 482-550

#### 6.1.3 Capture Logic
**Original Source**: `/rerelease/ctf/g_ctf.cpp` (lines 552-720)
**TypeScript File**: `/packages/game/src/modes/ctf/capture.ts` (NEW)

- [ ] Implement flag capture detection
  - Must be touching own flag base
  - Must have enemy flag
  - Own flag must be at base
  - Reference: `g_ctf.cpp` lines 552-620

- [ ] Implement capture scoring
  - Award team points
  - Award individual capture bonus
  - Reset flags to bases
  - Play capture sound/effect
  - Reference: `g_ctf.cpp` lines 622-720

#### 6.1.4 Team System
**Original Source**: `/rerelease/ctf/g_ctf.cpp` (lines 722-900)
**TypeScript File**: `/packages/game/src/modes/ctf/teams.ts` (NEW)

- [ ] Implement team assignment
  - Auto-assign to balance teams
  - Manual team selection
  - Reference: `g_ctf.cpp` lines 722-800

- [ ] Implement team colors
  - Red vs Blue player skins
  - Team-colored effects
  - Reference: `g_ctf.cpp` lines 802-880

- [ ] Implement friendly fire toggle
  - Configurable team damage
  - Default: no friendly fire
  - Reference: `g_ctf.cpp` lines 882-900

#### 6.1.5 CTF Scoreboard
**Original Source**: `/rerelease/ctf/g_ctf.cpp` (lines 902-1100)
**TypeScript File**: `/packages/game/src/modes/ctf/scoreboard.ts` (NEW)

- [ ] Implement CTF-specific scoring
  - Team scores (captures)
  - Individual stats: captures, returns, defends, assists
  - Reference: `g_ctf.cpp` lines 902-1000

- [ ] Implement scoreboard display
  - Two-column team display
  - Team totals at top
  - Player stats sorted by score
  - Reference: `g_ctf.cpp` lines 1002-1100

#### 6.1.6 CTF Items & Powerups
**Original Source**: `/rerelease/ctf/g_ctf.cpp` (lines 1102-1300)
**TypeScript File**: `/packages/game/src/modes/ctf/items.ts` (NEW)

- [ ] Implement grappling hook
  - Attach to surfaces
  - Pull player toward point
  - Limited range
  - Reference: `g_ctf.cpp` lines 1102-1250

- [ ] Implement CTF-specific powerups
  - Regeneration
  - Quad damage (shorter duration)
  - Reference: `g_ctf.cpp` lines 1252-1300

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

---

## Phase 8: Xatrix Mission Pack (🔵 LOW)

### 8.1 Xatrix Game Features

**Priority**: 🔵 LOW
**Complexity**: MODERATE (25-35 hours)
**Original Source**: `/rerelease/xatrix/` (various files)
**TypeScript File**: `/packages/game/src/modes/xatrix/` (NEW)

#### 8.1.1 Xatrix Items
**Original Source**: `/rerelease/xatrix/g_xatrix_items.cpp`

- [ ] Implement Xatrix powerups
  - Quad fire (4x fire rate)
  - Anti-grav belt
  - IR goggles (heat vision)
  - Reference: `g_xatrix_items.cpp` lines 50-180

#### 8.1.2 Xatrix Monster Variants
**Original Source**: `/rerelease/xatrix/g_xatrix_monster.cpp`

- [ ] Implement modified monster stats
  - Tougher variants of base monsters
  - Enhanced AI behaviors
  - Reference: `g_xatrix_monster.cpp` lines 50-220

---

## Phase 9: Polish & Refinements (🟢 MEDIUM)

### 9.1 Entity System Refinements

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE-MODERATE (10-20 hours)
**TypeScript Files**: Various

#### 9.1.1 Entity Lifecycle
- [ ] Implement proper entity cleanup
  - Free all references on entity removal
  - Clear from spatial grid
  - Stop all sounds
  - Reference: `/packages/game/src/entities/index.ts`

- [ ] Implement entity save/load edge cases
  - Save entity think timers
  - Save animation state
  - Save AI state
  - Reference: `/packages/game/src/save/`

#### 9.1.2 Entity Networking
- [ ] Implement entity baseline system
  - Send initial entity state to clients
  - Delta compression from baseline
  - Reference: `/packages/shared/src/protocol/`

---

### 9.2 Physics Refinements

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE-MODERATE (8-15 hours)
**TypeScript File**: `/packages/shared/src/pmove/`, `/packages/game/src/physics/`

#### 9.2.1 Edge Cases
- [ ] Fix stuck-in-solid recovery
  - Better unsticking algorithm
  - Prevent permanent stuck state
  - Reference: `/packages/shared/src/pmove/pmove.ts`

- [ ] Implement conveyor belt physics
  - Move entities on conveyor surfaces
  - Configurable speed and direction
  - Reference: func_conveyor implementation

#### 9.2.2 Advanced Collision
- [ ] Implement brush model collision refinements
  - Better face selection for collision normal
  - Edge collision handling
  - Reference: `/packages/game/src/physics/collision.ts`

---

### 9.3 Network Optimizations

**Priority**: 🟢 MEDIUM
**Complexity**: MODERATE (15-25 hours)
**TypeScript File**: `/packages/client/src/net/`, `/packages/server/src/`

#### 9.3.1 Bandwidth Optimization
- [ ] Implement aggressive delta compression
  - Only send changed fields
  - Quantize floats to shorts where possible
  - Reference: `/packages/shared/src/protocol/`

- [ ] Implement entity culling for network
  - Don't send entities far from player
  - PVS-based culling
  - Reference: `/packages/server/src/`

#### 9.3.2 Latency Compensation
- [ ] Implement lag compensation for hitscan weapons
  - Rewind world state on server
  - Validate hits at player's ping time
  - Reference: prediction system

---

## Appendix A: Implementation Priority Matrix

### Critical Path (Must-Have for Functional Game)
1. Monster pathfinding (M_MoveToGoal, M_ChangeYaw, M_MoveStep) - 80 hours
2. AI perception system (AI_GetSightClient, ai_checkattack) - 40 hours
3. Trigger system (30+ trigger types) - 35 hours
4. Dynamic entities (func_door, func_plat, func_train, etc.) - 60 hours
5. Deathmatch rules complete - 30 hours

**Subtotal**: ~245 hours

### High Priority (Feature Parity)
1. Weapon alt-fires - 35 hours
2. Monster-specific behaviors - 80 hours
3. Target entities - 25 hours
4. Ambient audio - 15 hours
5. View effects - 15 hours
6. Dynamic lighting - 20 hours

**Subtotal**: ~190 hours

### Medium Priority (Polish)
1. Particle effects - 15 hours
2. Water rendering - 25 hours
3. Audio reverb - 18 hours
4. Entity refinements - 15 hours
5. Physics edge cases - 12 hours

**Subtotal**: ~85 hours

### Low Priority (Expansion Content)
1. CTF mode - 75 hours
2. Rogue expansion - 180 hours
3. Xatrix expansion - 60 hours

**Subtotal**: ~315 hours

---

## Appendix B: File Mapping Reference

### Quick Reference: Original Source → TypeScript

| System | Original C/C++ | TypeScript Target | Lines | Status |
|--------|---------------|------------------|-------|--------|
| Monster Movement | `rerelease/m_move.cpp` | `game/src/ai/movement.ts` | 1,502 | 20% |
| AI Perception | `rerelease/g_ai.cpp` | `game/src/ai/targeting.ts` | 1,808 | 40% |
| Triggers | `rerelease/g_trigger.cpp` | `game/src/entities/triggers.ts` | 1,332 | 5% |
| Dynamics | `rerelease/g_func.cpp` | `game/src/entities/funcs.ts` | 2,000+ | 30% |
| Weapons | `rerelease/p_weapon.cpp` | `game/src/combat/weapons/` | 1,970 | 65% |
| Targets | `rerelease/g_target.cpp` | `game/src/entities/targets.ts` | 850 | 15% |
| CTF | `rerelease/ctf/g_ctf.cpp` | `game/src/modes/ctf/` | 1,500 | 0% |
| Rogue AI | `rerelease/rogue/g_rogue_newai.cpp` | `game/src/ai/rogue/` | 1,612 | 5% |
| Rogue Monsters | `rerelease/rogue/m_*.cpp` | `game/src/entities/monsters/rogue/` | 3,500+ | 10% |
| Xatrix | `rerelease/xatrix/*.cpp` | `game/src/modes/xatrix/` | 1,800 | 15% |

---

## Appendix C: Testing Strategy

### Unit Testing Priorities
1. **Monster AI**: Test pathfinding with known scenarios
2. **Physics**: Test collision edge cases
3. **Triggers**: Test activation chains
4. **Weapons**: Test damage calculations and alt-fires

### Integration Testing
1. **Full Game Loop**: Load map, spawn monsters, player movement
2. **Deathmatch**: Scoring, respawning, item pickup
3. **CTF**: Flag capture, team scoring
4. **Network**: Client prediction, entity synchronization

### Regression Testing
- Compare against original Quake II behavior
- Record demos and validate playback
- Verify save/load round-trip

---

## Summary

This document outlines **~835 hours** of development work to complete a perfect port of Quake II to TypeScript:

- **Critical Path**: 245 hours (monster AI, triggers, dynamics)
- **High Priority**: 190 hours (weapons, effects, audio)
- **Medium Priority**: 85 hours (polish, refinements)
- **Low Priority**: 315 hours (CTF, expansions)

Each task includes:
- ✅ Original C/C++ source file reference (preferably `/rerelease`)
- ✅ TypeScript file to create or modify
- ✅ Specific line number references
- ✅ Complexity estimates
- ✅ Implementation notes

The port is currently **~51% complete**. Focusing on the **Critical Path** items first will result in a fully functional, feature-complete Quake II port suitable for single-player and deathmatch gameplay.
