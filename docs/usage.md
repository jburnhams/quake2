# Quake2ts Library Usage Guide

## Overview

The quake2ts library is a complete TypeScript port of Quake II designed to be used as a library in web applications. It handles all game logic, rendering, physics, and asset management, while the web application provides UI, file I/O, and user interaction.

This guide explains the architecture, core concepts, and API usage patterns for developers integrating this library into their applications.

**Target Audience**: Skilled developers new to the Quake II codebase and game engine architecture.

**Related Documents**:
- `data-structures.md`: Detailed type definitions and interfaces
- `section-17.md`: Remaining tasks for library completion

---

## Architecture

### Monorepo Structure

The library is organized as a pnpm monorepo with the following packages:

```
packages/
├── shared/      Browser-agnostic utilities (math, physics, protocol)
├── engine/      Platform layer (rendering, audio, assets, I/O)
├── game/        Authoritative game simulation (entities, physics, combat)
├── client/      Client-side systems (prediction, HUD, input, demo playback)
├── cgame/       Client game module (visual effects, HUD rendering)
├── server/      Network server implementation (multiplayer)
└── tools/       Asset validation and development tools
```

### Package Dependencies

```
┌─────────┐
│  shared │  ← Base math, protocol, pmove (pure functions)
└────┬────┘
     │
     ├──────────┬────────────┬──────────────┐
     │          │            │              │
┌────▼────┐ ┌──▼───┐   ┌────▼─────┐   ┌───▼────┐
│ engine  │ │ game │   │  client  │   │ server │
└────┬────┘ └──┬───┘   └────┬─────┘   └────────┘
     │         │            │
     │         └────────────┤
     │                      │
  ┌──▼──────────────────────▼──┐
  │        cgame               │
  └────────────────────────────┘
```

**Dependency Rules**:
- `shared` has no dependencies (pure utilities)
- `game` depends only on `shared` (deterministic simulation)
- `client` depends on `shared` and `engine`
- `cgame` depends on `shared`, `client`, and `engine`
- `engine` handles platform-specific code (WebGL, WebAudio, FileReader)

### Core Design Principles

1. **Deterministic Simulation**: Game logic runs at fixed 40Hz with input buffering
2. **Client Prediction**: Shared movement code ensures smooth gameplay despite network latency
3. **Asset Agnostic**: All assets provided by web app via PAK files (no bundled assets)
4. **Rendering Flexibility**: Supports both WebGL rendering and headless mode
5. **Event-Driven**: Web app receives callbacks for state changes, not polling-based
6. **Type-Safe**: Full TypeScript with strict mode for compile-time safety

---

## Core Concepts

### Virtual File System (VFS)

The VFS provides a unified interface to assets stored in PAK files. Multiple PAK files can be mounted with later PAKs overriding earlier ones (mod support).

**Key Classes**:
- `PakArchive`: Represents a single PAK file loaded from ArrayBuffer
- `VirtualFileSystem`: Manages multiple mounted PAKs with lookup and enumeration

**Asset Path Normalization**:
- All paths are lowercase
- Backslashes converted to forward slashes
- Relative to PAK root (no leading slash)

**Files Loaded**: `/packages/engine/src/assets/pak.ts`, `/packages/engine/src/assets/vfs.ts`

### Asset Management

The `AssetManager` provides caching and lazy loading for all asset types. It sits above the VFS and handles format conversion.

**Supported Formats**:
- **Maps**: BSP (geometry, lightmaps, visibility, entities)
- **Models**: MD2 (frame-based animation), MD3 (skeletal animation with tags)
- **Textures**: WAL (palettized), PCX (image), TGA (true color)
- **Audio**: WAV (PCM), OGG Vorbis (compressed)
- **Text**: Entity definitions, config files

**Caching Strategy**:
- LRU eviction with configurable limits
- Separate caches for textures, models, sounds
- Optional IndexedDB persistence for audio (large files)

**Files Located**: `/packages/engine/src/assets/manager.ts`

### Rendering Pipeline

The rendering system supports two modes:

1. **WebGL Mode**: Full 3D rendering with lighting, particles, HUD
2. **Headless Mode**: Parses assets without GPU upload (for analysis/tools)

**Rendering Stages**:
1. **Culling**: PVS + frustum culling to determine visible surfaces/entities
2. **Opaque Pass**: BSP surfaces, models (sorted front-to-back)
3. **Skybox Pass**: Cubemap rendering
4. **Transparent Pass**: Particles, effects (sorted back-to-front)
5. **HUD Pass**: 2D overlay (orthographic projection)

**Pipelines**:
- `BspSurfacePipeline`: Renders BSP geometry with lightmaps
- `Md2Pipeline`: Renders frame-interpolated MD2 models
- `Md3Pipeline`: Renders tag-interpolated MD3 models
- `SkyboxPipeline`: Renders skybox cubemap
- `ParticleRenderer`: Billboard particles with depth sorting

**Files Located**: `/packages/engine/src/render/renderer.ts`, `/packages/engine/src/render/pipelines/`

### Game Simulation

The game simulation is the authoritative source of truth, running at fixed 40Hz (25ms per frame). It uses deterministic physics and handles all entity logic.

**Simulation Loop**:
1. **Input Collection**: Gather user commands from client
2. **Physics Step**: Update entity positions, velocities, collisions
3. **Entity Think**: Execute per-entity AI and behavior
4. **Collision Response**: Handle triggers, damage, pickups
5. **Snapshot Generation**: Create state snapshot for client rendering

