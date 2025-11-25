# Documentation Enhancement Guide

This guide shows the enhanced format for sections 14, 15, and 16 with checkboxes, additional details, relative paths, and quality improvements.

## Key Changes Made:

1. **Relative Paths**: Changed `/home/user/quake2/rerelease/` to `../rerelease/` (relative to project root)
2. **Checkboxes**: Added `- [ ]` to every task and subtask
3. **Source References**: Added specific line numbers and file references
4. **Additional Detail**: Expanded brief tasks with implementation notes
5. **Testing Steps**: Made testing requirements specific and measurable
6. **For Section 16**: Added examples of bad comments and code needing documentation

## Example Enhanced Format

### Before (Original):
```markdown
#### **1. Blaster - Wrong Projectile Speed**
**File**: `packages/game/src/combat/weapons/firing.ts` lines 300-305
**Status**: Marked complete in Section 5
**Issue**:
- **Current**: Speed = 1000
- **Correct**: Speed = **1500** (per rerelease `p_weapon.cpp` line 1340)
- **Impact**: Blaster feels sluggish and is less useful than intended
- **Fix**: Change `BLASTER_SPEED` constant to 1500

**Testing**: Fire blaster at wall from various distances, verify travel time matches original
```

### After (Enhanced):
```markdown
#### **1. Blaster - Wrong Projectile Speed**
**File**: `packages/game/src/combat/weapons/firing.ts` lines 300-305
**Status**: Marked complete in Section 5
**Original Source**: `../rerelease/p_weapon.cpp` line 1340
**Estimated Effort**: 30 minutes

**Issue**:
- **Current**: Speed = 1000
- **Correct**: Speed = **1500**
- **Impact**: Blaster feels sluggish and is less useful than intended
- **Reason**: Original comment says "let the regular blaster projectiles travel a bit faster because it is a completely useless gun"

**Implementation Tasks**:
- [ ] Locate BLASTER_SPEED constant definition in firing.ts
- [ ] Change value from 1000 to 1500
- [ ] Add source reference comment: `// Speed 1500 (faster than hyperblaster's 1000), per rerelease/p_weapon.cpp:1340`
- [ ] Check if any other code references this constant
- [ ] Update any related documentation or constants
- [ ] Create unit test: `test('blaster projectile speed matches rerelease')`

**Testing Checklist**:
- [ ] Fire blaster at wall from 10 units: should take ~0.0067 seconds
- [ ] Fire blaster at wall from 50 units: should take ~0.033 seconds
- [ ] Compare travel time against original Q2 video recording
- [ ] Verify projectile doesn't move too fast for collision detection
- [ ] Test against moving targets to ensure hit registration works
- [ ] Verify no visual artifacts or skipping

**Verification**:
- [ ] Code review: Verify constant changed and comment added
- [ ] Test results: All test cases pass
- [ ] Gameplay feel: Blaster feels responsive like original
```

---

## Section 16 Specific Additions

For Section 16 (Code Quality), include examples of actual problematic code found in the codebase:

### Example: Unhelpful/Rambling Comments

#### Problem: Rambling Uncertain Comments
**File**: `packages/game/src/physics/movement.ts` lines 21-94

**Bad Example**:
```typescript
// In water, entities drift down slowly if dense, or up if buoyant?
// Quake 2 simply runs custom water physics and skips gravity.
// For now, let's assume they sink slowly or are neutrally buoyant.
// SV_Physics_Toss logic in Q2:
// if (ent->waterlevel > 1) G_RunObject (ent); else SV_AddGravity (ent);
// G_RunObject applies water friction and reduced gravity.

// We'll implement simple water drag here for now to prevent infinite acceleration
// and maybe slight gravity.
// Replicating full G_RunObject is complex, but we can do a simple version.

// Apply drag (water friction)
// Based on G_RunObject in g_phys.c
// v[i] = v[i] * 0.8 * ent->waterlevel * frametime; (Wait, this looks like it would kill velocity instantly if > 1)
// Checking original source:
// sv_phys.c SV_Physics_Toss:
// if (ent->waterlevel > 1) G_RunObject (ent);
// g_phys.c G_RunObject:
// 	if (ent->waterlevel > 1)
// 	{
// 		float	*v;
// 		int		i;
// 		v = ent->velocity;
// 		for (i=0 ; i<3 ; i++)
// 			v[i] = v[i] * 0.8 * ent->waterlevel * frametime;
// 	}
// This looks incorrect in C because multiplying by frametime (e.g. 0.1) repeatedly would make it tiny.
// But wait, G_RunObject is called every frame.
// Maybe it meant to subtract? Or maybe 0.8 is 1 - friction * dt?
// Let's assume standard friction logic:
// speed *= 0.8;

// Actually, looking at other sources, it might be:
// v[i] -= v[i] * friction * frametime;
//
// Let's implement a simple viscous drag.
// 0.8 per second? No, 0.8 per frame?

