# Section 6: AI & Monster Behaviors

## Overview
This section covers the artificial intelligence system for monsters and NPCs in Quake II. It includes perception (sight, hearing), decision-making (state machines), movement (pathfinding, navigation), and attack behaviors for all base campaign monsters. The AI must be deterministic for save/load consistency and provide challenging, fair combat encounters.

## Dependencies
- **Entity System (Section 4)**: REQUIRED - monster entities, think callbacks, spawn functions
- **Physics System (Section 3)**: REQUIRED - movement traces, line-of-sight checks
- **Combat System (Section 5)**: REQUIRED - damage dealing, weapon firing, taking damage
- **Audio (Section 7)**: Partial - monster sounds (idle, sight, pain, death, attack)
- **Shared pmove**: May use for monster movement, or custom movement code

## Work Already Done
- ✅ Entity think/callback system (Section 4)
- ✅ Trace/line-of-sight API (Section 3)
- ✅ Damage system (Section 5)
- ✅ Deterministic RNG for AI decisions
- ✅ Perception utility layer (range classification, visibility, FOV tests) aligned with rerelease constants
- ✅ Monster entity timing fields (search, attack, pain) exposed on base entity and saved
- ✅ AI State Machine (`M_MoveFrame`, `monster_think`) implementation
- ✅ Basic Soldier/Guard monster entity implementation (`monster_soldier`)
- ✅ Unit tests for monster spawning, state transitions, and animation looping
- ✅ AI Movement helpers: `CheckGround`, `M_CheckBottom`, `M_walkmove`, `SV_StepDirection`, `SV_NewChaseDir`
- ✅ Implemented `pain` and `die` callbacks for Soldier and Gunner, including gibbing logic.
- ✅ Implemented Soldier variants (Shotgun Guard, Machinegun Guard) via spawnflags and unit tests.
- ✅ Implemented Gunner unit tests covering dual attacks (chain/grenade).
- ✅ Implemented Infantry (Enforcer) behaviors and unit tests.
- ✅ Implemented Berserker behaviors and unit tests.
- ✅ Implemented Tank and Tank Commander behaviors and unit tests.
- ✅ Implemented Gladiator behaviors and unit tests.
- ✅ Implemented Medic behaviors (Healing/Resurrection, Blaster) and unit tests.
- ✅ Implemented Brain (Brains) behaviors (Tentacle attacks) and unit tests.
- ✅ Implemented Flyer behaviors (Flying, Blaster, Slash) and unit tests.
- ✅ Implemented Icarus behaviors (Flying, Blaster) and unit tests.
- ✅ Implemented Parasite behaviors (Drain attack, healing) and unit tests.
- ✅ Implemented Mutant behaviors (Jumping attack, melee) and unit tests.
- ✅ Implemented Chick (Iron Maiden) behaviors (Rocket, Slash) and unit tests.
- ✅ Implemented Supertank behaviors (Chaingun, Rocket, Grenade) and unit tests.
- ✅ Implemented Barracuda Shark behaviors (Swimming, Melee bite) and unit tests.

## Tasks Remaining

### AI Core Framework
- [x] AI state machine
  - States: idle, stand, walk, run, attack, melee, pain, death
  - State transitions based on conditions (see enemy, take damage, lose enemy)
  - Each monster has custom state functions
- [x] AI think callback
  - Called every frame (or every N frames for distant monsters)
  - Update current state
  - Execute state-specific behavior
  - Schedule next think
- [x] AI entity fields (extend base entity)
  - `enemy`: Current target entity
  - `movetarget`: Waypoint for scripted movement
  - `goalentity`: Long-term goal (item, player, etc.)
  - `ideal_yaw`: Direction monster wants to face
  - `yaw_speed`: How fast monster turns
  - `search_time`: When to give up searching for enemy
  - `attack_finished_time`: Cooldown between attacks
  - `pain_finished_time`: Stun duration after taking damage

### Perception System
- [ ] Vision (enemy detection)
  - [x] **Line-of-sight check**: Trace from monster eyes to player
  - [x] **FOV check**: Only see player in front hemisphere (or full 360 for some monsters)
  - [x] **Range check**: Maximum sight distance (varies by monster, lighting)
  - **Visibility cooldown**: Once seen, track for N seconds even if LOS lost
- [ ] Hearing (sound-based detection)
  - Weapon fire, footsteps, item pickup generate "noise"
  - Monsters in range hear noise and investigate
  - Higher alert level when hearing combat
- [ ] Enemy tracking
  - Remember last known position of enemy
  - If LOS lost, move to last known position
  - Give up search after timeout, return to idle
