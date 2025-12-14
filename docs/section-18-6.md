# Section 18.6: CTF Mode

**Priority**: 🔵 LOW

This phase covers Capture The Flag game mode implementation.

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

- [x] Implement red flag entity
  - `SP_item_flag_red(entity: Entity): void`
  - Visual: red flag model
  - Reference: `g_ctf.cpp` lines 50-120

- [x] Implement blue flag entity
  - `SP_item_flag_blue(entity: Entity): void`
  - Visual: blue flag model
  - Reference: `g_ctf.cpp` lines 122-190

- [x] Implement flag physics
  - Can be picked up by players
  - Drops on player death
  - Returns to base after timeout
  - Reference: `g_ctf.cpp` lines 192-300

#### 6.1.2 Flag State Management
**Original Source**: `/rerelease/ctf/g_ctf.cpp` (lines 302-550)
**TypeScript File**: `/packages/game/src/modes/ctf/state.ts` (NEW)

- [x] Implement flag states
  - States: AT_BASE, CARRIED, DROPPED
  - State transitions
  - Reference: `g_ctf.cpp` lines 302-380

- [x] Implement flag pickup logic
  - Team validation (can't pick up own flag)
  - Can pick up enemy flag
  - Can return own flag to base
  - Reference: `g_ctf.cpp` lines 382-480

- [x] Implement flag drop logic
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
