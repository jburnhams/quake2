# Section 18.9: Polish & Refinements

**Priority**: 🟢 MEDIUM

This phase covers entity system refinements, physics improvements, and network optimizations.

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