- [ ] Target selection
  - Prioritize player in single-player
  - In future multiplayer: closest, weakest, or attacker

### Movement System
- [x] Ground movement
  - [x] Walk/run toward goal (enemy, waypoint)
  - [x] Turn gradually (yaw_speed limit)
  - [x] Use trace to avoid walking off cliffs (or intentionally jump)
  - [x] Step up stairs, slide on slopes
- [x] Flying movement (for flying monsters: Flyer, Icarus)
  - 3D movement, no ground constraint
  - Altitude control (rise, descend, hover)
  - Smooth acceleration/deceleration
- [x] Swimming movement (rare, but some monsters swim)
  - 3D movement in water
  - Surface for air if needed
- [ ] Obstacle avoidance
  - Basic: stop if blocked by wall
  - Advanced: strafing, backing up, jump over obstacles
- [ ] Pathfinding
  - **Simple**: Direct line to target, stop if blocked
  - **Waypoints**: Use `path_corner` entities for scripted patrol routes
  - **A* pathfinding** (optional, complex): Navigate around obstacles
    - Defer full A* for initial release
    - Can implement later for smarter navigation
- [ ] Jump/fall handling
  - Some monsters jump (dog, mutant)
  - Fall damage (or immune for some monsters)
  - Check if jump is safe before leaping

### Combat Behaviors
- [ ] Ranged attacks
  - Stop moving, face enemy
  - Fire projectile or instant-hit attack
  - Cooldown between shots
  - Lead target (predict player movement)
  - Accuracy varies by monster and difficulty
- [ ] Melee attacks
  - Move close to enemy
  - Trigger melee attack animation
  - Damage player when in range and animation hits
  - Knockback
- [ ] Special attacks
  - Some monsters have multiple attack types (e.g., Gunner: machinegun and grenade)
  - Choose attack based on range, situation
  - Some monsters have charge attacks (Berserker)
- [ ] Dodging/evasion
  - Strafe left/right when player fires
  - Duck behind cover
  - Advance/retreat based on health

### Monster Types (Base Campaign)
All monsters need spawn, idle, sight, attack, pain, death behaviors. Attack patterns vary by type.

#### Ground Monsters
- [x] **Guard** (basic soldier)
  - Machinegun ranged attack
  - Moderate health, common enemy
- [x] **Shotgun Guard**
  - Shotgun ranged attack, spread damage
- [x] **Machinegun Guard**
  - Faster machinegun fire
- [x] **Enforcer** (chaingun soldier)
  - Chaingun attack, high fire rate
- [x] **Gunner**
  - Dual attack: machinegun and grenade launcher
  - Choose based on range
- [ ] **Infantry**
  - Machinegun, can dodge
- [x] **Berserker** (melee)
  - Strong melee attacks
  - Charge attack
  - High health
- [x] **Tank / Tank Commander**
  - Heavy armor, slow movement
  - Blaster, machinegun, rocket attacks
  - Boss-tier enemy
- [x] **Gladiator**
  - Railgun attack
  - Melee claw attack
  - Fast movement
- [x] **Medic**
  - Weak blaster attack
  - Can resurrect dead monsters
- [x] **Brain** (Brains, floating brain enemy)
  - Melee tentacle attack
  - Floats/flies

#### Flying Monsters
- [x] **Flyer**
  - Flying, blaster attack
  - Melee slash
  - Agile movement
- [x] **Icarus** (advanced flyer)
  - Similar to Flyer, stronger

#### Large/Boss Monsters
- [x] **Supertank**
  - Very high health
  - Rocket launcher, machinegun
  - Slow movement
- [ ] **Jorg / Makron** (final bosses)
  - Complex attack patterns
  - Multiple phases
  - Scripted sequences (may defer complex scripting)

#### Special Monsters
- [x] **Parasite**
  - Leech attack: drains health from player, heals self
  - Melee range
- [x] **Chick / Iron Maiden**
  - Rocket launcher attack
  - Melee slash
- [x] **Mutant**
  - Jumping melee attack
  - Agile, unpredictable movement
- [x] **Barracuda Shark** (water monster)
  - Swimming, melee bite

### Monster Animations
- [x] Animation frame sequences
  - Idle, walk, run, attack, pain, death
  - (Partially done for Soldier/Gunner)
- [x] Animation controller
  - Set model frame based on current state
  - Loop or one-shot animations
  - Callbacks when animation completes
- [ ] Sync attacks with animation
  - Damage applied at specific frame (e.g., when claw swipes)
  - Muzzle flash at specific frame (for gun monsters)

