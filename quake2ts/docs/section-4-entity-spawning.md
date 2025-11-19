# Section 4: Entity System & Spawning

## Overview
This section covers the entity system that forms the backbone of Quake II gameplay: entity data structures, lifecycle management, the spawn registry that maps classnames to factory functions, world/entity spawning from BSP data, and the core entity subsystems (thinking, touching, trigger logic). This provides the foundation for all game objects: players, monsters, items, doors, triggers, and decorative elements.

## Dependencies
- **Asset Loading (Section 1)**: REQUIRED - needs BSP entity lump parsing, model/sound indices
- **Physics System (Section 3)**: Partial - can develop with stub traces initially, full integration needed later
- **Game loop/frame system**: Requires GameFrameLoop and stage registration - **COMPLETED**
- **Shared package**: Requires vec3 math, deterministic RNG - **COMPLETED**

## Work Already Done
- ✅ GameFrameLoop with prep/sim/post stages (`packages/game/src/loop.ts`)
- ✅ LevelClock for frame timing (`packages/game/src/level.ts`)
- ✅ Deterministic RNG (MersenneTwister, frandom/crandom/irandom) in shared package
- ✅ Vec3 math and bounding box helpers

## Tasks Remaining

### Entity Data Structure
- [ ] Define core Entity type/class
  - **Transform**: origin, angles, velocity, avelocity
  - **Physics**: mins, maxs, mass, gravity, movetype (MOVETYPE_NONE, STEP, PUSH, STOP, WALK, TOSS, BOUNCE, FLY, FLYMISSILE)
  - **Render**: modelindex, frame, skin, effects, renderfx
  - **Gameplay**: health, max_health, takedamage, dmg, deadflag
  - **AI**: enemy, movetarget, goalentity, ideal_yaw, yaw_speed
  - **Movement**: groundentity, groundentity_linkcount, waterlevel, watertype
  - **Scripting**: classname, targetname, target, team, message
  - **Timing**: nextthink, thinkfunc, touch, use, pain, die callbacks
  - **Flags**: solid (SOLID_NOT, TRIGGER, BBOX, BSP), flags, svflags, spawnflags
  - **Entity linking**: linked list for entity iteration, area links for spatial queries
- [ ] Entity field serialization metadata
  - Mark which fields save/load (see Section 9)
  - Field types for JSON serialization
- [ ] Entity memory pool/allocator
  - Fixed-size array (2048 max entities, matching rerelease MAX_EDICTS)
  - Free list for efficient alloc/dealloc
  - Entity slot recycling

### Entity Lifecycle
- [ ] Spawn entity (`G_Spawn`)
  - Allocate from entity pool
  - Initialize default values
  - Return entity reference
- [ ] Free entity (`G_FreeEntity`)
  - Unlink from world
  - Clear callbacks
  - Return to free list
  - Delay actual free until end of frame (prevent use-after-free)
- [ ] Think scheduling
  - Set `nextthink` timestamp
  - Register entity in think queue
  - Execute think callbacks at scheduled time
  - Sort by nextthink for efficient processing
- [ ] Touch detection
  - When entities overlap (via trace), call touch callbacks
  - Handle trigger volumes
  - Pickup items, teleporters, hurt triggers

### Spawn Registry
- [ ] Build spawn function registry (mirrors `g_spawn.cpp`)
  - Map classname string -> spawn function
  - ~200 spawn functions for all entity types
- [ ] Core spawns (worldspawn, info_* entities)
  - `SP_worldspawn`: Parse world settings, set cvars, precache assets
  - `SP_info_player_start`, `SP_info_player_deathmatch`: Player spawn points
  - `SP_info_player_coop`: Coop spawn points (defer for base SP)
  - `SP_info_null`: No-op (removed entities)
- [ ] Trigger spawns (trigger_* entities)
  - `SP_trigger_multiple`, `SP_trigger_once`: Generic triggers
  - `SP_trigger_relay`: Relay target events
  - `SP_trigger_push`: Jump pads, wind tunnels
  - `SP_trigger_hurt`: Damage zones (lava, slime)
  - `SP_trigger_teleport`: Teleport destinations
  - `SP_trigger_gravity`: Gravity modifiers
  - `SP_trigger_monsterjump`: Monster navigation hints
  - Others: `trigger_always`, `trigger_counter`, `trigger_key`, `trigger_elevator`
- [ ] Target spawns (target_* entities)
  - `SP_target_temp_entity`: Spawn temporary effects
  - `SP_target_speaker`: Ambient sounds
  - `SP_target_explosion`, `SP_target_splash`: Effects on trigger
  - `SP_target_secret`, `SP_target_goal`: Level objectives
  - `SP_target_changelevel`: Level transitions
  - `SP_target_string`, `SP_target_character`: On-screen messages
  - Others: Many target types for scripted sequences