**Entity Lifecycle**:
1. **Spawn**: Allocate entity from pool, set initial state
2. **Initialize**: Call spawn function based on classname
3. **Link**: Register with spatial grid for collision detection
4. **Think**: Execute per-frame logic (movement, AI, timers)
5. **Free**: Return to pool when removed

**Files Located**: `/packages/game/src/index.ts`, `/packages/game/src/entities/`

### Client Prediction

Client prediction eliminates perceived input lag by running the same physics locally and correcting when server state arrives.

**Prediction Flow**:
1. Client sends input to server
2. Client simulates locally using same `pmove` function as server
3. Server processes input and sends authoritative state
4. Client compares local prediction to server state
5. If mismatch, client replays from server state with buffered inputs

**Why It Works**: The `pmove` function in `/packages/shared/src/pmove/` is pure and deterministic, so identical inputs produce identical outputs on client and server.

**Files Located**: `/packages/client/src/prediction.ts`, `/packages/shared/src/pmove/`

### Time Management

The library uses three time representations:

1. **Simulation Time**: Game time in 40Hz frames (integer frame count)
2. **Render Time**: Continuous time in milliseconds for interpolation
3. **Demo Time**: Recorded time in demo files (frame-based)

**Fixed Timestep Loop**:
- Accumulates elapsed time since last frame
- Runs simulation in fixed 25ms steps until caught up
- Calculates interpolation alpha for smooth rendering between steps
- Prevents spiral of death with max accumulated time cap

**Files Located**: `/packages/engine/src/loop/fixedTimestep.ts`

---

## Package-by-Package API Guide

### @quake2ts/shared

Pure utility functions with no external dependencies. Safe to use in workers, server, client.

#### Math (`/packages/shared/src/math/`)

**vec3 Operations**:
```typescript
vec3.create(): Vec3
vec3.fromValues(x: number, y: number, z: number): Vec3
vec3.add(out: Vec3, a: Vec3, b: Vec3): Vec3
vec3.subtract(out: Vec3, a: Vec3, b: Vec3): Vec3
vec3.scale(out: Vec3, v: Vec3, s: number): Vec3
vec3.dot(a: Vec3, b: Vec3): number
vec3.cross(out: Vec3, a: Vec3, b: Vec3): Vec3
vec3.length(v: Vec3): number
vec3.normalize(out: Vec3, v: Vec3): Vec3
vec3.distance(a: Vec3, b: Vec3): number
vec3.lerp(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3
```

**mat4 Operations**:
```typescript
mat4.create(): Mat4
mat4.identity(out: Mat4): Mat4
mat4.multiply(out: Mat4, a: Mat4, b: Mat4): Mat4
mat4.perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number): Mat4
mat4.lookAt(out: Mat4, eye: Vec3, center: Vec3, up: Vec3): Mat4
mat4.translate(out: Mat4, m: Mat4, v: Vec3): Mat4
mat4.rotate(out: Mat4, m: Mat4, rad: number, axis: Vec3): Mat4
mat4.fromRotationTranslation(out: Mat4, q: Quat, v: Vec3): Mat4
```

**Angle Utilities**:
```typescript
angleVectors(angles: Vec3, forward?: Vec3, right?: Vec3, up?: Vec3): void
anglesToQuaternion(angles: Vec3, out: Quat): Quat
quaternionToAngles(q: Quat, out: Vec3): Vec3
normalizeAngle(angle: number): number  // Clamps to [-180, 180]
shortestRotation(from: number, to: number): number
```

**Files Located**: `/packages/shared/src/math/`

#### Player Movement (`/packages/shared/src/pmove/`)

The `pmove` system handles all player physics: walking, jumping, swimming, flying, ladder climbing.

**Primary Function**:
```typescript
applyPmove(
  state: PlayerMoveState,
  cmd: UserCommand,
  trace: (start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3) => TraceResult,
  pointContents: (point: Vec3) => number
): PlayerMoveState
```

**Parameters**:
- `state`: Current player position, velocity, view angles, flags
- `cmd`: User input (forward/side/up move, button states)
- `trace`: Collision detection callback (provided by game/engine)
- `pointContents`: World contents query callback (water, lava, solid, etc.)

**Returns**: New player state after 24ms of simulation (24 1ms submoves)

**Move Types**:
- `PM_NORMAL`: Standard walking with gravity
- `PM_FLY`: Noclip-style free flight
- `PM_SPECTATOR`: Observer mode with acceleration
- `PM_DEAD`: No control, gravity only
- `PM_GIB`: Tumbling death animation

**Movement Features**:
- Ground detection with slope tolerance
- Stair climbing (configurable step height)
- Water buoyancy and friction
- Air control with strafe jumping
- Crouch collision adjustment
- Ground friction and acceleration curves

**Files Located**: `/packages/shared/src/pmove/pmove.ts`, `/packages/shared/src/pmove/movement.ts`

#### Protocol (`/packages/shared/src/protocol/`)

Network protocol definitions and serialization utilities.

**Entity State**:
```typescript
interface EntityState {
  number: number              // Entity ID
  origin: Vec3               // World position
  angles: Vec3               // Rotation (pitch, yaw, roll)
  old_origin: Vec3           // For interpolation
  modelindex: number         // Model reference
  modelindex2: number        // Weapon model
  modelindex3: number        // Second weapon model
  modelindex4: number        // Extra model slot
  frame: number              // Animation frame
  skinnum: number            // Model skin index
  effects: number            // Visual effect flags
  renderfx: number           // Render flags (glow, fullbright, etc.)
  solid: number              // Collision type
  sound: number              // Looping sound index
  event: number              // One-shot event code
}
```