### Monster Sounds
- [ ] Sound events
  - **Idle**: Random ambient sounds when not engaged
  - **Sight**: Alert sound when spotting player ("There he is!")
  - **Pain**: Damaged sound
  - **Death**: Death cry
  - **Attack**: Weapon fire or melee swing sound
  - **Step**: Footstep sounds (for large monsters)
- [ ] Sound triggering
  - Play sound at appropriate time (via audio system, Section 7)
  - Positioned at monster location
  - Attenuation based on distance

### Difficulty Scaling
- [ ] Difficulty levels (easy, medium, hard, nightmare)
  - Adjust monster health
  - Adjust monster damage
  - Adjust monster accuracy
  - Adjust monster reaction time
- [ ] Monster spawn filtering
  - Some monsters only spawn on higher difficulties
  - Check spawnflags during entity spawn

### Special AI Behaviors
- [x] **Medic resurrection**
  - Medic scans for dead monsters nearby
  - Moves to corpse, channels resurrection
  - Resurrects monster with partial health
- [ ] **Infantry dodge**
  - Infantry dodges left/right when player fires
  - Requires detecting incoming projectiles (or just random dodge)
- [ ] **Monster infighting**
  - Monsters can damage each other (rocket splash, etc.)
  - May turn on each other if hit (optional, complex)
- [ ] **Scripted sequences**
  - Some monsters follow scripted paths (patrol routes)
  - Use `path_corner` entities
  - Break from script when player sighted

### AI Utilities
- [x] `ai_stand`: Idle state, look around
- [x] `ai_walk`: Walk toward goal
- [x] `ai_run`: Run toward goal
- [x] `ai_charge`: Charge attack (Berserker)
- [x] `ai_turn`: Turn toward ideal_yaw
- [x] `ai_face`: Face toward enemy
- [x] `ai_move`: Move forward by distance
- [ ] `FindTarget`: Scan for enemy
- [x] `FoundTarget`: React to spotting enemy (sound, alert)
- [x] `HuntTarget`: Move toward last known enemy position
- [x] `visible`: Check if entity is visible
- [x] `infront`: Check if entity is in front hemisphere
- [x] `range`: Check distance to entity (melee, short, medium, long)
- [x] `CheckGround`: Check if on ground
- [x] `M_CheckBottom`: Check for ledges
- [x] `M_walkmove`: Movement with collision
- [x] `SV_StepDirection`: Try different step directions
- [x] `SV_NewChaseDir`: Chase enemy

Recent work:
- Added perception coverage for rerelease LOS/FOV/range rules with unit tests that lock in ambush cones, viewheight trace masks,
  and bounding-box distance buckets for melee/near/mid/far ranges.
- Implemented the rerelease-style turning and movement helpers (`changeYaw`/`walkMove`) and wired `ai_move`, `ai_turn`, and `ai_face` to mirror `M_ChangeYaw`/`M_walkmove` behavior for deterministic math-only movement. Verified against new unit tests that exercise wraparound yaw clamping and forward stepping.
- Tightened the movement helpers to mutate entity vectors in place (matching the C data flow) and added guardrails in tests to ensure yaw/position updates preserve references for downstream systems.
- Added the core `ai_stand`/`ai_walk`/`ai_run`/`ai_charge` behaviors that honor target-facing rules from the rerelease before applying movement, with deterministic yaw clamping tests covering idle turns, goal-facing walks, enemy-priority runs, and charge-style pursuit.
- Added `facingIdeal` with rerelease yaw tolerance (default and pathing-specific) plus a `monsterinfo.aiflags` scaffold on entities so pathfinding and steering logic can branch correctly in future behaviors.
- Ported the `HuntTarget`/`FoundTarget` flows with rerelease-style field updates (last sighting, combat point handoff, attack cooldown) and unit tests to pin down wakeup rules, notarget rejection, and hearing limits.
- Implemented the Quake II `mmove_t` and `mframe_t` system via `MonsterMove` and `MonsterFrame` interfaces.
- Created `monster_think` and `M_MoveFrame` to drive monster AI and animations.
- Implemented the `monster_soldier` (Guard) entity with placeholder moves for stand, walk, run, and attack.
- Added comprehensive tests for monster spawning, state transitions, and animation looping.
- Implemented detailed AI movement helpers (`CheckGround`, `M_CheckBottom`, `M_walkmove`, `SV_StepDirection`, `SV_NewChaseDir`) to support ground movement, ledge checking, and enemy chasing.
- Implemented `monster_gunner` with machinegun and grenade launcher attacks, ensuring correct spawn properties and state transitions.
- Implemented pain and death callbacks for `monster_soldier` and `monster_gunner`, including animation states and gibbing.
- Implemented Soldier variants (Shotgun Guard, Machinegun Guard) via spawnflags and unit tests.
- Implemented Gunner unit tests covering dual attacks (chain/grenade).
- Implemented Infantry (Enforcer) behaviors and unit tests.
- Implemented Berserker behaviors and unit tests.
- Implemented Tank and Tank Commander behaviors and unit tests.
- Implemented Gladiator behaviors and unit tests.
- Implemented Medic behaviors (Healing/Resurrection, Blaster) and unit tests.
- Implemented Brain (Brains) behaviors (Tentacle attacks) and unit tests.
- Implemented Flyer behaviors (Flying, Blaster, Slash) and unit tests.
- Implemented Icarus behaviors (Flying, Blaster) and unit tests.
- Implemented Parasite behaviors (Drain attack, healing) and unit tests.
- Implemented Mutant behaviors (Jumping attack, melee) and unit tests.
- Implemented Chick (Iron Maiden) behaviors (Rocket, Slash) and unit tests.
- Implemented Supertank behaviors (Chaingun, Rocket, Grenade) and unit tests.
- Implemented Barracuda Shark behaviors (Swimming, Melee bite) and unit tests.