- [ ] Misc spawns (misc_* decorative/functional)
  - `SP_misc_teleporter`, `SP_misc_teleporter_dest`
  - `SP_misc_explobox`, `SP_misc_banner`: Decorative items
  - `SP_misc_deadsoldier`, `SP_misc_gib_*`: Dead bodies, gibs
- [ ] Item spawns (item_*, ammo_*, weapon_*)
  - See Section 5 for details; stub here initially
- [ ] Monster spawns (monster_*)
  - See Section 6 for details; stub here initially
- [ ] Func spawns (func_* brush entities)
  - `SP_func_wall`: Static geometry
  - `SP_func_door`, `SP_func_door_rotating`, `SP_func_door_secret`: Doors
  - `SP_func_button`: Buttons
  - `SP_func_train`: Moving platforms
  - `SP_func_plat`, `SP_func_plat2`: Elevators
  - `SP_func_rotating`: Fans, gears
  - `SP_func_conveyor`: Conveyor belts (affects movement)
  - `SP_func_water`, `SP_func_areaportal`: Special brushes
  - `SP_func_explosive`, `SP_func_killbox`: Damage/kill volumes
  - And many more (see `g_spawn.cpp` for full list)
- [ ] Light spawns (light, light_mine1, light_mine2)
  - Parse light properties
  - Store for dynamic lighting (Section 2)
  - Static lights already in BSP lightmaps
- [ ] Path spawns (path_corner)
  - Waypoints for `func_train` and monster patrol paths
  - Link together by targetname

### BSP Entity Parsing & Level Spawn
- [ ] Parse BSP entity lump
  - Extract entity string from BSP (text format, Quake key-value pairs)
  - Tokenize into entity dictionaries
  - First entity is always worldspawn
- [ ] Spawn entities from BSP (`G_SpawnEntities`)
  - Iterate entity dictionaries
  - Look up spawn function by classname
  - Call spawn function with key-value pairs
  - Handle unknown classnames gracefully (warn, skip)
- [ ] Apply entity key-values
  - Set origin, angles, model, target, targetname, etc.
  - Parse spawnflags (bitfield)
  - Convert string values to appropriate types (int, float, vec3)
- [ ] Link entities into world
  - Add to entity list
  - For solid entities, link into BSP spatial areas
  - Build target->entity lookup table for scripting

### Entity Thinking & Update Loop
- [ ] Integrate with GameFrameLoop
  - Register think/touch systems with sim stage
  - Process entities every frame (40Hz)
- [ ] Think system
  - Maintain think queue (priority queue by nextthink time)
  - Execute think functions for entities whose time has come
  - Reschedule if nextthink updated
- [ ] Physics movement
  - Apply velocity to origin (simple integration)
  - Handle different movetypes:
    - MOVETYPE_NONE: Static, no movement
    - MOVETYPE_WALK: Player/monster, uses pmove or AI movement
    - MOVETYPE_STEP: Monster stepping (deprecated, use WALK)
    - MOVETYPE_TOSS: Gravity + bouncing (items, gibs)
    - MOVETYPE_BOUNCE: Higher bounce (grenades)
    - MOVETYPE_FLY: No gravity, flies straight (rockets)
    - MOVETYPE_FLYMISSILE: Fly with clipping
    - MOVETYPE_PUSH: Doors, platforms (push other entities)
  - For each movetype, trace and resolve collisions (requires Section 3)
- [ ] Touch detection
  - After movement, check for entity overlaps
  - Call touch callbacks on both entities
  - Handle pickup, trigger, damage logic

### Entity Scripting & Targeting
- [ ] Target resolution
  - Build targetname -> entity map during spawn
  - `G_Find` functions: find by classname, targetname, etc.
- [ ] Use activation (`G_UseTargets`)
  - When entity is triggered, activate all entities with matching targetname
  - Call their `use` callback
  - Handle killtarget (remove target entity)
  - Delay support (trigger after N seconds)
- [ ] Multi-target support
  - One entity can target multiple others (comma-separated or repeated triggers)
- [ ] Trigger conditions
  - Some triggers require keys, specific conditions
  - Counter triggers (activate after N triggers)

### Entity State for Rendering/Audio
- [ ] Update render state
  - Set modelindex, frame, skin based on entity state
  - Set effects flags (muzzle flash, teleport, etc.)
  - Set renderfx (glow, IR goggles, etc.)
