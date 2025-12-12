# Section 18.2: Game Mechanics & Rules

**Priority**: 🔴 CRITICAL

This phase covers fundamental game mechanics including triggers, dynamic entities, and deathmatch rules.

---

## 2.1 Trigger System

**Priority**: 🔴 CRITICAL
**Complexity**: MODERATE (30-50 hours)
**Original Source**: `/rerelease/g_trigger.cpp` (1,332 lines)
**TypeScript File**: `/packages/game/src/entities/triggers.ts`

### 2.1.1 Basic Triggers
- [x] Implement `SP_trigger_multiple(entity: Entity): void`
  - Repeatable trigger with wait time
  - Touch detection for players/monsters
  - Target activation
  - Reference: `g_trigger.cpp` lines 50-150

- [x] Implement `SP_trigger_once(entity: Entity): void`
  - Single-use trigger
  - Auto-remove after activation
  - Reference: `g_trigger.cpp` lines 152-200

- [x] Implement `SP_trigger_relay(entity: Entity): void`
  - Relay signal to other entities
  - Delay support
  - Reference: `g_trigger.cpp` lines 202-280

- [x] Implement `SP_trigger_counter(entity: Entity): void`
  - Count activations before firing
  - Multi-activation requirement
  - Reference: `g_trigger.cpp` lines 282-360

### 2.1.2 Movement Triggers
- [x] Implement `SP_trigger_push(entity: Entity): void`
  - Apply velocity to entities in volume
  - Jump pads, wind tunnels
  - Configurable push speed and angle
  - Reference: `g_trigger.cpp` lines 362-480

- [x] Implement `SP_trigger_hurt(entity: Entity): void`
  - Damage entities in volume
  - Configurable damage amount and type
  - Death triggers (lava, slime)
  - Reference: `g_trigger.cpp` lines 482-580

- [x] Implement `SP_trigger_gravity(entity: Entity): void`
  - Modify gravity in volume
  - Low-gravity zones
  - Reference: `g_trigger.cpp` lines 582-650

### 2.1.3 Special Triggers
- [x] Implement `SP_trigger_teleport(entity: Entity): void`
  - Teleport entities to destination
  - info_teleport_destination support
  - Velocity preservation/zeroing
  - Reference: `g_trigger.cpp` lines 652-780

- [x] Implement `SP_trigger_secret(entity: Entity): void`
  - Secret area tracking
  - Update client stats for secrets found
  - Message display
  - Reference: `g_trigger.cpp` lines 782-850

- [x] Implement `SP_trigger_monsterjump(entity: Entity): void`
  - Help monsters navigate jumps
  - Apply jump velocity to monsters only
  - Reference: `g_trigger.cpp` lines 852-920

### 2.1.4 Advanced Triggers
- [x] Implement `SP_trigger_always(entity: Entity): void`
  - Fire immediately on spawn
  - Level start events
  - Reference: `g_trigger.cpp` lines 922-980

- [x] Implement `SP_trigger_look(entity: Entity): void`
  - Activate when player looks at entity
  - FOV-based detection
  - Reference: `g_trigger.cpp` lines 982-1080

- [x] Implement `SP_trigger_key(entity: Entity): void`
  - Require specific key item
  - Key consumption or preservation
  - Reference: `g_trigger.cpp` lines 1082-1180

- [ ] Implement water current triggers
  - CONTENTS_CURRENT_* application
  - Directional water flow
  - Reference: `g_trigger.cpp` lines 1182-1280

---

## 2.2 Dynamic Entities (func_*)

**Priority**: 🔴 CRITICAL
**Complexity**: MODERATE-COMPLEX (60-90 hours)
**Original Source**: `/rerelease/g_func.cpp` (2,000+ lines)
**TypeScript File**: `/packages/game/src/entities/funcs.ts`

### 2.2.1 Doors
- [x] Implement `SP_func_door(entity: Entity): void`
  - Sliding doors (linear movement)
  - Configurable open/close speed
  - Auto-close with wait time
  - Lock support (requires key)
  - Reference: `g_func.cpp` lines 50-250

- [x] Implement `SP_func_door_rotating(entity: Entity): void`
  - Rotating doors (angular movement)
  - Hinge point configuration
  - Reverse opening direction
  - Reference: `g_func.cpp` lines 252-420

- [x] Implement door state machine
  - States: CLOSED, OPENING, OPEN, CLOSING, BLOCKED
  - Crush damage when blocked
  - Sound events (start, stop, locked)
  - Reference: `g_func.cpp` lines 100-180