### Pain/Death Callbacks
- [x] Pain callback
  - Play pain sound, animation
  - Interrupt current action (brief stun)
  - Increase aggression or flee (based on health)
- [x] Death callback
  - Play death animation and sound
  - Become non-solid (SOLID_NOT)
  - Drop items (rare, some monsters drop ammo/health)
  - Gib if overkill damage
  - Sink into ground after delay

## Integration Points
- **From Entity System (Section 4)**: Uses entity structure, think callbacks, spawn registry
- **From Physics (Section 3)**: Uses trace for LOS, movement, cliff detection
- **From Combat (Section 5)**: Calls damage functions, weapon fire logic
- **To Audio (Section 7)**: Plays monster sounds
- **To Rendering (Section 2)**: Sets animation frames, particle effects

## Testing Requirements

### Unit Tests (Standard)
- Line-of-sight checks (trace results)
- FOV angle calculations
- Range checks (melee, short, medium, long)
- Ideal yaw calculation (turn toward target)
- Animation frame sequencing

### Integration Tests
- **Monster spawn**: Spawn each monster type, verify model, health, default state
- **Enemy detection**: Place monster facing player, verify sight callback triggers
- **Attack behavior**: Verify each monster attacks player at appropriate range
- **Movement**: Verify monster walks/runs toward player, navigates around obstacles
- **Pain reaction**: Damage monster, verify pain animation and sound
- **Death**: Kill monster, verify death animation, sound, corpse state
- **Scripted patrol**: Set up path_corner route, verify monster follows
- **Medic resurrection**: Kill a guard near a medic, verify medic resurrects it

### Performance Tests
- **Many monsters**: Spawn 50+ monsters, verify 60 FPS maintained
- **AI think cost**: Measure time spent in AI logic per frame
- **LOS traces**: Many monsters checking LOS to player simultaneously

### Gameplay Balance Tests
- **Difficulty**: Test each difficulty level, verify monster stats scale correctly
- **Attack damage**: Verify each monster's damage matches original Quake II
- **Monster health**: Verify health values match original
- **Attack frequency**: Verify attack cooldowns feel fair, not overwhelming

### Edge Case Tests
- **No LOS**: Monster loses sight of player, verify returns to idle after timeout
- **Stuck monster**: Monster blocked by geometry, verify doesn't freeze
- **Monster in lava**: Monster takes environmental damage, verify death
- **Friendly fire**: Rocket hits another monster, verify damage or ignore

## Notes
- AI is complex and time-consuming; start with 1-2 simple monsters (Guard, Berserker), then expand
- Medic resurrection is one of the most complex behaviors; may defer for initial release
- Flying monsters require full 3D movement, more complex than ground monsters
- Pathfinding is hard; simple direct-line movement is acceptable for first pass
- Monster animations vary widely; ensure all animation sequences are defined before implementing
- Deterministic RNG is critical: monster decisions must be reproducible for save/load
- Some monsters have special triggers (e.g., Tank Commander taunts before attacking)
- Boss fights may have scripted phases, cinematics; requires coordination with level scripting (Section 4)
- Rerelease source reference: `g_ai.cpp`, `m_*.cpp` (one file per monster type), `m_flash.cpp` (muzzle flash positions)
- Monster counts and placement dramatically affect difficulty; level design matters as much as AI
- Consider simplifying rare monsters (Barracuda Shark) if not in critical path maps
