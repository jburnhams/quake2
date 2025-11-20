# Section 5: Combat, Weapons & Items

## Overview
This section covers the combat system (damage, knockback, weapon firing), inventory management, and all item types (weapons, ammo, health, armor, powerups, keys). It implements the core gameplay loop: picking up items, selecting weapons, firing at enemies, taking damage, and managing resources. This section brings the game to life by making entities interactive and dangerous.

## Dependencies
- **Entity System (Section 4)**: REQUIRED - needs entity structure, touch callbacks, spawn registry
- **Physics System (Section 3)**: REQUIRED - needs trace for weapon fire, damage radius checks
- **Asset Loading (Section 1)**: Needs model/sound indices for item/weapon assets
- **Audio (Section 7)**: Partial - can stub sounds initially, full integration for weapon/impact sounds
- **Rendering (Section 2)**: Partial - needs effects (muzzle flash, particles), can stub initially

## Work Already Done
- ✅ Entity structure (from Section 4 when complete)
- ✅ Deterministic RNG for spread/damage variance
- ✅ Vec3 math for damage direction, knockback
- ✅ Trace system (from Section 3 when complete)

## Tasks Remaining

### Damage System
- [x] Core damage function (`T_Damage`)
  - **Signature**: `T_Damage(target: Entity, inflictor: Entity, attacker: Entity, dir: vec3, point: vec3, normal: vec3, damage: number, knockback: number, dflags: number, mod: number)`
  - Check if target can take damage (`takedamage` field)
  - Apply damage to health
  - Apply knockback velocity (based on dir, damage, mass)
  - Trigger pain callback (`target.pain()`)
  - Trigger die callback if health <= 0 (`target.die()`)
  - Record attacker for kill tracking
  - Handle damage flags (no protection, no knockback, bullet, etc.)
- [x] Radius damage (`T_RadiusDamage`)
  - For explosions (rockets, grenades, barrels)
  - Find all entities within radius
  - Trace line-of-sight to each (blocked by walls = reduced damage)
  - Calculate damage falloff by distance
  - Apply damage with outward knockback direction
  - Verified radius limits and bounding-box-aware distance checks against rerelease behavior with regression tests
- [x] Armor system
  - Reduce damage based on armor value and type
  - Different armor types: jacket (light), combat (medium), body (heavy)
  - Armor absorbs percentage of damage, remainder goes to health
  - Deplete armor based on damage absorbed
  - Implemented parity-checked armor absorption helpers (`applyRegularArmor`, `applyPowerArmor`) with Vitest coverage mirroring rerelease `CheckArmor`/`CheckPowerArmor` rules.
- [x] Damage modifiers
  - Means of death (MOD_*): blaster, shotgun, rocket, falling, lava, etc.
  - Used for obituary messages ("Player was blasted by Monster")
  - Some entities immune to certain damage types
- [x] Special damage types
- Verified environmental and situational damage parity with rerelease math (drowning escalation cap, water exit/reset, slime/lava immunity flags) via new regression tests.
- [x] Falling damage (based on fall velocity and bypasses armor like rerelease)
  - [x] Drowning (when underwater too long, no air)
  - [x] Slime/lava damage (periodic damage in liquid)
  - [x] Crush damage (from doors, platforms)
  - [x] Telefrag (telefrag target if telefrag position occupied)

### Weapon System
- [ ] Weapon definitions
  - **All base campaign weapons:**
    - Blaster (infinite ammo, weak)
    - Shotgun (shells)
    - Super Shotgun (2 shells, double damage)
    - Machinegun (bullets)
    - Chaingun (bullets, rapid fire)
    - Grenade Launcher (grenades, bouncing projectiles)
    - Rocket Launcher (rockets, explosive)
    - HyperBlaster (cells, rapid energy)
    - Railgun (slugs, instant hit, penetrating)
    - BFG10K (cells, massive blast)
  - For each weapon: damage, ammo type, ammo per shot, fire rate, projectile speed, spread
- [ ] Weapon state machine
  - Idle, firing, reloading (Quake II has no reload, but has fire rate limiting)
  - Track last fire time, prevent rapid fire beyond weapon rate
  - Weapon switching delay
- [ ] Weapon firing (`weapon_fire` functions)
  - Check ammo, deduct ammo
  - Instant hit (blaster, shotgun, machinegun, railgun): trace from player, apply damage to hit entity
  - Projectile (grenades, rockets, BFG): spawn projectile entity with velocity
  - Apply weapon spread (random angle deviation for machinegun, shotgun pellets)
  - Apply weapon kick (view angle recoil)
  - Play fire sound, show muzzle flash effect
  - Set animation frame (weapon model on screen)
- [ ] Projectile entities
  - **Grenade**: Bouncing physics, timer-based explosion, can be shot mid-air
  - **Rocket**: Flies straight, explodes on impact
  - **BFG ball**: Slow moving, massive explosion, secondary laser damage
  - Each projectile: think function (move, check collision, explode)
