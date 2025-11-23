# Section 3: Physics, Collision & Trace System

## Overview
This section covers the physics simulation and collision detection system that forms the foundation of Quake II gameplay. It includes BSP-based tracing, player movement integration, entity physics (gravity, bouncing, pushing), and collision query APIs that match the rerelease `game_import_t` interface. This system bridges the completed shared pmove helpers with real BSP geometry and provides trace/clip/pointcontents functions to the game layer.

## Dependencies
- **Shared package**: Requires complete pmove helpers (slide, step, categorize, etc.) - **COMPLETED**
- **Asset Loading (Section 1)**: REQUIRED - needs BSP brush/plane/node data for collision geometry
- **Entity System (Section 4)**: Partial dependency - needs entity bounding boxes and physics state, can be developed in parallel with stubs

## Work Already Done
- ✅ Complete shared pmove system (`packages/shared/src/pmove/`)
  - Slide movement, step climbing, duck/jump, water movement, fly mode
  - Position snapping, stuck-object fixing, view angle clamping
  - Deterministic movement helpers with full unit test coverage
- ✅ BSP collision constants (CONTENTS_*, SURF_*, MASK_*) in `packages/shared/src/bsp/contents.ts`
- ✅ Vec3 math utilities including clip-plane resolution
- ✅ Initial implementation of the core trace system (`traceBox`) in `packages/shared/src/bsp/collision.ts`.
- ✅ Exhaustive, behavior-driven test suite for `traceBox` that validates its behavior against the original C code.

## Tasks Remaining

### BSP Collision Geometry
- [x] Build collision data structures from loaded BSP
  - Extract brush definitions (planes, sides, contents)
  - Build brush models for world and inline bmodels (func_door, func_wall, etc.)
  - Organize brushes into spatial hierarchy for efficient queries
- [x] Implement plane distance/side tests
  - Point on plane side (epsilon handling)
  - Box on plane side (bbox min/max tests)
- [x] Brush/hull collision tests
  - Point in brush test
  - Box intersects brush test
  - Ray intersects brush test

### Trace System (Core)
- [x] Implement `trace` function (main collision query)
  - **Signature**: `trace(start: vec3, end: vec3, mins: vec3, maxs: vec3, passent: Entity | null, contentmask: number) -> TraceResult`
  - **Returns**: `{ fraction, endpos, plane, surface, contents, ent, allsolid, startsolid }`
  - Sweep bounding box from start to end
  - Test against BSP world brushes
  - Test against entity bounding boxes (see Section 4 integration)
  - Find nearest collision (minimum fraction)
  - Record hit plane, surface flags, contents
- [x] Trace optimization
  - BSP node traversal to limit brush tests
  - Early-out when trace is blocked
  - Trace cache for repeated queries (optional)
- [x] Handle edge cases
  - [x] Zero-length traces (point tests)
  - [x] Trace starting in solid (set startsolid, allsolid flags)
  - [x] Signed bbox offsets when traversing BSP splits to preserve startsolid detection
  - [x] Epsilon handling for surface snapping
  - [x] Grazing hits (comprehensive tests in `tests/bsp/trace.grazing.test.ts`)
  - [x] Corner collisions (comprehensive tests in `tests/bsp/trace.corners.test.ts`)

### Point Queries
- [x] Implement `pointcontents` function
  - **Signature**: `pointcontents(point: vec3) -> number` (returns CONTENTS_* bitmask)
  - Test point against BSP leafs and brushes
  - Return combined contents flags
  - Used for water level detection, trigger volumes, death zones
  - **Status**: Implemented.
- [x] Optimize with BSP leaf lookup
  - Traverse BSP nodes to find containing leaf
  - Test only brushes in that leaf
- [x] Multi-point queries for efficiency
  - Query multiple points in batch (for water level probing)

- [x] Implement `boxcontents` helper (used internally)
  - Test if a bounding box intersects specific contents
  - Used to check if player is in water, lava, slime
  - Traverses BSP splits for boxes that cross multiple leaves to accumulate all relevant contents
- [x] Implement `inPVS` check (for entity visibility)
  - Check if two points are in the same Potentially Visible Set
  - Uses BSP PVS data from asset loader
  - Used to skip AI/sound updates for distant entities

### Entity Collision Integration
- [x] Entity bounding box management (CollisionEntityIndex stores world-space mins/maxs and rebuilds brushes on updates)
  - Store mins/maxs per entity (world-space)
  - Update when entity moves or changes model
  - Support for rotating bounding boxes (optional, Quake II uses axis-aligned)
- [x] Entity trace tests
  - `clipToEntities`: trace against all entities in region
  - Filter by contentmask (CONTENTS_SOLID, CONTENTS_MONSTER, etc.)
  - Skip passent (entity initiating trace)
  - Combine with world trace to find nearest hit
- [x] Trigger volume detection
  - Identify entities with CONTENTS_TRIGGER
  - Used for touch/trigger logic in game layer

### Player Movement Integration
- [x] Wire shared pmove to real trace function
  - Implement trace callback matching pmove expectations
  - Provide current player mins/maxs (standing, crouched, dead)
  - Pass MASK_PLAYERSOLID contentmask
  - **Status**: Implemented in the client-side prediction system.
- [x] Ground detection
  - Trace downward to find ground plane
  - Check surface slope (too steep = not ground)
  - Record ground entity (moving platforms)