**Player State**:
```typescript
interface PlayerState {
  pmove: PlayerMoveState     // Physics state
  viewangles: Vec3           // Camera orientation
  viewoffset: Vec3           // Eye position offset from origin
  kick_angles: Vec3          // Damage view kick
  gunangles: Vec3            // View weapon rotation
  gunoffset: Vec3            // View weapon position
  gunindex: number           // Current weapon model
  gunframe: number           // Weapon animation frame
  blend: [number, number, number, number]  // Screen blend RGBA
  fov: number                // Field of view
  rdflags: number            // Render flags
  stats: number[]            // HUD stats (health, ammo, armor, etc.)
}
```

**User Command**:
```typescript
interface UserCommand {
  msec: number               // Duration of this command
  buttons: number            // Button bitfield (attack, jump, crouch, etc.)
  angles: Vec3               // Desired view angles
  forwardmove: number        // Forward/backward input (-400 to 400)
  sidemove: number           // Left/right strafe input (-400 to 400)
  upmove: number             // Jump/crouch input (-200 to 200)
  impulse: number            // Weapon switch impulse
  lightlevel: number         // Ambient light at player (for muzzle flash)
}
```

**Configstrings**: Global server state strings indexed by purpose
- `CS_NAME` (0): Map name
- `CS_CDTRACK` (1): Music track number
- `CS_SKY` (2): Skybox name
- `CS_SKYAXIS` (3): Skybox rotation
- `CS_SKYROTATE` (4): Skybox rotation speed
- `CS_STATUSBAR` (5): HUD layout string
- `CS_MAXCLIENTS` (30): Max players
- `CS_MODELS` (32-287): Model names (256 slots)
- `CS_SOUNDS` (288-543): Sound names (256 slots)
- `CS_IMAGES` (544-799): Image names (256 slots)
- `CS_LIGHTS` (800-1055): Light style patterns (256 slots)
- `CS_ITEMS` (1056-1311): Item names (256 slots)
- `CS_PLAYERSKINS` (1312-1567): Player model/skin combos (256 slots)
- `CS_GENERAL` (1568-2079): General purpose strings (512 slots)

**Files Located**: `/packages/shared/src/protocol/`

### @quake2ts/engine

Platform-specific code for rendering, audio, and asset loading.

#### Asset Ingestion (`/packages/engine/src/assets/`)

**PAK Loading**:
```typescript
class PakArchive {
  constructor(buffer: ArrayBuffer)

  readFile(normalizedPath: string): Uint8Array | null
  list(): string[]
  has(normalizedPath: string): boolean
  getEntries(): PakDirectoryEntry[]
}

async function ingestPakFiles(
  sources: PakSource[],
  onProgress?: (progress: IngestionProgress) => void
): Promise<VirtualFileSystem>

interface PakSource {
  name: string
  data: ArrayBuffer
}

interface IngestionProgress {
  filesProcessed: number
  totalFiles: number
  currentFile: string
  percentComplete: number
}
```

**Browser Utilities**:
```typescript
function wireFileInput(
  input: HTMLInputElement,
  onFiles: (sources: PakSource[]) => void
): void

function wireDropTarget(
  element: HTMLElement,
  onFiles: (sources: PakSource[]) => void
): void

async function filesToPakSources(files: FileList | File[]): Promise<PakSource[]>
```

**Virtual File System**:
```typescript
class VirtualFileSystem {
  mountPak(pak: PakArchive): void
  unmountPak(pak: PakArchive): void

  readFile(path: string): Uint8Array | null
  readTextFile(path: string): string | null
  exists(path: string): boolean

  list(directory?: string): string[]
  findByExtension(extensions: string[]): string[]
}
```

**Asset Manager**:
```typescript
class AssetManager {
  constructor(vfs: VirtualFileSystem)

  async loadTexture(path: string): Promise<PreparedTexture>
  async loadModel(path: string): Promise<Md2Model | Md3Model>
  async loadSound(path: string): Promise<AudioBuffer>
  async getMap(name: string): Promise<BspMap>

  // Synchronous cache lookups (if already loaded)
  getTextureSync(path: string): PreparedTexture | null
  getModelSync(path: string): Md2Model | Md3Model | null
  getSoundSync(path: string): AudioBuffer | null

  clearCache(type?: AssetType): void
}

enum AssetType {
  Texture,
  Model,
  Sound,
  Map
}

interface PreparedTexture {
  width: number
  height: number
  data: Uint8Array  // RGBA format
  mipmaps?: Uint8Array[]
}
```

**Files Located**: `/packages/engine/src/assets/`

#### Rendering (`/packages/engine/src/render/`)

**Renderer Initialization**:
```typescript
class Renderer {
  constructor(gl: WebGL2RenderingContext, assetManager: AssetManager)

  renderFrame(options: RenderOptions, entities: RenderEntity[]): void
  shutdown(): void

  // HUD methods (for 2D rendering)
  registerPic(name: string): number
  drawPic(x: number, y: number, name: string): void
  drawStretchPic(x: number, y: number, w: number, h: number, name: string): void
  drawChar(x: number, y: number, char: number): void
  drawString(x: number, y: number, text: string): void
  drawFill(x: number, y: number, w: number, h: number, color: Color): void

  // Performance queries
  getStatistics(): RenderStatistics
}

interface RenderOptions {
  camera: Camera
  mapName: string
  fov: number
  time: number
  frameTime: number
  rdflags: number
  blend: [number, number, number, number]
  refdef?: RefDef
}

interface RenderEntity {
  origin: Vec3
  angles: Vec3
  model?: string
  frame: number
  oldframe?: number
  backlerp?: number  // Interpolation (0 = frame, 1 = oldframe)
  skin?: number
  flags?: number
  alpha?: number
}

interface RenderStatistics {
  frameTimeMs: number
  drawCalls: number
  triangles: number
  vertices: number
  textureBinds: number
  visibleSurfaces: number
  culledSurfaces: number
}
```