- [ ] Weapon switching
  - Player selects new weapon (via input)
  - Check if weapon is owned, has ammo
  - Animate weapon down, switch, animate up
  - Track current weapon in player state
- [ ] Weapon pickup
  - Touch weapon entity
  - Add to inventory, give initial ammo
  - If already owned, just give ammo
  - Play pickup sound

### Item System
- [ ] Item definitions (item_t structure)
  - Classname, pickup name (displayed on HUD)
  - Model, world model, view model
  - Icon (for HUD)
  - Pickup sound
  - Quantity (ammo amount, health amount)
  - Flags (droppable, weapon, ammo, powerup, etc.)
- [ ] Item spawn (`SP_item_*` functions)
  - Place item in world at origin
  - Set bounding box (SOLID_TRIGGER)
  - Set model (rotating pickup model)
  - Bobbing animation (items hover and rotate)
  - Set touch callback for pickup
- [ ] Item pickup (`Pickup_*` functions)
  - Check if player can pick up (inventory not full, doesn't already have, etc.)
  - Add to inventory
  - Apply item effect (restore health, give ammo, add weapon)
  - Play pickup sound
  - Show pickup message on HUD ("You got the Shotgun")
  - Remove item from world or set respawn timer (deathmatch)
- [ ] Item respawn (for deathmatch, not needed for single-player initially)
  - After pickup, set respawn timer
  - Respawn item after delay
  - Respawn effect (particles, sound)

### Ammo & Ammo Pickups
- [x] Ammo types
  - Shells (shotgun, super shotgun)
  - Bullets (machinegun, chaingun)
  - Grenades (grenade launcher)
  - Rockets (rocket launcher)
  - Cells (hyperblaster, BFG)
  - Slugs (railgun)
- [x] Ammo pickup entities
  - `item_ammo_shells`, `item_ammo_bullets`, etc.
  - Small and large ammo packs
  - Touch callback: add ammo to inventory
- [x] Ammo limits
  - Max ammo per type (e.g., 100 shells, 200 bullets)
  - Backpack item doubles ammo limits (optional, CTF/DM)
  - Mirrored rerelease base caps (50 default, 200 bullets/cells, 100 shells) with parity tests.
  - Added ammo item definitions (quantities + ammo mapping) and pickup helpers that clamp to rerelease caps with Vitest coverage mirroring `G_AddAmmoAndCap`/`Pickup_Ammo`.

### Health & Armor Pickups
- [ ] Health items
  - Small health (+2), medium health (+10), large health (+25)
  - Mega health (+100, over max health, decays over time)
  - Stimpack, medkit
- [ ] Armor items
  - Jacket Armor (+25, 30% absorption)
  - Combat Armor (+50, 60% absorption)
  - Body Armor (+100, 80% absorption)
  - Armor shards (+2, common in DM)
- [ ] Pickup logic
  - Restore health/armor
  - Cannot pick up if already at max (unless mega health)
  - Play pickup sound, show message

### Powerups
- [ ] Quad Damage
  - 4x damage multiplier for 30 seconds
  - Damage sound while active
  - Glowing effect on player
- [ ] Invulnerability
  - No damage taken for 30 seconds
  - Glowing green effect
- [ ] Enviro Suit
  - Breathe underwater, immune to slime/lava for 30 seconds
- [ ] Rebreather
  - Breathe underwater for 30 seconds (no lava protection)
- [ ] Silencer
  - Enemies don't hear your weapon fire
- [ ] Power Screen, Power Shield (advanced, defer)
- [ ] Powerup timing
  - Countdown timer
  - Warning when about to expire
  - Expire effect (sound, screen flash)

### Keys
- [ ] Key items (for locked doors)
  - Key colors: blue, red, green, yellow, etc.
  - Add to key inventory
  - Check key in door logic (Section 4)
- [ ] Key pickup
  - Touch key entity
  - Add to key ring
  - Play sound, show message

### Inventory Management
- [x] Player inventory structure
  - Current weapon
  - Owned weapons (bitmask or array)
  - Ammo counts per type
  - Armor value and type
  - Powerup flags and timers
  - Keys
- [x] Inventory functions
  - Add item
  - Remove item
  - Check if item present
  - Get ammo count
  - Set ammo count
  - Added player inventory helpers for ammo, weapons, armor clamping, powerup timers, and key tracking with parity tests for rerelease limits/selection rules.

### Weapon Ballistics & Spread
- [ ] Instant hit traces
  - Trace from player eye position along aim direction
  - Apply spread (random angle deviation)
  - Multiple traces for shotgun pellets (12 pellets)
  - Railgun penetration: keep tracing through entities
- [ ] Projectile ballistics
  - Spawn projectile at weapon muzzle position
  - Initial velocity based on player velocity + projectile speed
  - Gravity for grenades (arcing trajectory)
  - No gravity for rockets (straight flight)
- [ ] Hit detection
  - Check trace result
  - Apply damage to hit entity
  - Spawn impact effect (sparks, blood, bullet holes)
  - Play impact sound

### Combat Effects
- [ ] Muzzle flash
  - Temporary light at weapon position
  - Particle effect
  - Duration: 1-2 frames
- [ ] Impact effects
  - Bullet impacts: sparks, dust puff
  - Blood splatter: red particles, decals (optional)
  - Explosion effects: fire, smoke, shockwave
- [ ] Tracer rounds (optional, for machinegun/chaingun)
  - Draw line from muzzle to impact
  - Fades quickly
- [ ] Gibs (gore)
  - When entity takes massive damage, spawn gibs
  - Giblets (small chunks) vs. full gibs (head, limbs)
  - Gibs are physics entities (MOVETYPE_TOSS), bounce and slide

### Special Weapon Logic
- [ ] **Shotgun**: 12 pellets, spread pattern
- [ ] **Super Shotgun**: 20 pellets, wider spread, longer reload
- [ ] **Chaingun**: Spin-up delay, very fast fire rate when spinning
- [ ] **Grenade Launcher**: Grenades bounce, detonate on timer or impact (based on mode)
- [ ] **Rocket Launcher**: Rocket splash damage, self-damage possible (rocket jumping)
- [ ] **Railgun**: Instant hit, penetrates entities, distinct trail effect
- [ ] **BFG**: Primary blast, plus secondary beams to all entities in view (complex)
- [ ] **Blaster**: Weak projectile, infinite ammo, last resort weapon

### Death & Respawn
- [ ] Player death
  - Trigger die callback
  - Drop weapon (optional, DM only)
  - Set deadflag, stop movement
  - Death animation
  - Respawn timer (or level end in SP)
- [ ] Monster death
  - Trigger die callback
  - Death animation
  - Become non-solid (SOLID_NOT)
  - Drop items (ammo, health, weapons - rare)
  - Gib if massive damage
  - Sink into ground after delay (optional cleanup)

### Obituaries (Messages)
- [ ] Generate death messages
  - "Player killed Monster with Shotgun"
  - "Monster killed Player"
  - "Player died" (falling, drowning, etc.)
  - Uses means-of-death (MOD_*) codes

## Integration Points
- **From Entity System (Section 4)**: Uses entity structure, touch callbacks
- **From Physics (Section 3)**: Uses trace for hit detection, radius checks
- **To Audio (Section 7)**: Plays weapon fire, impact, pickup sounds
- **To Rendering (Section 2)**: Spawns particles, lights, effects
- **To HUD (Section 8)**: Updates ammo, health, armor displays; shows pickup messages
- **From AI (Section 6)**: Monsters use weapon/damage system to attack player

## Testing Requirements

### Unit Tests (Standard)
- Damage calculation with armor
- Knockback vector calculation
- Ammo deduction
- Item pickup logic (inventory full, already owned, etc.)
- Weapon spread angle calculation

### Integration Tests
- **Weapon firing**: Fire each weapon type, verify damage, ammo deduction, effects
- **Item pickup**: Pick up health, armor, ammo, weapons; verify inventory updates
- **Damage & death**: Damage player/monster to death, verify die callback, respawn
- **Radius damage**: Rocket explosion, verify multiple entities damaged, falloff by distance
- **Projectiles**: Fire grenade/rocket, verify flight, collision, explosion
- **Armor absorption**: Take damage with different armor types, verify reduction
- **Powerups**: Pick up quad damage, verify 4x multiplier, verify expiration
- **Key logic**: Pick up key, verify door unlocks (Section 4 integration)

### Performance Tests
- **Shotgun pellets**: 12 traces per shot, verify performance (60 FPS maintained)
- **Explosions**: Large radius damage with many entities
- **Many projectiles**: 50+ active rockets/grenades

### Gameplay Balance Tests
- **Weapon damage values**: Verify match original Quake II
- **Ammo consumption rates**: Verify match original
- **Health/armor pickup amounts**: Verify match original
- **Powerup durations**: 30 seconds for quad/invuln/etc.

## Notes
- Combat is complex; test thoroughly with different weapons and scenarios
- BFG secondary beams are tricky: traces to all entities in view frustum, applies damage based on distance
- Railgun penetration requires continuing trace after first hit
- Self-damage (rocket jumping) is intentional, keep it for faithful gameplay
- Weapon spread/randomness should use deterministic RNG for save/load consistency
- Obituary messages require tracking last attacker and means of death
- Some weapons have alternate fire modes (grenade timer vs. impact) - may defer for initial release
- Gibs and gore are optional; can simplify for initial release
- Rerelease source reference: `g_combat.cpp`, `g_weapon.cpp`, `g_items.cpp`, `p_weapon.cpp`
- Item respawn is primarily for deathmatch; single-player items don't respawn
- Weapon models have view model (first-person) and world model (third-person); ensure both are loaded
