# Quake2ts Data Structures Reference

## Overview

This document provides detailed type definitions for all major data structures used in the quake2ts library. Structures are organized by package with field-level documentation.

**Related Documents**:
- `usage.md`: API guide and usage patterns
- `section-17.md`: Remaining tasks and roadmap

---

## Table of Contents

1. [Shared Package](#shared-package)
   - [Math Types](#math-types)
   - [Protocol Types](#protocol-types)
   - [Player Movement](#player-movement)
   - [Constants and Enums](#constants-and-enums)
2. [Engine Package](#engine-package)
   - [Asset Types](#asset-types)
   - [Rendering Types](#rendering-types)
   - [Audio Types](#audio-types)
3. [Game Package](#game-package)
   - [Entity Types](#entity-types)
   - [Combat Types](#combat-types)
   - [Level Types](#level-types)
4. [Client Package](#client-package)
   - [Input Types](#input-types)
   - [Demo Types](#demo-types)
   - [Prediction Types](#prediction-types)
5. [Server Package](#server-package)
   - [Server Types](#server-types)
   - [Network Types](#network-types)

---

## Shared Package

### Math Types

#### Vec3
**File**: `/packages/shared/src/math/vec3.ts`

Three-component vector for 3D positions, directions, velocities, angles.

```typescript
type Vec3 = Float32Array & { length: 3 }
```

**Common Usage**:
- Position in world space: `entity.origin`
- Velocity: `entity.velocity`
- Euler angles (pitch, yaw, roll): `entity.angles`
- Direction vectors: `forward`, `right`, `up`

**Angle Convention**:
- Index 0: Pitch (up/down, -90 to 90 degrees)
- Index 1: Yaw (left/right, -180 to 180 degrees)
- Index 2: Roll (tilt, -180 to 180 degrees)

**Value Ranges**:
- Positions: Arbitrary world units (typically -8192 to 8192 per axis)
- Velocities: Units per second (typical player run speed: 320)
- Angles: Degrees (normalized to -180 to 180)

---

#### Mat4
**File**: `/packages/shared/src/math/mat4.ts`

4x4 transformation matrix for rendering and spatial transformations.

```typescript
type Mat4 = Float32Array & { length: 16 }
```

**Common Usage**:
- View matrix: Camera position and orientation
- Projection matrix: Perspective or orthographic projection
- Model matrix: Entity world transform
- Combined view-projection matrix: For rendering

**Memory Layout**: Column-major (OpenGL convention)

---

#### Quat
**File**: `/packages/shared/src/math/quat.ts`

Quaternion for rotation representation (avoids gimbal lock).

```typescript
type Quat = Float32Array & { length: 4 }
```

**Common Usage**:
- MD3 tag rotations
- Smooth interpolation between orientations
- Conversion from/to Euler angles

**Components**: `[x, y, z, w]` where w is the scalar component

---

#### Color
**File**: `/packages/shared/src/math/color.ts`

RGBA color representation.

```typescript
interface Color {
  r: number  // 0.0 - 1.0
  g: number  // 0.0 - 1.0
  b: number  // 0.0 - 1.0
  a: number  // 0.0 - 1.0 (alpha/opacity)
}
```

**Common Usage**:
- Entity tint colors
- Particle colors
- Screen blends (damage flash, pickup flash)
- HUD elements

---

#### BoundingBox
**File**: `/packages/shared/src/math/bbox.ts`

Axis-aligned bounding box for collision and culling.

```typescript
interface BoundingBox {
  mins: Vec3  // Minimum corner (x, y, z)
  maxs: Vec3  // Maximum corner (x, y, z)
}
```

**Common Usage**:
- Entity collision bounds: `entity.mins`, `entity.maxs`
- World-space bounds: `entity.absmin`, `entity.absmax`
- Frustum culling tests
- Map bounds

**Invariant**: `mins[i] <= maxs[i]` for all axes i

---

#### Plane
**File**: `/packages/shared/src/math/plane.ts`

Geometric plane for collision and BSP partitioning.

```typescript
interface Plane {
  normal: Vec3     // Unit normal vector
  dist: number     // Distance from origin
  type: number     // Axis alignment hint (0=x, 1=y, 2=z, 3=non-axial)
  signbits: number // Bitmask of normal sign (for fast AABB tests)
}

enum PlaneType {
  PLANE_X = 0,
  PLANE_Y = 1,
  PLANE_Z = 2,
  PLANE_ANYX = 3,
  PLANE_ANYY = 4,
  PLANE_ANYZ = 5
}
```

**Distance Formula**: `dot(point, normal) - dist`
- Positive: Point in front of plane
- Zero: Point on plane
- Negative: Point behind plane

---

### Protocol Types

#### EntityState
**File**: `/packages/shared/src/protocol/entityState.ts`

Network-serializable entity state for client rendering.

```typescript
interface EntityState {
  // Identity
  number: number              // Entity ID (1-1023, 0 reserved for world)

  // Spatial
  origin: Vec3               // Current position
  angles: Vec3               // Current rotation (pitch, yaw, roll)
  old_origin: Vec3           // Previous position (for interpolation)

  // Model
  modelindex: number         // Primary model (0 = no model)
  modelindex2: number        // Weapon model (for players)
  modelindex3: number        // Second weapon model
  modelindex4: number        // Extra model slot

  // Animation
  frame: number              // Current animation frame
  skinnum: number            // Skin/texture variant (0-based)

  // Visual Effects
  effects: number            // Effect flags (EF_* bitmask)
  renderfx: number           // Render flags (RF_* bitmask)

  // Physics
  solid: number              // Collision encoding (SOLID_* or encoded bbox)

  // Audio
  sound: number              // Looping sound index (0 = no sound)
  event: number              // One-shot event code (muzzle flash, footstep, etc.)
}
```

**Effect Flags (EF_*)**: `/packages/shared/src/protocol/effects.ts`
- `EF_ROTATE` (0x00000001): Rotate entity (pickups)
- `EF_GIB` (0x00000002): Leave blood trail
- `EF_BLASTER` (0x00000008): Blaster projectile trail
- `EF_ROCKET` (0x00000010): Rocket trail
- `EF_GRENADE` (0x00000020): Grenade bounce sound
- `EF_HYPERBLASTER` (0x00000040): Hyperblaster trail
- `EF_BFG` (0x00000080): BFG projectile
- `EF_TELEPORTER` (0x00000400): Teleporter effect
- `EF_QUAD` (0x00001000): Quad damage glow
- `EF_PENT` (0x00002000): Invulnerability glow

**Render Flags (RF_*)**: `/packages/shared/src/protocol/renderfx.ts`
- `RF_MINLIGHT` (0x00000001): Always have minimum lighting
- `RF_VIEWERMODEL` (0x00000002): Don't draw through eyes (view weapon)
- `RF_WEAPONMODEL` (0x00000004): Draw as view weapon
- `RF_FULLBRIGHT` (0x00000008): Ignore lighting
- `RF_DEPTHHACK` (0x00000010): For view weapon depth trick
- `RF_TRANSLUCENT` (0x00000020): Alpha blend
- `RF_FRAMELERP` (0x00000040): Interpolate between frames
- `RF_BEAM` (0x00000080): Draw as beam
- `RF_CUSTOMSKIN` (0x00000100): Use custom skin
- `RF_GLOW` (0x00000200): Pulse glow effect
- `RF_SHELL_RED` (0x00000400): Red power shell
- `RF_SHELL_GREEN` (0x00000800): Green power shell
- `RF_SHELL_BLUE` (0x00001000): Blue power shell

---

#### PlayerState
**File**: `/packages/shared/src/protocol/playerState.ts`

Complete player state for rendering and HUD.

```typescript
interface PlayerState {
  // Physics (see PlayerMoveState below)
  pmove: PlayerMoveState

  // View
  viewangles: Vec3           // Camera orientation (pitch, yaw, roll)
  viewoffset: Vec3           // Eye offset from origin (affected by crouch)
  kick_angles: Vec3          // Damage/recoil view kick (temporary)

  // View Weapon (gun model in view)
  gunangles: Vec3            // Weapon model rotation
  gunoffset: Vec3            // Weapon model position
  gunindex: number           // Weapon model index
  gunframe: number           // Weapon animation frame

  // Screen Effects
  blend: [number, number, number, number]  // Screen blend color RGBA (damage, pickup, underwater)
  fov: number                // Field of view in degrees (default 90)

  // HUD Data
  rdflags: number            // Render flags (RDF_*)
  stats: number[]            // HUD statistics (STAT_* indices, length 32)
}
```

**Render Flags (RDF_*)**: `/packages/shared/src/protocol/rdflags.ts`
- `RDF_UNDERWATER` (1): Underwater view effect
- `RDF_NOWORLDMODEL` (2): Don't draw world (UI only)
- `RDF_IRGOGGLES` (4): IR goggles effect
- `RDF_UVGOGGLES` (8): UV goggles effect

**Stats Indices (STAT_*)**: `/packages/shared/src/protocol/stats.ts`
- `STAT_HEALTH_ICON` (0): Health icon index
- `STAT_HEALTH` (1): Current health value
- `STAT_AMMO_ICON` (2): Ammo icon index
- `STAT_AMMO` (3): Current ammo count
- `STAT_ARMOR_ICON` (4): Armor icon index
- `STAT_ARMOR` (5): Armor value
- `STAT_SELECTED_ICON` (6): Selected item icon
- `STAT_PICKUP_ICON` (7): Recently picked up item
- `STAT_PICKUP_STRING` (8): Pickup message string index
- `STAT_TIMER_ICON` (9): Timer icon (for powerups)
- `STAT_TIMER` (10): Timer value in seconds
- `STAT_HELPICON` (11): Help icon
- `STAT_SELECTED_ITEM` (12): Selected inventory item
- `STAT_LAYOUTS` (13): Layout flags (scoreboard, inventory)
- `STAT_FRAGS` (14): Frag count (deathmatch)
- `STAT_FLASHES` (15): Damage direction indicators (bitfield)
- `STAT_CHASE` (16): Chase camera mode
- `STAT_SPECTATOR` (17): Spectator mode

---

#### UserCommand
**File**: `/packages/shared/src/protocol/userCmd.ts`

Player input for a single frame.

```typescript
interface UserCommand {
  msec: number               // Command duration in milliseconds (typically 25 for 40Hz)
  buttons: number            // Button state bitfield (BUTTON_*)
  angles: Vec3               // Desired view angles (short precision)
  forwardmove: number        // Forward/backward input (-400 to 400)
  sidemove: number           // Left/right strafe input (-400 to 400)
  upmove: number             // Jump/crouch input (-200 to 200)
  impulse: number            // Weapon switch impulse (1-9, 0 = no change)
  lightlevel: number         // Ambient light level (for muzzle flash culling)
}
```

**Button Flags (BUTTON_*)**: `/packages/shared/src/protocol/buttons.ts`
- `BUTTON_ATTACK` (1): Primary fire
- `BUTTON_USE` (2): Use/interact
- `BUTTON_JUMP` (4): Jump (also swim up)
- `BUTTON_CROUCH` (8): Crouch (also swim down)
- `BUTTON_ATTACK2` (16): Secondary fire
- `BUTTON_RELOAD` (32): Reload weapon
- `BUTTON_SPRINT` (64): Sprint modifier

**Movement Value Ranges**:
- Forward/side: -400 (full reverse/left) to 400 (full forward/right)
- Up: -200 (crouch/swim down) to 200 (jump/swim up)
- Values interpolated from analog stick or binary keys

---

### Player Movement

#### PlayerMoveState
**File**: `/packages/shared/src/pmove/pmoveState.ts`

Physics state for player movement simulation.

```typescript
interface PlayerMoveState {
  // Movement type
  pm_type: PmType            // Movement mode (normal, spectator, dead, etc.)

  // Spatial
  origin: Vec3               // Current position (1/8 unit precision)
  velocity: Vec3             // Current velocity (units/second)

  // Input
  pm_flags: number           // Movement flags (PMF_*)
  pm_time: number            // Movement timer (for dodge, crouch delay)

  // Physics state
  gravity: number            // Gravity multiplier (default 1.0)
  delta_angles: Vec3         // Angle delta for view lock (teleporters, etc.)

  // Ground detection
  groundEntityNum: number    // Entity standing on (0 = world, -1 = none)
}
```

**Movement Types (PmType)**: `/packages/shared/src/pmove/pmove.ts`
```typescript
enum PmType {
  NORMAL = 0,        // Standard walking/jumping
  SPECTATOR = 1,     // Observer mode (fly, noclip)
  DEAD = 2,          // Dead (no control)
  GIB = 3,           // Gibbed (tumbling)
  FREEZE = 4,        // Frozen (no movement)
  NOCLIP = 5         // Developer noclip (fly through walls)
}
```

**Movement Flags (PMF_*)**: `/packages/shared/src/pmove/pmove.ts`
```typescript
const PMF_DUCKED = (1 << 0)          // Currently crouched
const PMF_JUMP_HELD = (1 << 1)       // Jump button held (prevent multi-jump)
const PMF_ON_GROUND = (1 << 2)       // On ground this frame
const PMF_TIME_WATERJUMP = (1 << 3)  // Water jump timer active
const PMF_TIME_LAND = (1 << 4)       // Landing recovery timer
const PMF_TIME_TELEPORT = (1 << 5)   // Teleport freeze timer
const PMF_NO_PREDICTION = (1 << 6)   // Disable client prediction
const PMF_TELEPORT_BIT = (1 << 7)    // Teleport flag for client
```

---

#### PmoveResult
**File**: `/packages/shared/src/pmove/pmove.ts`

Result of pmove calculation.

```typescript
interface PmoveResult {
  state: PlayerMoveState     // New physics state
  viewangles: Vec3           // New view angles (may be clamped)
  step: number               // Step height climbed (for view smoothing)
}
```

---

#### PmoveTraceResult
**File**: `/packages/shared/src/pmove/pmove.ts`

Collision trace result for pmove.

```typescript
interface PmoveTraceResult {
  allsolid: boolean          // Started and ended in solid
  startsolid: boolean        // Started in solid
  fraction: number           // Distance traveled (0.0 = blocked, 1.0 = clear)
  endpos: Vec3              // Final position (may be adjusted out of solid)
  plane?: Plane             // Surface plane hit (if fraction < 1.0)
  surfaceFlags?: number     // Surface material flags
  contents: number          // Contents at endpoint
  entityNum?: number        // Entity hit (if any)
}
```

---

### Constants and Enums

#### Contents Flags
**File**: `/packages/shared/src/constants/contents.ts`

World contents bitmask for collision detection and water physics.

```typescript
const CONTENTS_SOLID = 1           // Blocks movement (walls, floor)
const CONTENTS_WINDOW = 2          // Transparent solid (shootable glass)
const CONTENTS_AUX = 4             // Unused
const CONTENTS_LAVA = 8            // Lava (damage + visual effect)
const CONTENTS_SLIME = 16          // Slime (damage + visual effect)
const CONTENTS_WATER = 32          // Water (swim physics + visual effect)
const CONTENTS_MIST = 64           // Fog/mist (visual only)

// AI hints
const CONTENTS_AREAPORTAL = 0x8000        // Area portal (BSP visibility)
const CONTENTS_PLAYERCLIP = 0x10000       // Blocks players only
const CONTENTS_MONSTERCLIP = 0x20000      // Blocks monsters only

// Utility
const CONTENTS_CURRENT_0 = 0x40000        // Water current direction
const CONTENTS_CURRENT_90 = 0x80000
const CONTENTS_CURRENT_180 = 0x100000
const CONTENTS_CURRENT_270 = 0x200000
const CONTENTS_CURRENT_UP = 0x400000
const CONTENTS_CURRENT_DOWN = 0x800000

const CONTENTS_ORIGIN = 0x1000000         // Entity origin brush (removed after spawn)
const CONTENTS_MONSTER = 0x2000000        // Monster entity
const CONTENTS_DEADMONSTER = 0x4000000    // Dead monster (doesn't block)
const CONTENTS_DETAIL = 0x8000000         // Detail brush (doesn't split BSP)
const CONTENTS_TRANSLUCENT = 0x10000000   // Transparent surface
const CONTENTS_LADDER = 0x20000000        // Ladder (climb physics)

// Masks (commonly used combinations)
const MASK_ALL = -1
const MASK_SOLID = (CONTENTS_SOLID | CONTENTS_WINDOW)
const MASK_PLAYERSOLID = (CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW | CONTENTS_MONSTER)
const MASK_DEADSOLID = (CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW)
const MASK_MONSTERSOLID = (CONTENTS_SOLID | CONTENTS_MONSTERCLIP | CONTENTS_WINDOW | CONTENTS_MONSTER)
const MASK_WATER = (CONTENTS_WATER | CONTENTS_LAVA | CONTENTS_SLIME)
const MASK_OPAQUE = (CONTENTS_SOLID | CONTENTS_SLIME | CONTENTS_LAVA)
const MASK_SHOT = (CONTENTS_SOLID | CONTENTS_MONSTER | CONTENTS_WINDOW | CONTENTS_DEADMONSTER)
const MASK_CURRENT = (CONTENTS_CURRENT_0 | CONTENTS_CURRENT_90 | CONTENTS_CURRENT_180 | CONTENTS_CURRENT_270 | CONTENTS_CURRENT_UP | CONTENTS_CURRENT_DOWN)
```

---

#### Surface Flags
**File**: `/packages/shared/src/constants/surfaceFlags.ts`

Material flags for surfaces (affects rendering and physics).

```typescript
const SURF_LIGHT = 0x1           // Emits light (lightmap brightness source)
const SURF_SLICK = 0x2           // Low friction (ice)
const SURF_SKY = 0x4             // Sky surface (draws skybox)
const SURF_WARP = 0x8            // Warping surface (water, lava)
const SURF_TRANS33 = 0x10        // 33% alpha
const SURF_TRANS66 = 0x20        // 66% alpha
const SURF_FLOWING = 0x40        // Scrolling texture (water flow)
const SURF_NODRAW = 0x80         // Don't draw (collision only)
```

---

#### ConfigString Indices
**File**: `/packages/shared/src/protocol/configstrings.ts`

Global server state string indices.

```typescript
const CS_NAME = 0              // Map name
const CS_CDTRACK = 1           // CD track number
const CS_SKY = 2               // Skybox name
const CS_SKYAXIS = 3           // Skybox rotation axis
const CS_SKYROTATE = 4         // Skybox rotation speed
const CS_STATUSBAR = 5         // HUD layout string
const CS_AIRACCEL = 29         // Air acceleration multiplier
const CS_MAXCLIENTS = 30       // Max players
const CS_MAPCHECKSUM = 31      // BSP checksum

// Arrays
const CS_MODELS = 32           // Model names [32-287] (256 slots)
const CS_SOUNDS = 288          // Sound names [288-543] (256 slots)
const CS_IMAGES = 544          // Image names [544-799] (256 slots)
const CS_LIGHTS = 800          // Light styles [800-1055] (256 slots)
const CS_ITEMS = 1056          // Item names [1056-1311] (256 slots)
const CS_PLAYERSKINS = 1312    // Player skins [1312-1567] (256 slots)
const CS_GENERAL = 1568        // General strings [1568-2079] (512 slots)

const MAX_CONFIGSTRINGS = 2080
```

---

## Engine Package

### Asset Types

#### PakArchive
**File**: `/packages/engine/src/assets/pak.ts`

Represents a single PAK file archive.

```typescript
class PakArchive {
  readonly name: string      // Filename (for debugging)
  readonly entries: Map<string, PakDirectoryEntry>

  constructor(buffer: ArrayBuffer)

  readFile(normalizedPath: string): Uint8Array | null
  has(normalizedPath: string): boolean
  list(): string[]
  getEntries(): PakDirectoryEntry[]
}

interface PakDirectoryEntry {
  name: string               // Normalized path (lowercase, forward slashes)
  offset: number             // Byte offset in PAK file
  length: number             // File size in bytes
}
```

**PAK File Format**:
- Header: 12 bytes (magic "PACK", directory offset, directory size)
- File data: Concatenated file contents
- Directory: Array of 64-byte entries (56-byte filename, 4-byte offset, 4-byte length)

---

#### BspMap
**File**: `/packages/engine/src/assets/bsp.ts`

Parsed BSP map data.

```typescript
interface BspMap {
  // Raw lumps
  entities: string           // Entity definition string (key-value format)
  planes: BspPlane[]
  vertices: BspVertex[]
  nodes: BspNode[]
  texinfo: BspTexInfo[]
  faces: BspFace[]
  lightmaps: Uint8Array      // Concatenated lightmap data
  leafs: BspLeaf[]
  leaffaces: number[]        // Leaf → face indices
  leafbrushes: number[]      // Leaf → brush indices
  edges: BspEdge[]
  surfedges: number[]        // Face → edge indices (signed)
  models: BspModel[]
  brushes: BspBrush[]
  brushsides: BspBrushSide[]
  visibility: BspVisibility
  areas: BspArea[]
  areaportals: BspAreaPortal[]

  // Computed
  bounds: BoundingBox        // Map bounding box
}

interface BspPlane {
  normal: Vec3
  dist: number
  type: number
}

interface BspVertex {
  position: Vec3
}

interface BspNode {
  planeNum: number           // Splitting plane index
  children: [number, number] // Child indices (negative = leaf)
  mins: Vec3
  maxs: Vec3
  firstFace: number
  numFaces: number
}

interface BspTexInfo {
  vecs: [Vec3, Vec3, Vec3, Vec3]  // [s, s_offset, t, t_offset] texture mapping
  flags: number              // Surface flags
  value: number              // Surface value (light emit, damage, etc.)
  texture: string            // Texture name
  nexttexinfo: number        // Animation chain
}

interface BspFace {
  planeNum: number           // Plane index
  side: number               // Plane side (0 = front, 1 = back)
  firstEdge: number          // First surfedge index
  numEdges: number           // Number of edges (polygon vertices)
  texinfo: number            // Texture info index
  styles: number[]           // Light styles (4 bytes)
  lightofs: number           // Lightmap offset in lightmaps array (-1 = none)
}

interface BspLeaf {
  contents: number           // Contents flags
  cluster: number            // PVS cluster (-1 = no visibility)
  area: number               // Area index
  mins: Vec3
  maxs: Vec3
  firstLeafFace: number
  numLeafFaces: number
  firstLeafBrush: number
  numLeafBrushes: number
}

interface BspEdge {
  v: [number, number]        // Vertex indices
}

interface BspModel {
  mins: Vec3
  maxs: Vec3
  origin: Vec3               // Rotation origin
  headnode: number           // BSP tree root (for collision)
  firstFace: number
  numFaces: number
}

interface BspBrush {
  firstSide: number
  numSides: number
  contents: number           // Brush contents
}

interface BspBrushSide {
  planeNum: number
  texinfo: number
}

interface BspVisibility {
  clusters: number           // Number of PVS clusters
  data: Uint8Array           // Compressed visibility data

  isClusterVisible(from: number, to: number): boolean
}

interface BspArea {
  numAreaPortals: number
  firstAreaPortal: number
}

interface BspAreaPortal {
  portalNum: number
  otherArea: number
}
```

---

#### Md2Model
**File**: `/packages/engine/src/assets/md2.ts`

MD2 animated model (Quake II format).

```typescript
interface Md2Model {
  // Geometry
  frames: Md2Frame[]         // Animation frames
  triangles: Md2Triangle[]   // Triangle indices
  texCoords: Md2TexCoord[]   // UV coordinates
  glCommands: number[]       // Optimized GL command stream (legacy)

  // Metadata
  skinWidth: number          // Texture width
  skinHeight: number         // Texture height
  skins: string[]            // Skin names

  // Bounds
  bounds: BoundingBox        // Overall model bounds
}

interface Md2Frame {
  name: string               // Frame name (e.g., "stand01", "run1")
  vertices: Md2Vertex[]      // Decompressed vertex positions
  bounds: BoundingBox        // Frame bounding box
}

interface Md2Vertex {
  position: Vec3             // Vertex position
  normal: Vec3               // Vertex normal (quantized to 162 directions)
}

interface Md2Triangle {
  vertexIndices: [number, number, number]
  texCoordIndices: [number, number, number]
}

interface Md2TexCoord {
  s: number                  // U coordinate (0-skinWidth)
  t: number                  // V coordinate (0-skinHeight)
}
```

**Animation**: Interpolate between frames based on time
- Frame 0: `vertices[tri.vertexIndices[i]]`
- Frame 1: `vertices[tri.vertexIndices[i]]` of next frame
- Lerp factor: `(time % frameDuration) / frameDuration`

---

#### Md3Model
**File**: `/packages/engine/src/assets/md3.ts`

MD3 skeletal model (Quake III format).

```typescript
interface Md3Model {
  frames: Md3Frame[]
  tags: Md3Tag[][]           // Tags per frame [frameIndex][tagIndex]
  surfaces: Md3Surface[]
}

interface Md3Frame {
  mins: Vec3
  maxs: Vec3
  localOrigin: Vec3
  radius: number
  name: string
}

interface Md3Tag {
  name: string               // Tag name (e.g., "tag_weapon", "tag_head")
  origin: Vec3               // Tag position
  axis: Mat3                 // Tag orientation (3x3 rotation matrix)
}

interface Md3Surface {
  name: string
  shaders: Md3Shader[]       // Texture names
  triangles: Md3Triangle[]
  vertices: Md3Vertex[][]    // Vertices per frame [frameIndex][vertexIndex]
  texCoords: Md3TexCoord[]
}

interface Md3Shader {
  name: string
  index: number
}

interface Md3Triangle {
  indices: [number, number, number]
}

interface Md3Vertex {
  position: Vec3
  normal: Vec3
}

interface Md3TexCoord {
  s: number
  t: number
}
```

**Tag System**: Tags define attachment points between model parts
- Example: Player model has "head", "torso", "legs" surfaces
- "tag_head" on torso surface attaches to "tag_torso" on head surface
- Tags animated per frame for smooth attachment

---

#### PreparedTexture
**File**: `/packages/engine/src/assets/texture.ts`

Texture data ready for GPU upload.

```typescript
interface PreparedTexture {
  width: number
  height: number
  data: Uint8Array           // RGBA8 format (4 bytes per pixel)
  mipmaps?: Uint8Array[]     // Mipmap chain (optional)
  wrapS?: TextureWrap
  wrapT?: TextureWrap
  minFilter?: TextureFilter
  magFilter?: TextureFilter
}

enum TextureWrap {
  Repeat,
  ClampToEdge,
  MirroredRepeat
}

enum TextureFilter {
  Nearest,
  Linear,
  NearestMipmapNearest,
  LinearMipmapNearest,
  NearestMipmapLinear,
  LinearMipmapLinear
}
```

---

### Rendering Types

#### RenderOptions
**File**: `/packages/engine/src/render/renderer.ts`

Options for a single render frame.

```typescript
interface RenderOptions {
  camera: Camera             // Camera transform
  mapName: string            // Current map (for BSP lookup)
  fov: number                // Field of view in degrees
  time: number               // Render time in milliseconds
  frameTime: number          // Delta time since last frame
  rdflags: number            // Render flags (RDF_*)
  blend: [number, number, number, number]  // Screen blend color
  refdef?: RefDef            // Extended render definition (optional)
}

interface RefDef {
  x: number                  // Viewport X
  y: number                  // Viewport Y
  width: number              // Viewport width
  height: number             // Viewport height
  vieworg: Vec3              // Camera position (same as camera)
  viewangles: Vec3           // Camera angles (same as camera)
  time: number               // Client time
}
```

---

#### Camera
**File**: `/packages/engine/src/render/camera.ts`

Camera properties for rendering.

```typescript
class Camera {
  position: Vec3             // World position
  rotation: Vec3             // Euler angles (pitch, yaw, roll)
  fov: number                // Field of view in degrees (default 90)
  aspectRatio: number        // Width / height (default 16/9)
  nearPlane: number          // Near clipping plane (default 4)
  farPlane: number           // Far clipping plane (default 8192)

  getViewMatrix(): Mat4
  getProjectionMatrix(): Mat4
  getViewProjectionMatrix(): Mat4
  getFrustumPlanes(): Plane[]
}
```

---

#### RenderEntity
**File**: `/packages/engine/src/render/renderer.ts`

Entity to render (converted from EntityState).

```typescript
interface RenderEntity {
  origin: Vec3
  angles: Vec3
  model?: string             // Model name
  frame: number              // Current frame
  oldframe?: number          // Previous frame (for interpolation)
  backlerp?: number          // Interpolation factor (0 = frame, 1 = oldframe)
  skin?: number              // Skin index
  flags?: number             // Render flags (RF_*)
  alpha?: number             // Alpha transparency (0.0-1.0)
  scale?: number             // Model scale multiplier
}
```

---

#### RenderStatistics
**File**: `/packages/engine/src/render/gpuProfiler.ts`

Rendering performance metrics.

```typescript
interface RenderStatistics {
  frameTimeMs: number        // Total frame time
  renderTimeMs: number       // Render pass time
  cullingTimeMs: number      // Culling time
  drawCalls: number          // Number of draw calls
  triangles: number          // Triangles rendered
  vertices: number           // Vertices processed
  textureBinds: number       // Texture binding count
  shaderSwitches: number     // Shader program switches
  visibleSurfaces: number    // BSP surfaces rendered
  culledSurfaces: number     // BSP surfaces culled
  visibleEntities: number    // Entities rendered
  culledEntities: number     // Entities culled
}
```

---

### Audio Types

#### AudioAPI
**File**: `/packages/engine/src/audio/api.ts`

Audio playback interface.

```typescript
interface AudioAPI {
  sound(
    entity: number,          // Entity number emitting sound
    channel: number,         // Channel ID (CHAN_*)
    soundIndex: number,      // Sound index (from configstrings)
    volume: number,          // Volume (0.0-1.0)
    attenuation: number,     // Attenuation (ATTN_*)
    timeOffset: number       // Start offset in seconds
  ): void

  positioned_sound(
    origin: Vec3,            // Fixed world position
    entity: number,
    channel: number,
    soundIndex: number,
    volume: number,
    attenuation: number,
    timeOffset: number
  ): void

  loop_sound(
    entity: number,
    soundIndex: number,
    volume: number,
    attenuation: number
  ): void

  stop_entity_sounds(entity: number): void

  play_music(trackName: string): void
  stop_music(): void

  setListenerPosition(position: Vec3, velocity: Vec3, forward: Vec3, up: Vec3): void
}
```

**Channel Types (CHAN_*)**: `/packages/engine/src/audio/channels.ts`
```typescript
const CHAN_AUTO = 0          // Auto-allocate channel
const CHAN_WEAPON = 1        // Weapon sounds
const CHAN_VOICE = 2         // Voice/pain sounds
const CHAN_ITEM = 3          // Item pickup sounds
const CHAN_BODY = 4          // Body sounds (footsteps)
const CHAN_RELIABLE = 5      // Reliable delivery
```

**Attenuation Types (ATTN_*)**: `/packages/engine/src/audio/attenuation.ts`
```typescript
const ATTN_NONE = 0          // Full volume everywhere
const ATTN_NORM = 1          // Normal attenuation (fade with distance)
const ATTN_IDLE = 2          // Idle attenuation (quiet)
const ATTN_STATIC = 3        // Static attenuation (ambient)
```

---

## Game Package

### Entity Types

#### Entity
**File**: `/packages/game/src/entities/entity.ts`

Complete entity class for game simulation.

```typescript
class Entity {
  // --- IDENTITY ---
  id: number                 // Unique entity ID (1-2047)
  classname: string          // Entity type (e.g., "monster_soldier", "weapon_shotgun")
  spawnflags: number         // Spawn flags from map (entity-specific meaning)

  // --- SPATIAL ---
  origin: Vec3               // World position
  angles: Vec3               // Rotation (pitch, yaw, roll)
  velocity: Vec3             // Movement velocity (units/second)
  avelocity: Vec3            // Angular velocity (degrees/second)

  // --- COLLISION ---
  mins: Vec3                 // Local space bounding box min
  maxs: Vec3                 // Local space bounding box max
  absmin: Vec3               // World space bounding box min (computed)
  absmax: Vec3               // World space bounding box max (computed)
  size: Vec3                 // Bounding box size (maxs - mins)
  solid: SolidType           // Collision type
  clipmask: number           // Collision mask (CONTENTS_*)

  // --- PHYSICS ---
  movetype: MoveType         // Movement behavior
  mass: number               // Mass for physics (default 200)
  gravity: number            // Gravity multiplier (default 1.0)
  groundentity: Entity | null           // Entity standing on
  groundentity_linkcount: number        // Link version (for stale detection)

  // --- MODEL ---
  model: string              // Model name (e.g., "models/monsters/soldier/tris.md2")
  modelindex: number         // Model index (from configstrings)
  modelindex2: number        // Secondary model (weapon)
  modelindex3: number        // Third model
  modelindex4: number        // Fourth model
  frame: number              // Animation frame
  old_frame: number          // Previous frame (for interpolation)
  frameStartTime: number     // Frame animation start time

  // --- BEHAVIOR ---
  think: (() => void) | null             // Per-frame think function
  nextthink: number                      // Next think time (level time)
  touch: ((other: Entity, plane: Plane, surf: Surface) => void) | null
  use: ((activator: Entity) => void) | null
  pain: ((attacker: Entity, damage: number) => void) | null
  die: ((inflictor: Entity, attacker: Entity, damage: number) => void) | null
  blocked: ((other: Entity) => void) | null

  // --- TARGETING ---
  target: string             // Target entity targetname
  targetname: string         // This entity's name (for targeting)
  killtarget: string         // Entity to remove on activation
  team: string               // Team name (for grouped entities)
  pathtarget: string         // Path corner target
  deathtarget: string        // Target on death
  combattarget: string       // Target when entering combat

  // --- HEALTH ---
  health: number             // Current health
  max_health: number         // Maximum health
  deadflag: number           // Death state (DEAD_NO, DEAD_DYING, DEAD_DEAD)
  takedamage: number         // Can take damage (0 = no, 1 = yes, 2 = yes + armor)
  dmg: number                // Damage dealt by this entity (triggers, projectiles)

  // --- EFFECTS ---
  effects: number            // Visual effects (EF_*)
  renderfx: number           // Render flags (RF_*)
  svflags: number            // Server flags (SVF_*)

  // --- SOUNDS ---
  noise_index: number        // Looping sound index
  sound_index: number        // One-shot sound index (events)

  // --- AI (monsters) ---
  enemy: Entity | null       // Current enemy target
  movetarget: Entity | null  // Movement goal entity
  goalentity: Entity | null  // AI goal entity
  ideal_yaw: number          // Desired facing angle
  yaw_speed: number          // Turn rate

  // --- TIMING ---
  timestamp: number          // General purpose timestamp
  teleport_time: number      // Teleport invulnerability end time
  air_finished: number       // Drowning timer end time
  pain_debounce_time: number // Next time can play pain sound
  damage_debounce_time: number // Next time can take damage
  fly_sound_debounce_time: number
  last_move_time: number

  // --- ITEM ---
  item: Item | null          // Item definition (if pickup)
  respawn_time: number       // Respawn time (items)
  count: number              // Item count (ammo, health)

  // --- MISC ---
  flags: number              // Gameplay flags (FL_*)
  watertype: number          // Contents type if in water
  waterlevel: number         // Water level (0-3)
  message: string            // Message to print (pickups, triggers)
  style: number              // Light style index
  delay: number              // Activation delay (triggers)
  wait: number               // Retrigger delay
  random: number             // Random variance in wait time
  owner: Entity | null       // Entity that owns this (projectiles → shooter)
  activator: Entity | null   // Entity that triggered this
  chain: Entity | null       // Linked list chain (for iteration)
  oldorigin: Vec3            // Previous origin (for interpolation)
}
```

**Solid Types (SolidType)**: `/packages/game/src/entities/solid.ts`
```typescript
enum SolidType {
  NOT,           // No collision
  TRIGGER,       // Touch triggers only (doesn't block movement)
  BBOX,          // Axis-aligned bounding box
  BSP            // Brush model (complex geometry)
}
```

**Move Types (MoveType)**: `/packages/game/src/entities/movetype.ts`
```typescript
enum MoveType {
  NONE,          // No movement (stationary)
  NOCLIP,        // No collision (fly through walls)
  PUSH,          // Push/crush players (doors, platforms)
  STOP,          // Stationary, no physics
  WALK,          // Walking with gravity
  STEP,          // Walking with step climbing
  FLY,           // Flying with gravity
  TOSS,          // Thrown item (bounce)
  FLYMISSILE,    // Flying projectile (no bounce)
  BOUNCE,        // Bouncing projectile (grenades)
  WALLBOUNCE     // Bounce off walls only
}
```

**Server Flags (SVF_*)**: `/packages/game/src/entities/svflags.ts`
```typescript
const SVF_NOCLIENT = 0x00000001       // Don't send to clients
const SVF_DEADMONSTER = 0x00000002    // Dead monster (treat as item)
const SVF_MONSTER = 0x00000004        // Monster entity
const SVF_PROJECTILE = 0x00000008     // Projectile
const SVF_DAMAGEABLE = 0x00000010     // Can take damage
```

**Entity Flags (FL_*)**: `/packages/game/src/entities/flags.ts`
```typescript
const FL_FLY = 0x00000001             // Can fly (no gravity)
const FL_SWIM = 0x00000002            // Can swim
const FL_IMMUNE_LASER = 0x00000004    // Immune to laser damage
const FL_INWATER = 0x00000008         // In water
const FL_GODMODE = 0x00000010         // God mode (invincible)
const FL_NOTARGET = 0x00000020        // Invisible to monsters
const FL_IMMUNE_SLIME = 0x00000040    // Immune to slime
const FL_IMMUNE_LAVA = 0x00000080     // Immune to lava
const FL_PARTIALGROUND = 0x00000100   // Not all corners on ground
const FL_WATERJUMP = 0x00000200       // Water jump active
const FL_TEAMSLAVE = 0x00000400       // Slave in entity team
const FL_NO_KNOCKBACK = 0x00000800    // Immune to knockback
const FL_POWER_ARMOR = 0x00001000     // Power armor active
const FL_RESPAWN = 0x80000000         // Used for respawn logic
```

---

#### GameTraceResult
**File**: `/packages/game/src/physics/trace.ts`

Detailed collision trace result.

```typescript
interface GameTraceResult {
  allsolid: boolean          // Trace started and ended in solid
  startsolid: boolean        // Trace started in solid
  fraction: number           // Distance traveled (0.0-1.0)
  endpos: Vec3              // Final position
  plane: Plane              // Hit surface plane
  surface: Surface          // Surface material
  contents: number          // Contents flags at endpoint
  ent: Entity | null        // Entity hit (if any)
}

interface Surface {
  name: string               // Texture name
  flags: number              // Surface flags (SURF_*)
  value: number              // Surface value (light emit, etc.)
}
```

---

### Combat Types

#### DamageFlags
**File**: `/packages/game/src/combat/damage.ts`

Damage type modifiers.

```typescript
const DAMAGE_RADIUS = 0x00000001      // Radius damage (splash)
const DAMAGE_NO_ARMOR = 0x00000002    // Bypass armor
const DAMAGE_ENERGY = 0x00000004      // Energy damage (power shield)
const DAMAGE_NO_KNOCKBACK = 0x00000008  // No knockback
const DAMAGE_BULLET = 0x00000010      // Bullet damage (blood trail)
const DAMAGE_NO_PROTECTION = 0x00000020 // Bypass all protection
```

---

#### MeansOfDeath
**File**: `/packages/game/src/combat/meansOfDeath.ts`

How entity died (for obituaries).

```typescript
enum MeansOfDeath {
  UNKNOWN,
  BLASTER,
  SHOTGUN,
  SSHOTGUN,
  MACHINEGUN,
  CHAINGUN,
  GRENADE,
  G_SPLASH,
  ROCKET,
  R_SPLASH,
  HYPERBLASTER,
  RAILGUN,
  BFG_LASER,
  BFG_BLAST,
  BFG_EFFECT,
  HANDGRENADE,
  HG_SPLASH,
  WATER,
  SLIME,
  LAVA,
  CRUSH,
  TELEFRAG,
  FALLING,
  SUICIDE,
  HELD_GRENADE,
  EXPLOSIVE,
  BARREL,
  BOMB,
  EXIT,
  SPLASH,
  TARGET_LASER,
  TRIGGER_HURT,
  HIT
}
```

---

### Level Types

#### LevelState
**File**: `/packages/game/src/level.ts`

Current level state.

```typescript
interface LevelState {
  // Time
  time: number               // Current level time in seconds
  framenum: number           // Current frame number (40Hz)

  // Map info
  mapname: string
  nextmap: string            // Next map in sequence
  intermissiontime: number   // Intermission start time (0 = not active)

  // Rules
  deathmatch: boolean
  coop: boolean
  skill: number              // 0-3 (easy, normal, hard, nightmare)

  // Entity tracking
  current_entity: Entity | null     // Entity currently thinking
  body_queue: Entity[]              // Dead body queue (for cleanup)

  // Misc
  pic_health: number         // Health icon index
}
```

---

## Client Package

### Input Types

#### KeyBindings
**File**: `/packages/client/src/input/bindings.ts`

Key-to-action mapping.

```typescript
interface KeyBindings {
  [action: string]: string[] // Action name → key codes
}
```

**Common Actions**:
- `"+forward"`, `"+back"`, `"+moveleft"`, `"+moveright"`
- `"+lookup"`, `"+lookdown"`, `"+left"`, `"+right"`
- `"+attack"`, `"+attack2"`, `"+use"`
- `"+jump"`, `"+crouch"`, `"+sprint"`
- `"weapon1"` - `"weapon9"`, `"nextweapon"`, `"prevweapon"`
- `"toggleconsole"`, `"togglemenu"`, `"screenshot"`

**Key Code Format**: Browser KeyboardEvent.code (e.g., "KeyW", "Space", "Mouse1")

---

### Demo Types

#### DemoPlaybackController
**File**: `/packages/client/src/demo/playback.ts`

Demo playback control interface.

```typescript
class DemoPlaybackController {
  // Playback control
  play(): void
  pause(): void
  stop(): void

  stepForward(frames?: number): void
  stepBackward(frames?: number): void

  seekToFrame(frameIndex: number): void
  seekToTime(timeSeconds: number): void

  setSpeed(multiplier: number): void  // 0.1-16.0
  getSpeed(): number

  // State queries
  getCurrentFrame(): number
  getFrameCount(): number
  getCurrentTime(): number
  getDuration(): number
  getState(): PlaybackState
  isPlaying(): boolean
  isPaused(): boolean

  // Events
  onStateChange?: (state: PlaybackState) => void
  onFrameUpdate?: (frame: number) => void
  onTimeUpdate?: (time: number) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

enum PlaybackState {
  Stopped,
  Playing,
  Paused,
  Finished
}
```

---

#### FrameData
**File**: `/packages/client/src/demo/parser.ts`

Parsed demo frame data.

```typescript
interface FrameData {
  frameIndex: number
  time: number
  playerState: PlayerState
  entities: EntityState[]
  events: FrameEvent[]
}

interface FrameEvent {
  type: string               // "muzzleflash", "footstep", "damage", etc.
  entityId: number
  data: any
}
```

---

### Prediction Types

#### ClientPrediction
**File**: `/packages/client/src/prediction.ts`

Client-side prediction system.

```typescript
class ClientPrediction {
  predict(
    serverState: PlayerState,
    serverTime: number,
    commands: UserCommand[],
    currentTime: number
  ): PredictionState

  getLastPrediction(): PredictionState
  getMispredictionCount(): number
}

interface PredictionState {
  position: Vec3
  velocity: Vec3
  viewangles: Vec3
  viewoffset: Vec3
  time: number
  onground: boolean
  pmflags: number
}
```

---

## Server Package

### Server Types

#### DedicatedServer
**File**: `/packages/server/src/index.ts`

Dedicated server instance.

```typescript
interface DedicatedServer {
  start(): Promise<void>
  stop(): void

  kickClient(clientId: number, reason: string): void
  changeMap(mapName: string): void
  setServerInfo(key: string, value: string): void

  getClients(): ServerClient[]
  getServerInfo(): ServerInfo

  isRunning(): boolean

  // Events
  onClientConnected?: (clientId: number, userinfo: string) => void
  onClientDisconnected?: (clientId: number) => void
  onError?: (error: Error) => void
}

interface ServerClient {
  id: number
  name: string
  ping: number
  frags: number
  state: ClientState
  userinfo: Record<string, string>
}

enum ClientState {
  Free,          // Slot available
  Zombie,        // Disconnected but not cleaned up
  Connected,     // Connected but not spawned
  Spawned        // Active in game
}

interface ServerInfo {
  hostname: string
  mapname: string
  maxclients: number
  protocol: number
  deathmatch: boolean
  coop: boolean
  skill: number
}
```

---

### Network Types

#### NetworkMessage
**File**: `/packages/shared/src/net/message.ts`

Network message structure.

```typescript
interface NetworkMessage {
  type: MessageType
  reliable: boolean
  data: Uint8Array
}

enum MessageType {
  ServerData,        // Initial connection data
  ConfigString,      // Update configstring
  Baseline,          // Entity baseline
  Frame,             // Server frame update
  PlayerInfo,        // Player state update
  PacketEntities,    // Entity state updates
  Sound,             // Sound event
  Print,             // Text message
  Disconnect,        // Disconnect notification
  UserCommand,       // Client input
  StringCommand      // Console command
}
```

---

## Appendix: Common Value Ranges

### Movement Speeds
- **Walk**: 300 units/second
- **Run**: 320 units/second (default)
- **Crouch**: 160 units/second
- **Water**: 240 units/second
- **Spectator**: 400 units/second
- **Jump Velocity**: 270 units/second (vertical)

### Physics Constants
- **Gravity**: 800 units/second² (default)
- **Stop Speed**: 100 units/second (minimum to slide)
- **Friction**: 6.0 (ground deceleration)
- **Accelerate**: 10.0 (ground acceleration)
- **Air Accelerate**: 1.0 (air control)
- **Max Velocity**: 3000 units/second (hard cap)
- **Step Height**: 18 units

### Timing
- **Simulation Tick**: 25ms (40Hz)
- **Render Frame**: 16.67ms (60 FPS target)
- **Demo Frame**: 100ms (10 FPS default)
- **Pain Debounce**: 300ms
- **Teleport Freeze**: 500ms
- **Air Finished**: 12 seconds (drowning timer)

### Damage Values
- **Blaster**: 15 damage
- **Shotgun**: 4 damage × 12 pellets = 48 max
- **Super Shotgun**: 6 damage × 20 pellets = 120 max
- **Machinegun**: 8 damage per bullet
- **Chaingun**: 8 damage per bullet, 10 bullets/second
- **Grenade**: 120 damage (direct), 120 radius
- **Rocket**: 120 damage (direct), 120 radius
- **Railgun**: 150 damage
- **BFG**: 200 damage (direct), 1000 damage (laser grid)

### Health and Armor
- **Starting Health**: 100
- **Max Health**: 200 (with megahealth)
- **Health Pickup**: 10-25
- **Megahealth**: +100 (decays to 100)
- **Starting Armor**: 0
- **Max Armor**: 200
- **Armor Shard**: +2
- **Jacket Armor**: 25 (30% protection)
- **Combat Armor**: 50 (50% protection)
- **Body Armor**: 100 (80% protection)

### Attenuation Distances
- **ATTN_NONE**: Infinite (full volume everywhere)
- **ATTN_NORM**: 1000 units (normal sounds)
- **ATTN_IDLE**: 2000 units (idle/ambient)
- **ATTN_STATIC**: 500 units (machinery, static)

---

## Summary

This document provides comprehensive type definitions for the quake2ts library. Use it as a reference when:

1. **Integrating the Library**: Understand structure of data passed to/from library APIs
2. **Debugging**: Inspect entity state, player state, and game state
3. **Extending**: Create custom entities, weapons, or game modes
4. **Optimization**: Understand memory layout and data flow

For usage patterns and API details, see `usage.md`.
For remaining work and tasks, see `section-17.md`.