**Camera**:
```typescript
class Camera {
  position: Vec3
  rotation: Vec3  // Pitch, yaw, roll in degrees
  fov: number
  aspectRatio: number
  nearPlane: number
  farPlane: number

  getViewMatrix(): Mat4
  getProjectionMatrix(): Mat4
  getViewProjectionMatrix(): Mat4
  getFrustumPlanes(): Plane[]
}
```

**Particle System**:
```typescript
class ParticleSystem {
  spawn(params: ParticleSpawnParams): void
  update(deltaTimeMs: number): void
  clear(): void
}

interface ParticleSpawnParams {
  origin: Vec3
  velocity: Vec3
  acceleration: Vec3
  color: Color
  alpha: number
  size: number
  lifetime: number
  count: number
}

// Convenience spawn functions
function spawnBlood(origin: Vec3, normal: Vec3): void
function spawnBulletImpact(origin: Vec3, normal: Vec3): void
function spawnExplosion(origin: Vec3, scale: number): void
function spawnMuzzleFlash(origin: Vec3, angles: Vec3): void
```

**Files Located**: `/packages/engine/src/render/`

#### Audio System (`/packages/engine/src/audio/`)

**Audio API**:
```typescript
interface AudioAPI {
  sound(
    entity: number,
    channel: number,
    soundIndex: number,
    volume: number,
    attenuation: number,
    timeOffset: number
  ): void

  positioned_sound(
    origin: Vec3,
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

**Audio System**:
```typescript
class AudioSystem implements AudioAPI {
  constructor(
    audioContext: AudioContext,
    soundRegistry: SoundRegistry
  )

  update(entities: EntityState[], camera: Camera): void
  setMasterVolume(volume: number): void
  shutdown(): void
}

class SoundRegistry {
  async registerSound(index: number, path: string, vfs: VirtualFileSystem): Promise<void>
  getSound(index: number): AudioBuffer | null
  clear(): void
}
```

**Channel Management**:
- 32 total sound channels (configurable via `MAX_SOUND_CHANNELS`)
- LRU eviction when all channels busy
- Per-entity channel limits (e.g., footsteps limited to 1 per entity)
- Automatic 3D spatialization for positioned sounds
- Distance culling (sounds beyond attenuation range not played)

**Files Located**: `/packages/engine/src/audio/`

#### Game Loop (`/packages/engine/src/loop/`)

**Fixed Timestep Loop**:
```typescript
class FixedTimestepLoop {
  constructor(
    callbacks: {
      simulate: (deltaTimeMs: number) => void
      render: (alpha: number) => void
    },
    options: {
      tickRate: number      // Hz (typically 40)
      startTimeMs: number   // performance.now()
    }
  )

  start(): void
  stop(): void
  pump(elapsedMs: number): void

  isRunning(): boolean
  getSimulationTime(): number
}
```

**Usage Pattern**:
- Call `pump()` from `requestAnimationFrame` with `performance.now()`
- Loop accumulates time and calls `simulate()` in fixed steps
- Calculates interpolation alpha between steps for smooth rendering
- Calls `render(alpha)` once per frame with interpolation value
- Handles spiral of death by capping accumulated time

**Files Located**: `/packages/engine/src/loop/fixedTimestep.ts`

### @quake2ts/game

Authoritative game simulation running at 40Hz.

#### Game Factory (`/packages/game/src/index.ts`)

**Create Game**:
```typescript
function createGame(
  imports: Partial<GameImports>,
  engine: GameEngine,
  options: GameCreateOptions
): GameExports

interface GameImports {
  trace(start: Vec3, mins: Vec3, maxs: Vec3, end: Vec3, passent: Entity | null, contentmask: number): GameTraceResult
  pointcontents(point: Vec3): number

  multicast(origin: Vec3, to: MulticastType, event: string, ...args: any[]): void
  unicast(entity: Entity, reliable: boolean, event: string, ...args: any[]): void

  configstring(index: number, value: string): void
  serverCommand(cmd: string): void

  soundIndex(name: string): number
  modelIndex(name: string): number
  imageIndex(name: string): number

  linkentity(entity: Entity): void
  unlinkentity(entity: Entity): void
}

interface GameEngine {
  vfs: VirtualFileSystem
  assetManager: AssetManager
}

interface GameCreateOptions {
  maxClients: number
  deathmatch: boolean
  coop: boolean
  skill: number
}

interface GameExports {
  init(): void
  shutdown(): void

  frame(step: number, cmd: UserCommand): void
  snapshot(): GameStateSnapshot

  clientConnect(playernum: number, userinfo: string): boolean
  clientBegin(playernum: number): void
  clientUserinfoChanged(playernum: number, userinfo: string): void
  clientDisconnect(playernum: number): void
  clientCommand(playernum: number): void
  clientThink(playernum: number, cmd: UserCommand): void

  entities: EntitySystem
  level: LevelState
}
```

**Game State Snapshot**:
```typescript
interface GameStateSnapshot {
  time: number
  playerState: PlayerState
  entities: EntityState[]
  events: GameEvent[]
}