// Let's stick to the existing simple friction but tune it.
// "speed - frametime * speed * 2" means friction = 2.

const speed = Math.sqrt(ent.velocity.x * ent.velocity.x + ent.velocity.y * ent.velocity.y + ent.velocity.z * ent.velocity.z);
if (speed > 1) {
  const newspeed = speed - frametime * speed * 2; // friction 2
  // ...
}
```

**Problems**:
1. 50+ lines of stream-of-consciousness debugging
2. Multiple "wait", "maybe", "let's assume" statements showing uncertainty
3. Pasted C code without explanation
4. Multiple abandoned approaches documented
5. No conclusion about which approach was chosen or why

**Fix Required**:
```typescript
/**
 * Apply water friction to entity in water.
 *
 * Original Quake II applies friction differently than gravity:
 * - waterlevel > 1: Apply friction, NO gravity (rerelease/g_phys.c G_RunObject)
 * - waterlevel <= 1: Apply gravity normally
 *
 * DEVIATION: Original C code had confusing friction formula that appeared broken.
 * This implementation uses simplified viscous drag: friction coefficient = 2.0
 *
 * @see ../rerelease/g_phys.c lines 145-160 G_RunObject
 */
function applyWaterFriction(ent: Entity, frametime: number): void {
  const WATER_FRICTION = 2.0; // Tuned to match original feel

  const speed = vec3Length(ent.velocity);
  if (speed > 1) {
    const newspeed = Math.max(0, speed - frametime * speed * WATER_FRICTION);
    ent.velocity = vec3Scale(ent.velocity, newspeed / speed);
  }
}
```

**Tasks**:
- [ ] Replace rambling 50-line comment block with concise doc comment
- [ ] Document the deviation from original clearly
- [ ] Extract magic number 2.0 to named constant
- [ ] Add reference to original source
- [ ] Remove debugging stream-of-consciousness
- [ ] Add test verifying water friction behavior

---

#### Problem: Contradictory Comments
**File**: `packages/game/src/entities/monsters/parasite.ts` line 41-42

**Bad Example**:
```typescript
// Helper to access deterministic RNG or Math.random
const random = () => Math.random();
```

**Problems**:
1. Comment says "deterministic RNG or Math.random" (contradictory)
2. Code only uses Math.random (non-deterministic)
3. Comment acknowledges correct approach but doesn't use it
4. Indicates technical debt awareness but no action

**Fix Required**:
```typescript
// Remove helper entirely, pass game.random to functions that need it
// See Section 16 Issue 1 for full Math.random() replacement plan
```

---

#### Problem: "Maybe" and "Guess" Comments
**File**: `packages/game/src/entities/monsters/supertank.ts` line 313

**Bad Example**:
```typescript
self.viewheight = 64; // Guess, maybe higher?
```

**Problems**:
1. "Guess" indicates unknown value
2. "maybe higher?" shows uncertainty
3. Should look up actual value from original

**Fix Required**:
```typescript
// Look up actual value in ../rerelease/m_supertank.cpp spawn function
// Verify against original and replace guess with correct value
self.viewheight = 128; // Per ../rerelease/m_supertank.cpp:245
```

**Tasks**:
- [ ] Search `../rerelease/m_supertank.cpp` for viewheight assignment
- [ ] Replace guessed value with correct one from source
- [ ] Remove "guess" and "maybe" language
- [ ] Add source reference

---

### Example: Code Needing Comments

#### Problem: Complex Algorithm Without Explanation
**File**: `packages/shared/src/bsp/collision.ts` lines 300-348

**Code Without Comments**:
```typescript
for (const side of brush.sides) {
  const plane = side.plane;
  let dist = plane.dist;

  if (mins && maxs) {
    const ofsX = plane.normal.x < 0 ? maxs.x : mins.x;
    const ofsY = plane.normal.y < 0 ? maxs.y : mins.y;
    const ofsZ = plane.normal.z < 0 ? maxs.z : mins.z;
    dist -= plane.normal.x * ofsX + plane.normal.y * ofsY + plane.normal.z * ofsZ;
  }

  const d1 = start.x * plane.normal.x + start.y * plane.normal.y + start.z * plane.normal.z - dist;
  const d2 = end.x * plane.normal.x + end.y * plane.normal.y + end.z * plane.normal.z - dist;

  if (d2 > 0) getout = true;
  if (d1 > 0) startout = true;

  if (d1 > 0 && d2 >= d1) {
    return;
  }

  if (d1 <= 0 && d2 <= 0) {
    continue;
  }

  if (d1 > d2) {
    const f = (d1 - DIST_EPSILON) / (d1 - d2);
    if (f > enterfrac) {
      enterfrac = f;
      clipplane = plane;
      leadside = side;
    }
  } else {
    const f = (d1 + DIST_EPSILON) / (d1 - d2);
    if (f < leavefrac) leavefrac = f;
  }
}
```

**Problems**:
1. Complex plane/box intersection algorithm with no explanation
2. Variables d1, d2, enterfrac, leavefrac not explained
3. Offset calculation logic not documented
4. DIST_EPSILON usage not explained
5. Why getout/startout tracking not clear

**Needs Comments Like**:
```typescript
/**
 * Clip trace against brush sides using Liang-Barsky algorithm.
 * This finds entry/exit fractions when line segment passes through brush.
 *
 * Algorithm:
 * 1. For each brush side (plane), calculate signed distances of start/end points
 * 2. Adjust plane distance by bbox offsets (for box traces vs point traces)
 * 3. Track furthest entry point (enterfrac) and nearest exit point (leavefrac)
 * 4. If enterfrac > leavefrac, trace doesn't intersect brush
 *
 * @see ../rerelease/qcommon/cm_trace.c CM_ClipBoxToBrush lines 145-220
 */