- [ ] Emit sounds
  - Call engine sound API (Section 7) for entity sounds
  - Positioned at entity origin
  - Attenuation based on distance
- [ ] Emit temporary effects
  - Particles (Section 2)
  - Lights (Section 2)
  - Screen blends (Section 8)

### Special Entity Types (Functional Implementation)
- [ ] **Worldspawn**
  - Parse world keys (message, sky, skyrotate, skyaxis, etc.)
  - Set global level state
  - Precache common assets
- [ ] **func_door** (example of complex func_ entity)
  - Parse movement direction, speed, wait time, sounds
  - Think function: move to open position, wait, close
  - Use function: trigger open/close
  - Blocked function: reverse or crush
  - Link pusher logic to move other entities with door (requires Section 3)
- [ ] **func_button**
  - Use function: move in, wait, move out
  - Trigger targets when pressed
  - Sounds, speed, wait time
- [ ] **func_train**
  - Follow path_corner waypoints
  - Constant movement
  - Push entities riding on it
- [ ] **trigger_multiple / trigger_once**
  - Wait for entity to enter (via touch)
  - Trigger targets
  - Multiple: can trigger repeatedly; Once: trigger then remove
  - Delay, sounds
- [ ] **trigger_teleport**
  - Touch: teleport entity to destination
  - Find matching `misc_teleporter_dest`
  - Preserve velocity or zero it (based on flags)

### Entity Utility Functions
- [ ] `G_SetMovedir`: Calculate move direction from angles
- [ ] `G_TouchTriggers`: Check if entity is touching any triggers
- [ ] `G_PickTarget`: Choose random entity matching targetname (for randomization)
- [ ] `KillBox`: Kill any entities at spawn position (prevent stuck spawns)
- [ ] `VelocityForDamage`: Calculate knockback velocity
- [ ] `ClipVelocity`: Reflect velocity off plane (uses shared helper)

## Integration Points
- **From Asset Loading (Section 1)**: Receives BSP entity lump, model/sound indices
- **From Physics (Section 3)**: Uses trace/pointcontents for movement and touch detection
- **To Combat (Section 5)**: Provides entity structure for damage, items, weapons
- **To AI (Section 6)**: Provides entity structure for monster behaviors
- **To Audio (Section 7)**: Requests positioned sounds
- **To Rendering (Section 2)**: Provides entity render state (model, frame, position)
- **To Save/Load (Section 9)**: Serializes entity state

## Testing Requirements

### Unit Tests (Standard)
- Entity allocation and freeing
- Think queue scheduling and execution
- Target resolution and use activation
- Entity key-value parsing
- Spawn registry lookup

### Integration Tests
- **Full level spawn**: Load BSP entity lump, spawn all entities, verify counts and types
- **Entity lifecycle**: Spawn, think, die, free; verify no leaks
- **Trigger activation**: Walk into trigger, verify target entities activate
- **Door functionality**: Trigger door, verify open/close cycle
- **Button functionality**: Use button, verify it moves and triggers targets
- **Teleporter**: Walk into teleporter trigger, verify player moves to destination
- **Item pickup**: Walk over item, verify touch callback and item removal
- **Monster spawn**: Spawn monster, verify AI initialization (see Section 6)

### Performance Tests
- **Entity count scaling**: Spawn 1000+ entities, measure frame time impact
- **Think queue performance**: Schedule 100+ entities with same nextthink
- **Touch detection**: Many overlapping entities, verify performance
- **Spawn time**: Time to spawn all entities in large map (e.g., boss3.bsp)

### Edge Case Tests
- **Missing spawn function**: Entity with unknown classname
- **Invalid key-values**: Malformed entity data
- **Circular targets**: Entity A targets B, B targets A
- **Entity limit**: Try to spawn >2048 entities
- **Instant think**: Set nextthink to current time or past

## Notes
- Entity system is central to game logic; get this right first
- Spawn registry is large (~200 functions); prioritize common entities, stub rare ones
- Many entities are purely decorative (misc_banner, etc.); these are low priority
- Func entities (doors, platforms) are complex; start with simple ones (func_wall)
- Trigger logic is tricky with delays, counters, and conditions
- Think callbacks can modify entity state, reschedule, or free the entity; handle reentrancy carefully
- Entity linking for spatial queries is important for large maps (but can defer optimization)
- Some entities precache assets during spawn; ensure asset registry is available (Section 1)
- Rerelease source reference: `g_spawn.cpp`, `g_func.cpp`, `g_trigger.cpp`, `g_target.cpp`, `g_misc.cpp`, `g_utils.cpp`
- Entities must support save/load; design serialization-friendly structures from the start