interface GameEvent {
  type: string
  entityId: number
  data: any
}
```

#### Entity System (`/packages/game/src/entities/`)

**Entity Management**:
```typescript
class EntitySystem {
  spawn(): Entity
  free(entity: Entity): void

  find(predicate: (entity: Entity) => boolean): Entity | null
  findAll(predicate: (entity: Entity) => boolean): Entity[]
  findByClassname(classname: string): Entity[]
  findByTargetname(targetname: string): Entity[]
  findInRadius(origin: Vec3, radius: number): Entity[]

  finalizeSpawn(entity: Entity): void
}
```

**Entity Class**:
```typescript
class Entity {
  // Identity
  id: number
  classname: string
  spawnflags: number

  // Spatial
  origin: Vec3
  angles: Vec3
  velocity: Vec3
  avelocity: Vec3

  // Collision
  mins: Vec3
  maxs: Vec3
  absmin: Vec3  // World-space bounds (computed)
  absmax: Vec3
  size: Vec3
  solid: SolidType
  clipmask: number

  // Physics
  movetype: MoveType
  mass: number
  gravity: number
  groundentity: Entity | null
  groundentity_linkcount: number

  // Model
  model: string
  modelindex: number
  modelindex2: number
  frame: number

  // Behavior
  think: (() => void) | null
  nextthink: number
  touch: ((other: Entity, plane: Plane, surf: Surface) => void) | null
  use: ((activator: Entity) => void) | null
  pain: ((attacker: Entity, damage: number) => void) | null
  die: ((inflictor: Entity, attacker: Entity, damage: number) => void) | null

  // Targets
  target: string
  targetname: string
  killtarget: string
  team: string
  pathtarget: string
  deathtarget: string

  // Health
  health: number
  max_health: number
  deadflag: number
  takedamage: number
  dmg: number

  // Sounds
  noise_index: number

  // Effects
  effects: number
  renderfx: number
}

enum MoveType {
  NONE,      // No movement
  NOCLIP,    // No collision, fly through walls
  PUSH,      // Brush model, pushes players
  STOP,      // Stationary, no physics
  WALK,      // Walking with gravity
  STEP,      // Walking with step climbing
  FLY,       // Flying with gravity
  TOSS,      // Thrown item with bounce
  FLYMISSILE, // Flying projectile, no bounce
  BOUNCE     // Bouncing projectile
}

enum SolidType {
  NOT,       // No collision
  TRIGGER,   // Touch triggers only
  BBOX,      // Axis-aligned bounding box
  BSP        // Brush model (complex geometry)
}
```

**Entity Spawn Registry**:
```typescript
function registerEntitySpawn(classname: string, factory: (entity: Entity) => void): void
function getEntitySpawnFunction(classname: string): ((entity: Entity) => void) | null
```

**Common Entity Spawn Functions** (examples):
- `SP_info_player_start`: Player spawn point
- `SP_info_player_deathmatch`: Deathmatch spawn
- `SP_func_door`: Sliding/rotating door
- `SP_func_button`: Activatable button
- `SP_trigger_multiple`: Repeatable trigger volume
- `SP_trigger_once`: Single-use trigger
- `SP_weapon_*`: Weapon pickups
- `SP_item_*`: Item pickups (health, armor, ammo)
- `SP_monster_*`: Enemy entities

**Files Located**: `/packages/game/src/entities/`

#### Physics (`/packages/game/src/physics/`)

**Collision Trace**:
```typescript
interface GameTraceResult {
  allsolid: boolean      // Started in solid
  startsolid: boolean    // Started in solid
  fraction: number       // Distance traveled (0.0 - 1.0)
  endpos: Vec3          // Final position
  plane: Plane          // Surface plane hit
  surface: Surface      // Surface material
  contents: number      // Contents at endpoint
  ent: Entity | null    // Entity hit (if any)
}

interface Plane {
  normal: Vec3
  dist: number
  type: number
  signbits: number
}

interface Surface {
  name: string
  flags: number
  value: number
}
```

**Damage System**:
```typescript
function T_Damage(
  target: Entity,
  inflictor: Entity,
  attacker: Entity,
  dir: Vec3,
  point: Vec3,
  normal: Vec3,
  damage: number,
  knockback: number,
  dflags: number,
  mod: MeansOfDeath
): void

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
  HIT,
  TARGET_BLASTER
}
```

**Files Located**: `/packages/game/src/physics/`, `/packages/game/src/combat/`

### @quake2ts/client

Client-side prediction, HUD, input, and demo playback.

#### Client Factory (`/packages/client/src/index.ts`)

**Create Client**:
```typescript
function createClient(imports: ClientImports): ClientExports

interface ClientImports {
  engine: {
    renderer: Renderer
    vfs: VirtualFileSystem
    assetManager: AssetManager
    cmd?: CommandExecutor
  }
  host?: EngineHost
}

interface ClientExports {
  Init(): void
  Shutdown(): void

  render(sample: GameRenderSample): void
  handleInput(key: string, down: boolean): void

  startDemoPlayback(buffer: Uint8Array, filename: string): void
  stopDemoPlayback(): void
  getDemoController(): DemoPlaybackController | null

  startRecording(filename: string): void
  stopRecording(): Uint8Array | null

  toggleMenu(): void
  isMenuActive(): boolean

  prediction: ClientPrediction
  lastRendered: PredictionState
  view: ViewState
  camera: Camera

  ParseConfigString(index: number, str: string): void
  ParseCenterPrint(str: string): void
  NotifyMessage(msg: string): void
}

