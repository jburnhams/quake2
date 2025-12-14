# Section 18.3: Weapon Systems

**Priority**: 🟡 HIGH

This phase covers weapon alt-fires, effects, and mission pack weapons.

---

## Phase 3: Weapon Systems (🟡 HIGH)

### 3.1 Weapon Alt-Fires

**Priority**: 🟡 HIGH
**Complexity**: MODERATE (30-40 hours)
**Original Source**: `/rerelease/p_weapon.cpp` (1,970+ lines)
**TypeScript File**: `/packages/game/src/combat/weapons/` (various)

#### 3.1.1 Grenade Launcher Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/grenadelauncher.ts`

- [x] Implement timed grenade mode
  - Hold to set timer (1-3 seconds)
  - Explode after timer expires
  - Reference: `p_weapon.cpp` lines 850-950

#### 3.1.2 Rocket Launcher Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/rocketlauncher.ts`

- [x] Implement guided missile mode
  - Laser-guided rocket
  - Follow crosshair aim
  - Reduced speed but perfect accuracy
  - Reference: `p_weapon.cpp` lines 1050-1180

- [x] Implement missile tracking logic
  - Update missile trajectory each frame
  - Steer toward aim point
  - Max turn rate limit
  - Reference: `p_weapon.cpp` lines 1100-1170

#### 3.1.3 Hyperblaster Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/hyperblaster.ts`

- [x] Implement sustained beam mode
  - Hold fire for continuous beam
  - Increased ammo consumption
  - Heat buildup mechanic
  - Reference: `p_weapon.cpp` lines 1280-1380

#### 3.1.4 Chaingun Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/chaingun.ts`

- [x] Implement wind-up mode
  - Hold to spin barrels
  - Instant fire when spun up
  - Faster fire rate when wound
  - Reference: `p_weapon.cpp` lines 680-780

#### 3.1.5 Super Shotgun Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/supershotgun.ts`

- [x] Implement precision mode
  - Tighter pellet spread
  - Reduced damage per pellet
  - Longer range effectiveness
  - Reference: `p_weapon.cpp` lines 480-550

#### 3.1.6 Blaster Alt-Fire
**TypeScript File**: `/packages/game/src/combat/weapons/blaster.ts`

- [x] Implement melee extension
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
- [x] Implement view kick for all weapons
  - Camera angle adjustment on fire
  - Recoil pattern per weapon
  - Recovery over time
  - Reference: `p_weapon.cpp` lines 120-220

- [x] Add kick to PlayerState
  - Store `kick_angles` in player state
  - Apply in view calculation
  - Reference: `p_view.cpp` lines 350-420

#### 3.2.2 Muzzle Flash Positioning
- [x] Implement muzzle flash entities
  - Create temporary light entity on fire
  - Position at weapon muzzle
  - Duration and intensity per weapon
  - Reference: `p_weapon.cpp` lines 50-110

- [x] Add flash offset per weapon model
  - MD3 tag-based positioning (Partial implementation with hooks, focusing on offsets for now)
  - Hardcoded offsets for MD2 (Implemented)
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
