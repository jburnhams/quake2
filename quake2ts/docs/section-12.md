# Section 12: Mission Pack Monsters & Entities

This section focuses on implementing the entities, monsters, and weapons specific to the official mission packs (The Reckoning and Ground Zero). This work builds upon the core AI and combat systems established in earlier sections, extending the entity registry and introducing new behaviors.

**Goal:** Fully implement all monsters, weapons, and items from the mission packs, ensuring they function correctly within the existing game engine and maintain compatibility with the base game.

## Current State & Dependencies
- **Core AI:** The base AI system (states, perception, movement) is functional.
- **Combat System:** Damage, projectiles, and hitscan mechanics are in place.
- **Entity System:** Spawning, thinking, and basic entity management are working.
- **Rendering:** Model and sprite rendering is supported.
- **Audio:** Sound playback is available.

## Task List

### 1. Mission Pack 1 (The Reckoning) Monsters
- [x] **Gekk:** Implement `monster_gekk` (amphibious, leaping attack).
- [x] **Repair Bot:** Implement `monster_repair` (heals other mechanical monsters, laser attack).
- [x] **Beta Class Gladiator:** Implement `monster_gladiator` variants or verify existing supports it. (Mission pack specific behavior/stats).
- [x] **Super Tank:** Implement `monster_supertank` (upgraded tank, more weapons).

### 2. Mission Pack 2 (Ground Zero) Monsters
- [x] **Stalker:** Implement `monster_stalker` (ceiling walking, melee).
- [x] **Turret:** Implement `monster_turret` (wall/floor mounted, various weapon types).
- [ ] **Daedalus:** Implement `monster_daedalus` (hovering, shield, blaster).
- [ ] **Medic Commander:** Implement `monster_medic_commander` (spawns reinforcements, heals).
- [ ] **Carrier:** Implement `monster_carrier` (spawns flyers, grenade launcher).
- [ ] **Black Widow:** Implement `monster_widow` (boss, multiple stages, web attack).

### 3. Mission Pack Weapons & Items
- [ ] **Ion Ripper:** Implement weapon logic and projectile (`weapon_ionripper`).
- [ ] **Phalanx Particle Cannon:** Implement weapon logic and projectile (`weapon_phalanx`).
- [ ] **Trap:** Implement `weapon_trap` (proximity mine).
- [ ] **ETF Rifle:** Implement `weapon_etf_rifle` (flechette projectile).
- [ ] **Plasma Beam:** Implement `weapon_plasmabeam`.
- [ ] **Disruptor:** Implement `weapon_disruptor`.
- [ ] **Chainfist:** Implement `weapon_chainfist` (melee weapon).
- [ ] **Prox Mine:** Implement `weapon_prox` (alternate mine).
- [ ] **Tesla Mine:** Implement `weapon_tesla`.
- [ ] **Double Damage:** Implement `item_doubledamage` (powerup).
- [ ] **IR Goggles:** Implement `item_ir_goggles`.

### 4. Mission Pack Specific Entities
- [ ] **Force Wall:** Implement `func_force_wall`.
- [ ] **Conveyor:** Implement `func_conveyor`.
- [ ] **Light Detect:** Implement `trigger_light`.

## Implementation Details

### Monster AI Extensions
- **Amphibious Movement:** Improve AI navigation to handle seamless transitions between water and land (needed for Gekk).
- **Ceiling Walking:** Implement physics and AI logic for monsters that can walk on ceilings (Stalker).
- **Healer Logic:** Refine AI to prioritize healing allies (Repair Bot, Medic Commander).
- **Spawner Logic:** Implement AI for spawning other monsters (Carrier, Medic Commander).

### Weapon Extensions
- **Beam Weapons:** Implement continuous beam damage and rendering logic (Plasma Beam, Phalanx).
- **Proximity Detection:** Implement trigger logic for mines and traps.

## Testing Requirements
- **Unit Tests:**
    - AI behavior tests for each new monster (e.g., Gekk jumping, Repair Bot healing).
    - Weapon firing and damage tests for new weapons.
    - Item pickup and effect tests.
- **Integration Tests:**
    - Spawn all mission pack monsters in a test map and verify basic behavior.
    - Test weapon interactions with environment and monsters.
    - Verify save/load persistence for new entities.

## Reference Material
- **Source Code:** Refer to `rerelease/xatrix` (Mission Pack 1) and `rerelease/rogue` (Mission Pack 2) source folders.
- **Quake 2 Game Source:** `g_monster.c`, `m_*.c` files in mission pack directories.