interface GameRenderSample {
  time: number
  playerState: PlayerState
  entities: EntityState[]
  configstrings: Map<number, string>
}
```

#### Input Handling (`/packages/client/src/input/`)

**Input Controller**:
```typescript
class InputController {
  constructor(bindings: KeyBindings)

  handleKeyDown(key: string): void
  handleKeyUp(key: string): void
  handleMouseMove(deltaX: number, deltaY: number): void
  handleMouseDown(button: number): void
  handleMouseUp(button: number): void

  generateUserCommand(deltaTimeMs: number): UserCommand

  setBinding(action: string, keys: string[]): void
  getBindings(): KeyBindings
}

interface KeyBindings {
  [action: string]: string[]
}

// Default actions:
// "+forward", "+back", "+moveleft", "+moveright"
// "+lookup", "+lookdown", "+left", "+right"
// "+attack", "+use", "+jump", "+crouch"
// "weapon1" - "weapon9", "nextweapon", "prevweapon"
```

**Files Located**: `/packages/client/src/input/`

#### Demo Playback (`/packages/client/src/demo/`)

**Demo Playback Controller**:
```typescript
class DemoPlaybackController {
  constructor(demoData: Uint8Array, filename: string)

  play(): void
  pause(): void
  stop(): void

  stepForward(frames?: number): void
  stepBackward(frames?: number): void

  seekToFrame(frameIndex: number): void
  seekToTime(timeSeconds: number): void

  setSpeed(multiplier: number): void  // 0.1 - 16.0
  getSpeed(): number

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

**Demo Recording**:
```typescript
class DemoRecorder {
  startRecording(filename: string): void
  recordMessage(msg: Uint8Array): void
  stopRecording(): Uint8Array

  isRecording(): boolean
  getDuration(): number
  getSize(): number
}
```

**Files Located**: `/packages/client/src/demo/`

#### Client Prediction (`/packages/client/src/prediction.ts`)

**Prediction System**:
```typescript
class ClientPrediction {
  constructor(trace: TraceFunction, pointContents: PointContentsFunction)

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

**Files Located**: `/packages/client/src/prediction.ts`

### @quake2ts/cgame

Client game module for HUD and visual effects.

#### CGame API (`/packages/cgame/src/index.ts`)

**CGame Factory**:
```typescript
function GetCGameAPI(imports: CGameImport): CGameExport

interface CGameImport {
  Cvar_Get(name: string, defaultValue: string, flags: number): Cvar
  Com_Print(msg: string): void
  CL_ClientTime(): number
  PM_Trace(start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3): PmoveTraceResult
}

interface CGameExport {
  Init(): void
  Shutdown(): void

  DrawHUD(
    splitIndex: number,
    data: HudRenderData,
    hud_vrect: Rect,
    hud_safe: Rect,
    scale: number,
    playernum: number,
    ps: PlayerState
  ): void

  ParseConfigString(index: number, str: string): void
  ParseCenterPrint(str: string): void
  NotifyMessage(msg: string): void

  Pmove(pmoveInfo: PmoveInfo): PredictionState
}

interface HudRenderData {
  drawPic(x: number, y: number, pic: string): void
  drawStretchPic(x: number, y: number, w: number, h: number, pic: string): void
  drawChar(x: number, y: number, char: number, scale: number): void
  drawString(x: number, y: number, str: string, scale: number): void
  drawFill(x: number, y: number, w: number, h: number, color: Color): void
}
```

**Files Located**: `/packages/cgame/src/`

### @quake2ts/server

Network server for multiplayer hosting.

#### Server Factory (`/packages/server/src/index.ts`)

**Create Server**:
```typescript
function createDedicatedServer(options: ServerOptions): DedicatedServer

interface ServerOptions {
  maxClients: number
  hostname: string
  mapName: string
  deathmatch: boolean
  skill: number
  port: number
  tickRate: number  // Default 40Hz
}

interface DedicatedServer {
  start(): Promise<void>
  stop(): void