for (const side of brush.sides) {
  const plane = side.plane;
  let dist = plane.dist; // Distance from origin to plane

  // For box traces (mins/maxs != null), adjust plane distance by bbox extents
  // Choose max or min extent based on plane normal direction
  if (mins && maxs) {
    // Offset plane distance by box corner that's furthest along plane normal
    const ofsX = plane.normal.x < 0 ? maxs.x : mins.x;
    const ofsY = plane.normal.y < 0 ? maxs.y : mins.y;
    const ofsZ = plane.normal.z < 0 ? maxs.z : mins.z;
    dist -= plane.normal.x * ofsX + plane.normal.y * ofsY + plane.normal.z * ofsZ;
  }

  // Calculate signed distances from plane
  // d1 > 0: start point in front of plane
  // d1 < 0: start point behind plane
  const d1 = start.x * plane.normal.x + start.y * plane.normal.y + start.z * plane.normal.z - dist;
  const d2 = end.x * plane.normal.x + end.y * plane.normal.y + end.z * plane.normal.z - dist;

  // Track if trace ever exits or starts outside brush
  if (d2 > 0) getout = true;  // End point outside brush
  if (d1 > 0) startout = true; // Start point outside brush

  // Early out: if moving away from plane, can't enter brush
  if (d1 > 0 && d2 >= d1) {
    return;
  }

  // Both start and end on back side of plane, continue to next side
  if (d1 <= 0 && d2 <= 0) {
    continue;
  }

  // Calculate intersection fraction with epsilon for numerical stability
  if (d1 > d2) {
    // Entering: calculate entry fraction
    const f = (d1 - DIST_EPSILON) / (d1 - d2);
    if (f > enterfrac) {
      enterfrac = f;        // Track furthest entry point
      clipplane = plane;    // Remember which plane we entered through
      leadside = side;      // Remember surface flags
    }
  } else {
    // Exiting: calculate exit fraction
    const f = (d1 + DIST_EPSILON) / (d1 - d2);
    if (f < leavefrac) leavefrac = f; // Track nearest exit point
  }
}
```

---

## Application Instructions

### For Each Section Document:

1. **Add Checkboxes**:
   - Every task gets `- [ ]`
   - Every subtask gets `- [ ]` with indent
   - Every testing step gets `- [ ]`

2. **Fix Paths**:
   - Change `/home/user/quake2/rerelease/` → `../rerelease/`
   - Change `/home/user/quake2/full/` → `../full/`

3. **Add Details for Brief Items**:
   - If task is <2 lines, expand with:
     - **Estimated Effort**: time estimate
     - **Implementation Notes**: what specifically to do
     - **Testing**: how to verify
     - **Dependencies**: what else is needed

4. **Add Source References**:
   - Every task should reference original C++ file and line numbers
   - Format: `**Original Source**: ../rerelease/filename.cpp lines X-Y`

5. **Make Testing Specific**:
   - Change "test weapon" → "test weapon fires at 600 RPM ±5%"
   - Change "verify behavior" → specific steps with expected results

6. **For Section 16 Only**:
   - Find actual bad comments in codebase (use Grep)
   - Include real code examples (quote actual lines)
   - Show before/after for fixes
   - Add tasks to fix each bad comment found

### Systematic Enhancement Process:

1. Start with Section 14 (19 issues)
2. For each issue:
   - Add checkbox hierarchy
   - Expand brief tasks
   - Fix paths
   - Add source refs
   - Detail testing

3. Then Section 15 (100+ missing features)
   - Group by priority
   - Add effort estimates
   - Detail implementation approach

4. Then Section 16 (15+ quality issues)
   - Add real code examples
   - Show actual bad comments
   - Provide specific fixes

### Time Estimate:
- Section 14: 2-3 hours to enhance
- Section 15: 3-4 hours to enhance
- Section 16: 2-3 hours to enhance (requires code searching)
- **Total**: 7-10 hours for complete enhancement

This systematic approach ensures consistency and completeness across all documentation.