- [x] Step/stair climbing
  - Trace upward step amount, then forward, then down
  - Implemented in shared `stepSlideMove`, needs real traces
- [x] Stuck position recovery
  - Use shared `fixStuckObjectGeneric` with real traces
  - Nudge player out of geometry on spawn/teleport

### Physics Simulation (Non-Player Entities)
- [x] Gravity integration
  - Apply gravitational acceleration per frame
  - Different gravity for water vs. air
  - Handle MOVETYPE_BOUNCE (grenades), MOVETYPE_TOSS (gibs)
- [x] Bouncing physics
  - Detect collision with trace
  - Reflect velocity based on hit plane normal
  - Apply bounce damping (e.g., 1.5x for grenades)
  - Stop when velocity too low
- [x] Projectile movement
  - Linear movement with trace per frame
  - Explode/remove on impact
  - Handle MOVETYPE_FLYMISSILE (no gravity, flies straight)
- [x] Platform/pusher movement
  - Doors, elevators, rotating brushes
  - Push entities along with platform
  - Crush damage if blocked

### Collision Query API (game_import_t interface)
- [x] Expose to game layer:
  - `trace(start, end, mins, maxs, passent, contentmask)`
  - `pointcontents(point)`
  - `clip(start, mins, maxs, end, passent, contentmask)` (alias for trace)
  - `inPVS(p1, p2)`
  - `inPHS(p1, p2)` (Potentially Hearable Set, for audio)
- [x] Add debugging/visualization hooks
  - Draw trace lines
  - Highlight hit planes
  - Display collision bounds
  - Toggle to see BSP brush wireframes

### Edge Cases & Special Handling
- [x] Epsilon values for surface snapping
  - STOP_EPSILON (0.1) in `shared/src/math/vec3.ts`, DIST_EPSILON (0.03125) in `shared/src/bsp/collision.ts`
  - Used in clip calculations and velocity blocking
- [x] Crease/corner handling in slide movement
  - Implemented in shared pmove (`slideMove`, `clipVelocity`)
- [x] Stuck-in-solid recovery
  - `fixStuckObjectGeneric` in `shared/src/pmove/stuck.ts`
  - `snapPosition` in `shared/src/pmove/snap.ts`
- [x] Water/liquid transitions
  - Detect when entering/exiting water
  - Trigger splash sounds/effects (via game layer)
  - Apply water physics (damping, altered gravity)

## Integration Points
- **From Asset Loading (Section 1)**: Receives BSP brushes, planes, node tree, PVS data
- **To Game Layer (Section 4)**: Provides trace/pointcontents/clip API for entity logic
- **From/To Entity System (Section 4)**: Needs entity bounding boxes; provides collision results
- **From Shared pmove**: Uses completed movement helpers, provides trace implementation
- **To AI (Section 6)**: Provides line-of-sight checks, pathfinding obstacle tests

## Testing Requirements

### Unit Tests (Standard)
- Point-plane distance calculations
- Point-in-brush tests
- Box-plane intersection tests
- Trace fraction calculation for simple geometry
- Pointcontents with known BSP data

### Integration Tests
- [x] **Player movement**: Full pmove with real BSP, verify slide, jump, step climbing
  - Test on stairs, ramps, ledges, corners
  - Verify no stuck-in-geometry bugs
  - Test crouch/uncrouch in tight spaces
- [x] **Projectile collision**: Fire projectile, verify it hits walls/enemies correctly
- [x] **Water detection**: Walk into water, verify pointcontents returns CONTENTS_WATER at correct height
- [x] **Trigger volumes**: Walk into trigger brush, verify collision detected
- [x] **Platform riding**: Stand on moving platform, verify player moves with it
- [x] **BSP tracing correctness**: Trace through complex BSP geometry, verify hit detection (partially covered in shared/tests/bsp and game/tests/physics/integration.test.ts)

### Performance Tests
- **Trace throughput**: Measure traces per second on complex maps
  - Target: 10,000+ traces/sec for real-time gameplay
- **Player movement frame time**: pmove with 20+ traces per frame should stay under 1ms
- **Entity collision scaling**: Test with 100+ entities, measure trace overhead
- **Spatial partitioning efficiency**: Verify BSP traversal reduces brush tests

### Edge Case Tests
- **Grazing hits**: Trace parallel to surface, verify fraction accuracy
- **Internal corners**: Trace into corner where 3+ planes meet
- **Starting in solid**: Trace with start point inside brush, verify startsolid/allsolid flags
- **Zero-length trace**: Point containment query via trace
- **Epsilon handling**: Trace that stops exactly on surface (within epsilon)

## Notes
- Trace system is performance-critical; optimize heavily with spatial partitioning
- BSP traversal is logarithmic, but brush-vs-box tests are expensive; cache when possible
- Rerelease uses `CM_BoxTrace` and related functions in `cm_trace.c`; port that logic carefully
- Entity-vs-entity collision should be cheap (bounding box tests only, no mesh collision)
- Debugging collision issues is difficult; invest in visualization tools early
- CONTENTS_PLAYERCLIP and CONTENTS_MONSTERCLIP are special: invisible but block specific entity types
- Rotating brushes (func_rotating) require transforming traces into brush-local space (complex, defer if possible)
- Water current physics (currents, conveyor belts) is handled in shared pmove, just needs correct contents detection here