  kickClient(clientId: number, reason: string): void
  changeMap(mapName: string): void

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
}

enum ClientState {
  Free,
  Zombie,
  Connected,
  Spawned
}
```

**Files Located**: `/packages/server/src/`

---

## Common Integration Patterns

### Pattern 1: PAK Browser

**Objective**: Load PAK files and display directory tree with file metadata.

**Steps**:
1. Wire file input or drop target with `wireFileInput()` or `wireDropTarget()`
2. Convert File objects to PakSource with `filesToPakSources()`
3. Ingest PAK files with `ingestPakFiles()`, receiving VirtualFileSystem
4. Query VFS with `list()`, `exists()`, `readFile()`
5. Display file tree in UI

**Key APIs**:
- `ingestPakFiles(sources, onProgress)`
- `VirtualFileSystem.list(directory)`
- `VirtualFileSystem.readFile(path)`

### Pattern 2: Map Viewer

**Objective**: Load BSP map and render with free camera control.

**Steps**:
1. Load PAK files (see Pattern 1)
2. Create AssetManager from VFS
3. Load map with `assetManager.getMap(mapName)`
4. Initialize WebGL2 context
5. Create Renderer
6. Create Camera with initial position
7. Implement camera controller (WASD + mouse)
8. Run render loop with `renderer.renderFrame()`

**Key APIs**:
- `AssetManager.getMap(mapName)`
- `Renderer.renderFrame(options, entities)`
- `Camera` position/rotation setters

### Pattern 3: Demo Playback

**Objective**: Play demo file with timeline control.

**Steps**:
1. Load demo file as Uint8Array (from file input or PAK)
2. Create Client with `createClient(imports)`
3. Call `client.startDemoPlayback(demoData, filename)`
4. Get controller with `client.getDemoController()`
5. Wire UI controls to `controller.play()`, `pause()`, `seekToFrame()`, etc.
6. Listen to events: `onFrameUpdate`, `onTimeUpdate`, `onComplete`
7. Render each frame with `client.render(sample)`

**Key APIs**:
- `Client.startDemoPlayback(buffer, filename)`
- `DemoPlaybackController.play()`, `pause()`, `seekToFrame()`
- Event callbacks: `onFrameUpdate`, `onStateChange`

### Pattern 4: Single Player Game

**Objective**: Run full game simulation with rendering and input.

**Steps**:
1. Load PAK files
2. Create AssetManager and Renderer
3. Create Game with `createGame(imports, engine, options)`
4. Create Client with `createClient(imports)`
5. Initialize game with `game.init()`
6. Create InputController with default bindings
7. Create FixedTimestepLoop with simulate and render callbacks
8. In simulate callback: generate UserCommand, call `game.frame(step, cmd)`
9. In render callback: get snapshot with `game.snapshot()`, call `client.render(sample)`
10. Start loop with `loop.start()`

**Key APIs**:
- `createGame(imports, engine, options)`
- `createClient(imports)`
- `FixedTimestepLoop` constructor
- `InputController.generateUserCommand()`
- `Game.frame(step, cmd)`
- `Game.snapshot()`
- `Client.render(sample)`

### Pattern 5: Multiplayer Client

**Objective**: Connect to server and play multiplayer.

**Steps**:
1. Load PAK files
2. Create Client
3. Establish WebSocket connection to server
4. Handle server messages: configstrings, entity updates
5. Send input commands via WebSocket
6. Use client prediction to smooth local player movement
7. Render game state with interpolation

**Key APIs**:
- `createClient(imports)`
- `ClientPrediction.predict(serverState, commands, time)`
- WebSocket send/receive with network protocol
- `Client.render(sample)`

---

## Event System

The library uses callback-based events for asynchronous notifications. Register callbacks on objects for state change notifications.

### Common Event Patterns

**Asset Loading**:
```typescript
await ingestPakFiles(sources, (progress) => {
  console.log(`Loading: ${progress.percentComplete}%`)
})
```

**Demo Playback**:
```typescript
controller.onFrameUpdate = (frame) => {
  updateTimelineUI(frame)
}

controller.onStateChange = (state) => {
  if (state === PlaybackState.Finished) {
    showReplayButton()
  }
}
```

**Network Connection**:
```typescript
server.onClientConnected = (clientId, userinfo) => {
  console.log(`Player joined: ${userinfo}`)
}

server.onClientDisconnected = (clientId) => {
  console.log(`Player left: ${clientId}`)
}
```

---

## Best Practices

### Memory Management

**Cleanup on Unmount**:
Always call shutdown methods when tearing down:
```typescript
renderer.shutdown()
game.shutdown()
client.Shutdown()
audioSystem.shutdown()
```

**Cache Control**:
Clear caches when switching maps or modes:
```typescript
assetManager.clearCache(AssetType.Texture)
assetManager.clearCache(AssetType.Model)
```

**Entity Pooling**:
Entities are pooled internally. Always use `entities.free(entity)` rather than setting to null.

### Performance Optimization

**Rendering**:
- Enable PVS culling for large maps (enabled by default)
- Use frustum culling (enabled by default)
- Limit particle count in combat-heavy scenes
- Profile with `renderer.getStatistics()`

**Asset Loading**:
- Preload assets during loading screens with `assetManager.loadTexture()` etc.
- Use LRU cache limits to cap memory usage
- Load assets asynchronously to avoid blocking

**Simulation**:
- Keep simulation at 40Hz (do not increase tick rate without testing)
- Avoid heavy computation in entity think functions
- Use spatial queries (`findInRadius`) sparingly

### Error Handling

**Asset Loading Failures**:
All asset loading methods can fail (missing files, corrupt data). Handle errors:
```typescript
try {
  const map = await assetManager.getMap(mapName)
} catch (error) {
  console.error(`Failed to load map: ${error.message}`)
  showErrorMessage("Map not found")
}
```

**Network Failures**:
Handle connection errors and timeouts:
```typescript
server.onError = (error) => {
  console.error(`Server error: ${error.message}`)
  disconnect()
}
```

**Demo Playback Failures**:
Validate demo data before playback:
```typescript
controller.onError = (error) => {
  console.error(`Demo playback error: ${error.message}`)
  stopPlayback()
}
```

### Type Safety

**Leverage TypeScript**:
- Import types from packages: `import { Vec3, EntityState } from '@quake2ts/shared'`
- Use strict null checks to catch missing entities
- Validate user input before passing to library
- Use enums for flags and constants

**Avoid `any`**:
Prefer typed interfaces from data-structures.md over `any` types.

---

## Debugging

### Logging

Set console verbosity for library subsystems:
```typescript
// Most packages use console.log/warn/error
// Filter by package name in browser console
```

### Rendering Debug Views

Enable debug rendering options:
```typescript
const renderOptions: RenderOptions = {
  // ... normal options
  wireframe: true,           // Overlay wireframe
  showBounds: true,          // Draw entity bounding boxes
  cullingEnabled: false,     // Disable culling to see all geometry
}
```

### Performance Profiling

Use browser DevTools Performance tab to profile:
- Simulation time (should be <25ms per frame)
- Render time (should be <16ms for 60 FPS)
- Asset loading time

Use `renderer.getStatistics()` for frame-level metrics.

### Entity Inspection

Query entity state at runtime:
```typescript
const player = game.entities.findByClassname("player")[0]
console.log("Player position:", player.origin)
console.log("Player velocity:", player.velocity)
console.log("Player health:", player.health)
```

### Demo Analysis

Extract frame data for analysis:
```typescript
const controller = client.getDemoController()
for (let i = 0; i < controller.getFrameCount(); i++) {
  const frame = controller.getFrameData(i)
  console.log(`Frame ${i}: player at`, frame.playerState.pmove.origin)
}
```

---

## Limitations and Known Issues

### Current Limitations

1. **Expansion Packs**: Rogue and Xatrix content scaffolded but incomplete
2. **CTF Mode**: No capture-the-flag logic implemented
3. **Bot AI**: No bot support (multiplayer requires human players)
4. **Advanced Rendering**: No shadows, no advanced water effects, no bloom
5. **Audio Effects**: No reverb or environmental audio processing
6. **Console**: Partial cvar system, no full command execution
7. **Mod Support**: Limited custom entity/weapon registration

### Known Bugs

Refer to TODO comments in source:
- `/packages/client/src/index.ts`: Dynamic lights placeholder
- `/packages/game/src/combat/weapons/firing.ts`: NoAmmoWeaponChange incomplete
- `/packages/shared/src/protocol/writeUserCmd.ts`: Impulse field not populated

### Browser Compatibility

**Minimum Requirements**:
- WebGL2 support (Chrome 56+, Firefox 51+, Safari 15+)
- WebAudio API support (all modern browsers)
- ES2020 features (BigInt, optional chaining, nullish coalescing)

**Not Supported**:
- IE11 (no WebGL2)
- Safari < 15 (no WebGL2)
- Mobile browsers with WebGL restrictions (some Android browsers)

---

## Migration and Versioning

### Semantic Versioning

The library follows semver:
- **Major**: Breaking API changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, no API changes

### Breaking Change Policy

Breaking changes will be documented in CHANGELOG.md with migration guides.

---

## Appendix: Quick Reference

### Essential Imports

```typescript
// Math and utilities
import { vec3, mat4, Vec3, Mat4 } from '@quake2ts/shared'
import { applyPmove, PlayerMoveState, UserCommand } from '@quake2ts/shared'

// Asset management
import { PakArchive, VirtualFileSystem, ingestPakFiles } from '@quake2ts/engine'
import { AssetManager } from '@quake2ts/engine'

// Rendering
import { Renderer, Camera, RenderOptions } from '@quake2ts/engine'
import { ParticleSystem } from '@quake2ts/engine'

// Audio
import { AudioSystem, AudioAPI } from '@quake2ts/engine'

// Game simulation
import { createGame, GameImports, GameExports } from '@quake2ts/game'
import { Entity, EntitySystem } from '@quake2ts/game'

// Client
import { createClient, ClientImports, ClientExports } from '@quake2ts/client'
import { DemoPlaybackController, PlaybackState } from '@quake2ts/client'
import { InputController, KeyBindings } from '@quake2ts/client'

// Server
import { createDedicatedServer, ServerOptions } from '@quake2ts/server'

// CGame
import { GetCGameAPI, CGameImport, CGameExport } from '@quake2ts/cgame'

// Loop
import { FixedTimestepLoop } from '@quake2ts/engine'
```

### File Locations Quick Reference

| Feature | Package | File Path |
|---------|---------|-----------|
| PAK parsing | engine | `/packages/engine/src/assets/pak.ts` |
| VFS | engine | `/packages/engine/src/assets/vfs.ts` |
| Asset manager | engine | `/packages/engine/src/assets/manager.ts` |
| BSP loading | engine | `/packages/engine/src/assets/bsp.ts` |
| Renderer | engine | `/packages/engine/src/render/renderer.ts` |
| Camera | engine | `/packages/engine/src/render/camera.ts` |
| Audio system | engine | `/packages/engine/src/audio/system.ts` |
| Fixed timestep | engine | `/packages/engine/src/loop/fixedTimestep.ts` |
| Game factory | game | `/packages/game/src/index.ts` |
| Entity system | game | `/packages/game/src/entities/index.ts` |
| Physics/pmove | shared | `/packages/shared/src/pmove/pmove.ts` |
| Damage system | game | `/packages/game/src/combat/damage.ts` |
| Client factory | client | `/packages/client/src/index.ts` |
| Demo playback | client | `/packages/client/src/demo/playback.ts` |
| Input controller | client | `/packages/client/src/input/controller.ts` |
| Prediction | client | `/packages/client/src/prediction.ts` |
| Server factory | server | `/packages/server/src/index.ts` |
| CGame API | cgame | `/packages/cgame/src/index.ts` |

---

## Summary

The quake2ts library provides a complete Quake II implementation for web applications. Web apps handle UI and file I/O, while the library handles all game logic, rendering, physics, and audio.

**Key Takeaways**:
1. **Modular Design**: Packages separated by concern (shared, engine, game, client, server)
2. **Event-Driven**: Use callbacks for asynchronous state changes
3. **Fixed Timestep**: Game runs at 40Hz with interpolation for smooth rendering
4. **Asset Loading**: VFS abstracts PAK files, AssetManager handles caching
5. **Rendering Modes**: WebGL for full 3D, headless for analysis
6. **Demo Support**: Full record/playback with timeline control
7. **Multiplayer**: WebSocket-based networking with client prediction

For detailed type definitions, see `data-structures.md`.
For remaining work and roadmap, see `section-17.md`.