### 2.2.2 Platforms & Elevators
- [x] Implement `SP_func_plat(entity: Entity): void`
  - Platform elevator
  - Auto-lower when player stands on it
  - Wait at top/bottom
  - Reference: `g_func.cpp` lines 422-580

- [x] Implement `SP_func_plat2(entity: Entity): void`
  - Enhanced platform with more states
  - Configurable movement paths
  - Reference: `g_func.cpp` lines 582-720
  - Note: In this port, `func_plat2` functionality is integrated with `func_plat` logic where possible, as they share significant behavior.

- [x] Implement `SP_func_train(entity: Entity): void`
  - Track-based movement
  - Follow path_corner entities
  - Variable speed
  - Reference: `g_func.cpp` lines 722-900

### 2.2.3 Buttons
- [x] Implement `SP_func_button(entity: Entity): void`
  - Pressable button
  - Move distance on activation
  - Return to rest position
  - Activation sounds
  - Reference: `g_func.cpp` lines 902-1020

- [x] Implement touch vs use activation
  - Touch: activate on contact
  - Use: require +use button press
  - Reference: `g_func.cpp` lines 950-1000

### 2.2.4 Movers
- [x] Implement `SP_func_rotating(entity: Entity): void`
  - Continuously rotating entity
  - Configurable rotation axis and speed
  - Fan blades, gears, etc.
  - Reference: `g_func.cpp` lines 1022-1150

- [ ] Implement `SP_func_pendulum(entity: Entity): void`
  - Swinging pendulum motion
  - Arc angle and period configuration
  - Swinging blades, chandeliers
  - Reference: `g_func.cpp` lines 1152-1280

- [x] Implement `SP_func_conveyor(entity: Entity): void`
  - Conveyor belt
  - Move entities standing on surface
  - Configurable speed and direction
  - Reference: `g_func.cpp` lines 1282-1380

### 2.2.5 Walls & Crushers
- [x] Implement `SP_func_wall(entity: Entity): void`
  - Movable wall
  - Crush players between wall and obstacle
  - Configurable crush damage
  - Reference: `g_func.cpp` lines 1382-1520

- [x] Implement crusher death sequence
  - Instant death if crushed
  - Gib spawning
  - Sound effects
  - Reference: `g_func.cpp` lines 1450-1500

### 2.2.6 Special Functions
- [x] Implement `SP_func_timer(entity: Entity): void`
  - Periodic event trigger
  - Configurable interval
  - Random variance support
  - Reference: `g_func.cpp` lines 1522-1620

- [x] Implement `SP_func_explosive(entity: Entity): void`
  - Destructible entity
  - Explode on death
  - Damage radius
  - Reference: `g_func.cpp` lines 1622-1750

- [x] Implement `SP_func_killbox(entity: Entity): void`
  - Instant death volume
  - Kill all entities inside
  - Used for level cleanup
  - Reference: `g_func.cpp` lines 1752-1820

---

## 2.3 Target Entities

**Priority**: 🟡 HIGH
**Complexity**: MODERATE (20-30 hours)
**Original Source**: `/rerelease/g_target.cpp` (various)
**TypeScript File**: `/packages/game/src/entities/targets.ts`

### 2.3.1 Visual Effects
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

### 2.3.2 Audio Targets
- [ ] Implement `SP_target_speaker(entity: Entity): void`
  - Ambient sound emitter
  - Looping or one-shot
  - Volume and attenuation
  - Reference: `g_target.cpp` lines 352-480

- [ ] Implement sound triggering system
  - Activate/deactivate speakers
  - Change sound files dynamically
  - Reference: `g_target.cpp` lines 420-470

### 2.3.3 Gameplay Targets
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

### 2.3.4 Spawning Targets
- [ ] Implement `SP_target_spawner(entity: Entity): void`
  - Spawn entities on activation
  - Configurable spawn count
  - Reference: `g_target.cpp` lines 722-850

- [ ] Implement `SP_target_monster_spawner(entity: Entity): void`
  - Spawn monsters dynamically
  - Ambush system support
  - Reference: `g_target.cpp` lines 852-950

---

## 2.4 Deathmatch Rules

**Priority**: 🟡 HIGH
**Complexity**: MODERATE (25-35 hours)
**Original Source**: `/rerelease/g_main.cpp`, `/rerelease/g_cmds.cpp`
**TypeScript File**: `/packages/game/src/modes/deathmatch.ts` (NEW)

### 2.4.1 Scoring System
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

### 2.4.2 Respawn System
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

### 2.4.3 Item Respawn
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

### 2.4.4 Deathmatch-Specific Mechanics
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
