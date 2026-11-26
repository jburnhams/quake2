# Section 15: Missing & Overlooked Features

## Overview
This section documents features present in the original Quake II rerelease that are **completely missing** from the current implementation plan and TypeScript port. These represent gaps in the original section documents that need to be added as new work items.

## Dependencies
- **Original Source**: Complete analysis of `/home/user/quake2/rerelease/` source code
- **Mission Packs**: Analysis of Rogue and Xatrix expansion content
- **KEX Engine**: Features added in the Nightdive KEX rerelease

## Feature Categories

This section is organized by where missing features should be integrated:
- **Section 15.0**: Foundational animation and weapon systems (CRITICAL BLOCKERS)
- **Section 15.1**: Missing weapons (base game + mission packs)
- **Section 15.2**: Missing monsters
- **Section 15.3**: Missing entities
- **Section 15.4**: Missing game systems

---

## 0. FOUNDATIONAL SYSTEMS (Critical Blockers)

**See Section 15.0 for complete details**

### Overview
The implementation is missing **entire foundational systems** that are required for proper weapon functionality. These are not small features - they are architectural gaps that affect all weapons.

### Critical Missing Systems (Section 15.0)

1. **P_ProjectSource System** (15.0.1 - 2 days, P0)
   - All weapons fire from player center, not hand
   - Can shoot through walls by standing against them
   - Railgun doesn't work correctly
   - **Status**: BROKEN - needs immediate fix

2. **Weapon Animation System** (15.0.2 - 2 weeks, P1)
   - NO weapon state machine (ACTIVATING/READY/FIRING/DROPPING)
   - NO gun frame animations (ps.gunframe)
   - NO raise/lower/fire/idle sequences
   - NO animation timing system
   - **Status**: COMPLETELY MISSING - blocks hand grenade and all weapon polish

3. **Player Body Animation System** (15.0.3 - 1 week, P2)
   - NO player body animations
   - NO throw gestures
   - NO attack animations
   - **Status**: COMPLETELY MISSING - visual polish only

**Total Effort for Foundations**: ~3 weeks sequential work

---

## 1. MISSING WEAPONS (Section 5 Extension)

### Hand Grenade (Throwable Weapon)
**Original**: `p_weapon.cpp` lines 988-1011, `Throw_Generic` lines 1013-1213
**Status**: ~20% complete - Basic mechanics work, but NO animation system
**Priority**: HIGH - Core base game weapon
**Blockers**: Section 15.0 (all three subsections)

**Current Status** (See Section 15.1 for details):
- ✓ Basic throw mechanics (simplified, wrong architecture)
- ✓ Hold-to-cook timer (not frame-based)
- ✓ Variable throw speed calculation
- ✓ In-hand explosion logic
- ✗ Throw_Generic animation system (MISSING)
- ✗ Weapon state machine (MISSING)
- ✗ Gun frame animations (MISSING)
- ✗ Primed loop sound (MISSING)
- ✗ Player throw gesture (MISSING)
- ✗ P_ProjectSource for proper origin (MISSING)

**Previous Documentation Was Misleading**: The hand grenade is NOT "nearly complete". The basic physics work, but the entire animation framework is missing. This is like having a car engine without a transmission, steering, or wheels.

---

### Mission Pack Weapons - Rogue (Ground Zero)

#### Plasma Beam
**Original**: `rogue/p_rogue_weapon.cpp` lines for plasma beam
**Type**: Sustained beam weapon similar to lightning gun
**Priority**: MEDIUM - Mission pack content

**Features**:
- Continuous beam that damages while held
- Cell consumption per frame (not per shot)
- Visual beam effect from player to target
- Pushback effect on player

#### Ion Ripper
**Original**: `rogue/g_rogue_weapon.cpp`
**Type**: Bouncing projectile weapon
**Priority**: MEDIUM

**Features**:
- Fires spinning blade projectiles
- Bounces off walls up to 5 times
- Deals damage on each contact
- Unique ricochet sound

#### ETF Rifle
**Original**: `rogue/g_rogue_weapon.cpp`
**Type**: Freeze ray weapon
**Priority**: MEDIUM

**Features**:
- Freezes enemies solid
- Frozen enemies shatter on next hit
- Visual ice effect
- Temperature system

#### Phalanx
**Original**: `rogue/g_rogue_weapon.cpp`
**Type**: Plasma cannon
**Priority**: MEDIUM

**Features**:
- Large plasma ball projectile
- Massive radius damage
- Unique projectile model
- Purple energy effects

#### Prox Mine Launcher
**Original**: `rogue/g_rogue_weapon.cpp`
**Type**: Deployable mine weapon
**Priority**: MEDIUM

**Features**:
- Fires mines that stick to surfaces
- Proximity trigger (enemy detection)
- Laser tripwire beam
- Team-aware (doesn't trigger for owner)
- Max 50 active mines per player

#### Chainfist
**Original**: `rogue/g_rogue_weapon.cpp`
**Type**: Melee weapon
**Priority**: LOW

**Features**:
- Chainsaw-style melee
- High damage at close range
- Continuous damage while held
- Gore effects

---

### Mission Pack Weapons - Xatrix (The Reckoning)

#### Trap
**Original**: `xatrix/g_xatrix_weapon.cpp`
**Type**: Deployable trap weapon
**Priority**: MEDIUM

**Features**:
- Deployable laser trap
- Damages enemies that cross beam
- Limited lifetime
- Visual laser beam effect

---

## 2. MISSING MONSTERS (Section 6 Extension)

### Base Game Monsters

#### monster_actor
**Original**: `m_actor.cpp` (12,981 bytes)
**Priority**: MEDIUM - Used for scripted sequences
**Features**:
- Scripted civilian NPC
- Can follow paths, face targets
- Different animation sets (stand, walk, run, pain, death)
- Used in cutscenes and ambient life

#### monster_insane
**Original**: `m_insane.cpp` (17,333 bytes)
**Priority**: MEDIUM - Common enemy in later levels
**Features**:
- Insane civilian variations
- Multiple behavioral modes (stand, crawl, run)
- Melee attacks
- Gibs variation

---

### Boss Variants

#### monster_boss31 (Boss3/Makron Variant)
**Original**: `m_boss31.cpp` (16,008 bytes)
**Priority**: HIGH - Final boss variant
**Features**:
- Different attack patterns from base Makron
- Railgun and BFG combo attacks
- Multi-phase combat

#### monster_boss32 (Boss3 Second Phase)
**Original**: `m_boss32.cpp` (18,804 bytes)
**Priority**: HIGH - Final boss second form
**Features**:
- Transformation sequence
- Different movement patterns
- Enhanced versions of Makron attacks

---

### Mission Pack Monsters - Rogue

#### monster_carrier
**Original**: `rogue/m_rogue_carrier.cpp`
**Priority**: MEDIUM
**Features**:
- Large flying boss
- Spawns smaller enemies (fixbots)
- Multiple attack types
- High health pool

#### monster_widow / monster_widow2
**Original**: `rogue/m_rogue_widow.cpp`, `m_rogue_widow2.cpp`
**Priority**: MEDIUM - Rogue campaign boss
**Features**:
- Multi-legged boss monster
- Lightning attacks
- Spawning mechanics
- Two-phase combat

#### monster_stalker
**Original**: `rogue/m_rogue_stalker.cpp`
**Priority**: MEDIUM
**Features**:
- Stealth enemy
- Invisibility/cloaking
- Ambush tactics
- High speed movement

---

### Mission Pack Monsters - Xatrix

#### monster_gekk
**Original**: `xatrix/m_xatrix_gekk.cpp`
**Priority**: MEDIUM - Signature Xatrix enemy
**Features**:
- Amphibious monster
- Can swim and walk
- Leap attacks
- Melee and spit attacks

#### monster_fixbot
**Original**: `xatrix/m_xatrix_fixbot.cpp`
**Priority**: LOW - Support unit
**Features**:
- Flying support bot
- Repairs other monsters
- Weak attacks
- Avoidance behavior

---

### Mission Pack Monsters - Ground Zero

#### monster_arachnid
**Original**: `m_arachnid.cpp`
**Priority**: MEDIUM
**Features**:
- Spider-like creature
- Wall climbing
- Web attacks
- Fast movement

#### monster_guncmdr (Gun Commander)
**Original**: `m_guncmdr.cpp` (38,296 bytes - very complex)
**Priority**: MEDIUM
**Features**:
- Enhanced gunner variant
- More attacks than base gunner
- Shield mechanics
- Higher health/damage

#### monster_guardian
**Original**: `m_guardian.cpp`
**Priority**: MEDIUM
**Features**:
- Enhanced tank variant
- Different weapon loadout
- Higher stats than tank commander

#### monster_shambler
**Original**: `m_shambler.cpp`
**Priority**: LOW - Quake 1 crossover
**Features**:
- Quake 1 Shambler port
- Lightning attacks
- High health
- Unique animations

---

## 3. MISSING ENTITY TYPES (Section 4 Extension)

### Critical Func Entities

#### func_door_secret
**Original**: `g_func.cpp` SP_func_door_secret
**Priority**: HIGH - Used in many maps
**Features**:
- Slides into wall (different from regular door)
- Trigger-based opening
- Secret tracking
- Unique sounds and movement

#### func_door_rotating
**Original**: `g_func.cpp` SP_func_door_rotating
**Priority**: MEDIUM
**Features**:
- Rotates on hinges instead of sliding
- Axis specification
- Different collision behavior

#### func_object
**Original**: `g_func.cpp` SP_func_object
**Priority**: MEDIUM
**Features**:
- Solid bmodel that can fall
- Breaks support detection
- Falls with physics
- Can be shot/destroyed

#### func_timer
**Original**: `g_func.cpp` SP_func_timer
**Priority**: MEDIUM - Critical for scripting
**Features**:
- Periodically fires targets
- Random interval option
- Delay and wait times
- Can be toggled on/off

---

### KEX Engine Entities (Nightdive Rerelease)

#### func_eye
**Original**: KEX additions
**Priority**: LOW - N64 port features
**Features**:
- N64-style camera eye
- Cutscene camera control
- Player view override

#### func_animation
**Original**: KEX additions
**Priority**: LOW
**Features**:
- Toggleable animation states
- bmodel animation control
- Sequence management

#### target_camera / camera path system
**Original**: KEX additions
**Priority**: LOW - Advanced cinematics
**Features**:
- Camera path following
- Cutscene cameras
- Smooth interpolation
- Player control override

#### target_poi (Point of Interest)
**Original**: KEX additions
**Priority**: LOW
**Features**:
- Navigation markers
- Auto-marker system
- Compass integration

#### target_achievement
**Original**: KEX additions
**Priority**: LOW - Platform specific
**Features**:
- Steam achievement integration
- Award triggers
- Progress tracking

#### target_autosave
**Original**: KEX additions
**Priority**: MEDIUM - QoL feature
**Features**:
- Automatic save triggers
- Checkpoint system
- Save slot management

#### target_music
**Original**: KEX additions
**Priority**: MEDIUM
**Features**:
- Changes music track
- Fade in/out
- Track queuing

#### target_healthbar
**Original**: KEX additions
**Priority**: MEDIUM - Boss fights
**Features**:
- On-screen boss health bar
- Name display
- Progress tracking

#### target_story
**Original**: KEX additions
**Priority**: LOW
**Features**:
- Story text display
- Lore entries
- Readable notes

---

### Target Entities (Scripting)

#### target_spawner
**Original**: `g_target.cpp` SP_target_spawner
**Priority**: MEDIUM
**Features**:
- Spawns entities at runtime
- Gib spawning
- Dynamic enemy placement
- Monster closets

#### target_blaster
**Original**: `g_target.cpp` SP_target_blaster
**Priority**: MEDIUM - Used in many maps
**Features**:
- Fires blaster bolts at target
- Automated turret
- Damage dealing
- Visual effects

#### target_laser
**Original**: `g_target.cpp` SP_target_laser
**Priority**: MEDIUM
**Features**:
- Laser beam trap
- Constant damage
- Visual beam
- On/off toggle

#### target_actor
**Original**: `g_target.cpp` SP_target_actor
**Priority**: LOW
**Features**:
- Controls monster_actor
- Scripted behavior
- Path following

#### target_crosslevel_trigger / target_crosslevel_target
**Original**: `g_target.cpp`
**Priority**: HIGH - Required for unit progression
**Features**:
- Sets flags for next level in unit
- Allows persistent state across level changes
- Critical for campaign progression

#### target_earthquake
**Original**: `g_target.cpp` SP_target_earthquake
**Priority**: LOW - Special effect
**Features**:
- Screen shake effect
- Earthquake rumble
- Duration and intensity control

#### target_lightramp
**Original**: `g_target.cpp` SP_target_lightramp
**Priority**: LOW
**Features**:
- Animated light ramping up/down
- Smooth transitions
- Pattern control

---

### Trigger Entities

#### trigger_flashlight
**Original**: KEX addition
**Priority**: LOW - KEX feature
**Features**:
- Controls flashlight toggle
- Required for flashlight system
- Zone-based control

#### trigger_fog
**Original**: KEX addition
**Priority**: MEDIUM - Visual feature
**Features**:
- Changes fog parameters
- Blend/transition time
- Distance and color control

#### trigger_coop_relay
**Original**: KEX addition
**Priority**: LOW - Coop only
**Features**:
- Fires when all coop players in bounds
- Required for coop puzzles
- Player tracking

#### trigger_health_relay
**Original**: KEX addition
**Priority**: LOW
**Features**:
- Fires based on player health
- Conditional triggers
- Health threshold

---

### Misc Entities

#### misc_viper / misc_viper_bomb / misc_viper_missile
**Original**: `g_misc.cpp`
**Priority**: MEDIUM - Boss fight entities
**Features**:
- Viper ship boss components
- Automated boss behavior
- Missile spawning
- Destruction sequence

#### misc_strogg_ship
**Original**: `g_misc.cpp`
**Priority**: LOW - Decorative
**Features**:
- Strogg dropship model
- Animated
- Sound effects

#### misc_satellite_dish
**Original**: `g_misc.cpp`
**Priority**: LOW - Decorative
**Features**:
- Animated satellite dish
- Rotation
- Sound effects

---

## 4. MISSING GAME SYSTEMS

### Weapon Animation System
**Original**: `p_weapon.cpp` `Weapon_Generic` and `Weapon_Repeating`
**Status**: Completely missing from plan
**Priority**: HIGH

**Features**:
- Weapon state machine (ACTIVATING, READY, FIRING, DROPPING)
- Animation frame sequences (activate, fire, idle, deactivate)
- Pause frames for idle animations
- Fire frames (when bullet actually fires)
- Weapon switching animations
- Auto-switch on empty
- Instant weapon switch option

**Implementation Required**:
- [ ] Weapon state enum
- [ ] Frame sequence system
- [ ] Weapon raise/lower animations
- [ ] Idle animation with pause frames
- [ ] Fire frame callbacks
- [ ] Weapon switch controller

---

### Player Animation System
**Original**: `p_client.cpp` and `p_view.cpp`
**Status**: Missing from plan
**Priority**: MEDIUM

**Features**:
- Body animations sync'd to actions
- Running: FRAME_run1-6
- Standing attack: FRAME_attack1-8
- Crouching attack: FRAME_crattak1-9
- Pain animations: FRAME_pain1-4
- Death animations: FRAME_death1-6

---

### Gibbing System Enhancements
**Original**: `g_misc.cpp` ThrowGib functions
**Status**: Basic gibs exist but incomplete
**Priority**: LOW

**Missing**:
- Specific gib models per body part
- Gib type selection (head, arm, leg, torso)
- Proper gib velocity/spin
- Gib health (gibs can be shot)
- Burn gibs (for fire deaths)
- Mechanical gibs (for robots)

---

### Monster Sound System
**Original**: Comprehensive sound system in all m_*.cpp files
**Status**: Basic sounds exist but incomplete
**Priority**: MEDIUM

**Missing**:
- Cached sound indices (performance optimization)
- Channel management (CHAN_VOICE, CHAN_WEAPON, CHAN_BODY)
- Attenuation types (ATTN_NORM, ATTN_IDLE, ATTN_STATIC)
- Frame-specific sound triggers
- Footstep sounds on animation frames
- Weapon spin-up/down sounds
- Ambient idle sounds with random intervals

---

### Blindfire System (Advanced AI)
**Original**: `g_ai.cpp` and monster implementations (Tank, etc.)
**Status**: Not in plan
**Priority**: LOW - Advanced feature

**Features**:
- AI_MANUAL_STEERING flag
- Blind fire target tracking
- M_AdjustBlindfireTarget
- Shooting around corners
- Suppressive fire without line of sight

---

### Monster Reinforcement System
**Original**: Medic Commander (m_medic.cpp)
**Status**: Not in plan
**Priority**: MEDIUM

**Features**:
- Medic Commander variant (600 HP)
- Spawns reinforcement monsters
- Reinforcement call animation
- Monster type selection
- Cooldown system

---

### Heat-Seeking Missile System
**Original**: `monster_fire_heat` in g_weapon.cpp
**Status**: Not in plan
**Priority**: LOW

**Features**:
- Projectiles that track targets
- Target acquisition
- Turn rate limiting
- Loss of lock conditions
- Used by Tank Commander, Supertank

---

### Difficulty Scaling System
**Original**: Throughout all monster/weapon files
**Status**: Basic difficulty exists but incomplete
**Priority**: MEDIUM

**Missing**:
- Monster health scaling per difficulty
- Monster damage scaling
- Monster accuracy adjustments
- AI reaction time changes
- Pain suppression on nightmare
- Spawn filtering by difficulty flags

---

### Flashlight System
**Original**: KEX addition
**Status**: Not in plan
**Priority**: LOW - KEX feature

**Features**:
- Toggleable flashlight
- Battery/unlimited modes
- Dynamic light attached to view
- trigger_flashlight control

---

## 5. MISSION PACK CONTENT SUMMARY

### Ground Zero (Rogue) - Completely Missing
**Priority**: LOW - Expansion content

- **Weapons**: 6 new weapons (Plasma Beam, Ion Ripper, ETF Rifle, Phalanx, Prox, Chainfist)
- **Monsters**: ~8 new monsters (Carrier, Widow, Stalker, etc.)
- **Items**: Several new powerups and items
- **Entities**: Rogue-specific func/trigger/target entities
- **Total Content**: ~30% additional game content

### The Reckoning (Xatrix) - Completely Missing
**Priority**: LOW - Expansion content

- **Weapons**: Trap weapon
- **Monsters**: Gekk, Fixbot, etc.
- **Items**: Xatrix-specific items
- **Entities**: Xatrix-specific entities
- **Total Content**: ~20% additional game content

---

## 6. IMPLEMENTATION PRIORITY MATRIX

### Priority 1 (Must Have for Complete Base Game):
1. Hand Grenade weapon
2. Weapon animation system
3. monster_insane
4. monster_actor
5. func_door_secret
6. func_door_rotating
7. target_crosslevel_trigger/target (campaign progression)
8. target_blaster
9. target_spawner
10. Difficulty scaling system

### Priority 2 (Highly Visible Features):
1. Boss variants (boss31, boss32)
2. Monster sound system enhancements
3. Gibbing system enhancements
4. Player animation system
5. func_timer (scripting)
6. target_music, target_autosave (KEX QoL)
7. target_healthbar (boss fights)

### Priority 3 (Nice to Have):
1. Blindfire system
2. Monster reinforcement system
3. Heat-seeking missiles
4. Advanced entity types (earthquake, lightramp)
5. KEX camera system

### Priority 4 (Expansion Content):
1. All Rogue mission pack content
2. All Xatrix mission pack content
3. Ground Zero unique features
4. Flashlight system

---

## Integration Recommendations

### New Section Proposal: Section 20 - Mission Pack Support
Create dedicated section for:
- Mission pack weapons
- Mission pack monsters
- Mission pack items
- Mission pack entities
- Mission pack maps

### Extend Existing Sections:
- **Section 4**: Add missing entity types (func_*, trigger_*, target_*, misc_*)
- **Section 5**: Add hand grenade, weapon animation system
- **Section 6**: Add missing base game monsters, sound system, AI features
- **Section 8**: Add player animation system

---

## Testing Requirements

### New Entity Tests:
- Load maps using each missing entity type
- Verify entity spawns and behaves correctly
- Test all spawnflags and properties

### Weapon Tests:
- Hand grenade cook timing
- Weapon switching animations
- Mission pack weapon mechanics

### Monster Tests:
- AI behavior verification
- Sound playback
- Difficulty scaling

### Campaign Tests:
- Crosslevel triggers work across levels
- Difficulty modes feel correct
- All scripting entities functional

---

## Notes
- Mission pack content is ~35-40% of total Q2 content
- KEX features add ~10% more content
- Some features (like blindfire, reinforcements) are complex AI enhancements
- Priority should focus on base game completeness first
- Hand grenade and weapon animations are glaring omissions
- Many missing entities are used in base campaign maps

---

## Success Criteria
- [ ] All base game monsters implemented
- [ ] All base game weapons implemented (including hand grenade)
- [ ] All entity types used in base campaign maps work
- [ ] Weapon animation system functional
- [ ] Campaign progression works (crosslevel triggers)
- [ ] Difficulty scaling present
- [ ] All scripting entities for base maps work
- [ ] Mission pack content documented and scoped (implementation optional)
