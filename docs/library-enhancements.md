# Quake2TS Library Enhancement Requests

## Overview

This document outlines enhancement requests for the **quake2ts library** (v0.0.470) that would enable advanced features in the quake2ts-explorer application. These enhancements are organized by priority and categorized by library package.

**Target Audience**: Quake2TS library maintainers and contributors

**Requesting Application**: quake2ts-explorer (this web application)

**Purpose**: The application should be a thin wrapper over the library - complex game logic, rendering, and data processing should live in the library, while the application provides UI and user interaction.

---

## Priority Levels

- **P0 (Critical)**: Blocks major features (Sections 01-02: Single-player, Multiplayer)
- **P1 (High)**: Enables important features (Sections 03-06: Demos, Rendering, Analysis, Editor)
- **P2 (Medium)**: Nice-to-have improvements (Sections 07-09: Mods, UX, Performance)
- **P3 (Low)**: Optional enhancements

---

## Section 01: Single Player Game Mode

### Enhancement 1.1: Game State Serialization (P0)

**Package**: `@quake2ts/game`

**Methods Needed**:
```typescript
interface GameExports {
  // ... existing methods

  /**
   * Serialize current game state to JSON-compatible object
   * Enables save/load functionality
   */
  serialize(): SerializedGameState

  /**
   * Restore game state from serialized data
   * @param state Previously serialized game state
   */
  loadState(state: SerializedGameState): void
}

interface SerializedGameState {
  mapName: string
  playerState: PlayerState
  entities: SerializedEntity[]
  levelState: LevelState
  time: number
  // ... other necessary state
}
```

**Rationale**: Users need to save and load single-player games. Without serialization, progress is lost on page refresh.

**Workaround**: Manually save player position/inventory and restart map, but loses entity state.

---

### Enhancement 1.2: Admin/Cheat APIs (P1)

**Package**: `@quake2ts/game`

**Methods Needed**:
```typescript
interface GameExports {
  // ... existing methods

  /**
   * Enable/disable god mode for player
   */
  setGodMode(enabled: boolean): void

  /**
   * Enable/disable noclip (fly through walls)
   */
  setNoclip(enabled: boolean): void

  /**
   * Toggle AI awareness (notarget)
   */
  setNotarget(enabled: boolean): void

  /**
   * Give item to player
   * @param itemClassname e.g., "weapon_shotgun", "item_health"
   */
  giveItem(itemClassname: string): void

  /**
   * Damage player
   */
  damage(amount: number): void

  /**
   * Teleport player to position
   */
  teleport(origin: Vec3): void
}
```

**Rationale**: Console commands (Section 01, Task 6) need these APIs for developer testing and cheat codes.

**Workaround**: Direct entity manipulation if game instance is exposed, but fragile and library-internal.

---

## Section 02: Multiplayer Client

### Enhancement 2.1: Master Server Client (P1)

**Package**: `@quake2ts/client` or new `@quake2ts/net`

**API Needed**:
```typescript
/**
 * Query master server for list of active game servers
 */
async function queryMasterServer(
  masterUrl: string
): Promise<ServerInfo[]>

interface ServerInfo {
  name: string
  address: string  // WebSocket URL
  map: string
  players: number
  maxPlayers: number
  gamemode: string
  ping?: number
}
```

**Rationale**: Server browser (Section 02, Task 3) needs to discover servers. Hardcoded lists don't scale.

**Workaround**: Maintain community JSON file with server list, but requires manual updates.

---

### Enhancement 2.2: WebSocket Protocol Documentation (P0)

**Package**: `@quake2ts/shared` or docs

**Request**: Document the WebSocket protocol for client-server communication

**Contents**:
- Message format (binary, JSON, or mixed)
- Message types (snapshot, command, configstring, event)
- Handshake procedure
- Connection lifecycle
- Error codes

**Rationale**: Application needs to implement network client (Section 02, Task 1). Protocol currently undocumented.

**Workaround**: Reverse-engineer from library source, but time-consuming and error-prone.

---

### Enhancement 2.3: Spectator Mode APIs (P1)

**Package**: `@quake2ts/game`, `@quake2ts/client`

**Methods Needed**:
```typescript
interface GameExports {
  /**
   * Set player to spectator mode
   */
  setSpectator(playernum: number, spectating: boolean): void
}

interface ClientExports {
  /**
   * Set spectator camera target (which player to follow)
   * @param targetEntityId Entity to follow, or null for free cam
   */
  setSpectatorTarget(targetEntityId: number | null): void

  /**
   * Get available spectator targets
   */
  getSpectatorTargets(): { id: number; name: string }[]
}
```

**Rationale**: Multiplayer spectator mode (Section 02, Task 6.4) allows observing matches.

---

## Section 03: Enhanced Demo System

### Enhancement 3.1: Demo Event Extraction (P1)

**Package**: `@quake2ts/client`

**Method Needed**:
```typescript
interface DemoPlaybackController {
  // ... existing methods

  /**
   * Extract notable events from demo for timeline markers
   */
  getEvents(): DemoEvent[]
}

interface DemoEvent {
  type: 'kill' | 'death' | 'pickup' | 'objective' | 'chat'
  frame: number
  time: number  // seconds
  data: any     // event-specific data
  description: string
}
```

**Rationale**: Demo timeline (Section 03, Task 1.4) shows event markers for quick navigation.

**Workaround**: Parse demo manually, but complex and requires understanding demo format.

---

### Enhancement 3.2: Demo Clip Extraction (P2)

**Package**: `@quake2ts/client`

**Function Needed**:
```typescript
/**
 * Extract portion of demo file as new demo
 * @param demo Original demo file (Uint8Array)
 * @param startFrame First frame to include
 * @param endFrame Last frame to include
 * @returns New demo file containing only specified frames
 */
function extractDemoRange(
  demo: Uint8Array,
  startFrame: number,
  endFrame: number
): Uint8Array
```

**Rationale**: Clip extraction (Section 03, Task 6.4) allows sharing highlights.

**Workaround**: Record new demo while playing desired section, but inefficient.

---

### Enhancement 3.3: Demo Metadata Access (P2)

**Package**: `@quake2ts/client`

**Methods Needed**:
```typescript
interface DemoPlaybackController {
  /**
   * Get demo file metadata
   */
  getMetadata(): DemoMetadata
}

interface DemoMetadata {
  mapName: string
  playerName: string
  serverName?: string
  recordingDate?: Date
  demoVersion: number
  tickRate: number
}
```

**Rationale**: Demo metadata editor (Section 03, Task 7) displays and edits demo properties.

---

## Section 04: Advanced Rendering Features

### Enhancement 4.1: Renderer Statistics API (P1)

**Package**: `@quake2ts/engine`

**Method Needed**:
```typescript
class Renderer {
  /**
   * Get detailed rendering statistics for current frame
   */
  getStatistics(): RenderStatistics
}

interface RenderStatistics {
  frameTimeMs: number
  drawCalls: number
  triangles: number
  vertices: number
  textureBinds: number
  shaderSwitches: number
  visibleSurfaces: number
  culledSurfaces: number
  visibleEntities: number
  culledEntities: number
  memoryUsageMB: {
    textures: number
    geometry: number
    total: number
  }
}
```

**Rationale**: Performance dashboard (Section 04, Task 2) displays these metrics.

**Workaround**: WebGL queries can get some data, but incomplete and library-internal buffers not accessible.

---

### Enhancement 4.2: Debug Rendering Mode API (P1)

**Package**: `@quake2ts/engine`

**Method Needed**:
```typescript
class Renderer {
  /**
   * Enable debug visualization modes
   */
  setDebugMode(mode: DebugMode): void
}

enum DebugMode {
  None,
  BoundingBoxes,     // Show entity AABBs
  Normals,           // Visualize surface normals
  PVSClusters,       // Color by PVS cluster
  CollisionHulls,    // Show collision geometry
  Lightmaps,         // Lightmap-only rendering
  Wireframe          // Wireframe overlay
}
```

**Rationale**: Debug visualization (Section 04, Task 1) helps developers understand rendering.

**Workaround**: Separate debug rendering layer in application, but doesn't have access to library internals.

---

### Enhancement 4.3: Lighting Control APIs (P2)

**Package**: `@quake2ts/engine`

**Methods Needed**:
```typescript
class Renderer {
  /**
   * Set global brightness multiplier
   */
  setBrightness(value: number): void  // 0.0 - 2.0

  /**
   * Set gamma correction
   */
  setGamma(value: number): void  // 0.5 - 3.0

  /**
   * Enable fullbright mode (no lighting)
   */
  setFullbright(enabled: boolean): void

  /**
   * Set ambient light minimum
   */
  setAmbient(value: number): void  // 0.0 - 1.0

  /**
   * Override light style pattern
   */
  setLightStyle(index: number, pattern: string | null): void
}
```

**Rationale**: Lighting controls (Section 04, Task 5) for artistic and debugging purposes.

**Workaround**: Post-processing brightness/gamma, but doesn't affect actual lighting calculations.

---

### Enhancement 4.4: Entity Bounds Access (P2)

**Package**: `@quake2ts/game`

**Property Needed**:
```typescript
interface Entity {
  // ... existing properties

  /**
   * Axis-aligned bounding box in world space
   * Updated automatically when entity moves
   */
  readonly worldBounds: {
    min: Vec3
    max: Vec3
  }
}
```

**Rationale**: Bounding box visualization (Section 04, Task 1.1) needs entity bounds.

**Workaround**: Calculate from entity origin + mins/maxs, but may not account for rotation.

---

## Section 05: Asset Analysis Tools

### Enhancement 5.1: Cross-Reference API (P2)

**Package**: `@quake2ts/engine`

**Service Needed**:
```typescript
/**
 * Build asset dependency graph
 */
class AssetCrossReference {
  constructor(vfs: VirtualFileSystem)

  /**
   * Find which models use this texture
   */
  getModelsUsingTexture(texturePath: string): string[]

  /**
   * Find which maps use this model
   */
  getMapsUsingModel(modelPath: string): string[]

  /**
   * Find which entities use this sound
   */
  getEntitiesUsingSound(soundPath: string): BspEntity[]

  /**
   * Get all assets referenced by this map
   */
  getMapDependencies(mapPath: string): {
    textures: string[]
    models: string[]
    sounds: string[]
  }
}
```

**Rationale**: Asset usage tracking (Section 05, Tasks 1.4, 6.6) shows where assets are used.

**Workaround**: Scan all assets manually, very slow for large PAKs.

---

### Enhancement 5.2: Model Export Utilities (P3)

**Package**: `@quake2ts/engine` or new `@quake2ts/tools`

**Functions Needed**:
```typescript
/**
 * Export MD2 model to OBJ format
 * @param model Parsed MD2 model
 * @param frame Frame index to export
 * @returns OBJ file contents as string
 */
function exportMd2ToObj(model: Md2Model, frame: number): string

/**
 * Export MD3 model to glTF 2.0 format
 * @param model Parsed MD3 model
 * @returns glTF JSON and binary buffer
 */
function exportMd3ToGltf(model: Md3Model): {
  json: string
  buffer: ArrayBuffer
}
```

**Rationale**: Model export (Section 05, Task 2.7) enables use in external 3D tools.

**Workaround**: Manual conversion, extremely complex.

---

## Section 06: Map Editor Integration

### Enhancement 6.1: ENT Parser and Serializer (P1)

**Package**: `@quake2ts/engine` or `@quake2ts/tools`

**Functions Needed**:
```typescript
/**
 * Parse ENT file (entity lump text format) to entity objects
 */
function parseEntLump(text: string): BspEntity[]

/**
 * Serialize entities to ENT file format
 */
function serializeEntLump(entities: BspEntity[]): string

/**
 * Validate entity properties
 */
function validateEntity(entity: BspEntity): ValidationResult

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
```

**Rationale**: ENT import/export (Section 06, Task 6) for map editor integration.

**Workaround**: Implement custom parser, but ENT format has edge cases.

---

### Enhancement 6.2: Entity Template Definitions (P2)

**Package**: `@quake2ts/game`

**Data Needed**:
```typescript
/**
 * Default property values for each entity classname
 */
const ENTITY_TEMPLATES: Record<string, EntityTemplate>

interface EntityTemplate {
  classname: string
  defaultProperties: Record<string, any>
  requiredProperties: string[]
  propertyTypes: Record<string, PropertyType>
  description: string
}

enum PropertyType {
  String,
  Number,
  Vec3,
  Angle,
  Boolean,
  Choice,  // Enum
  Reference  // Targetname reference
}
```

**Rationale**: Entity creation (Section 06, Task 3) needs default values and validation.

**Workaround**: Hardcode in application, but duplicates library knowledge.

---

### Enhancement 6.3: BSP Entity Lump Replacement (P3)

**Package**: `@quake2ts/tools`

**Function Needed**:
```typescript
/**
 * Replace entity lump in BSP file without recompilation
 * @param bspData Original BSP file
 * @param entities New entity list
 * @returns Modified BSP file
 */
function replaceBspEntities(
  bspData: Uint8Array,
  entities: BspEntity[]
): Uint8Array
```

**Rationale**: Direct BSP modification (Section 06, Task 6.4) without external tools.

**Workaround**: Export ENT separately, user uses external tools like bspinfo.

---

## Section 07: Mod Support

### Enhancement 7.1: Custom Entity Registration API (P0)

**Package**: `@quake2ts/game`

**Methods Needed**:
```typescript
interface GameExports {
  /**
   * Register custom entity spawn function
   * Mods can add new entity types
   */
  registerEntitySpawn(
    classname: string,
    spawnFunc: (entity: Entity) => void
  ): void

  /**
   * Unregister entity spawn function (for mod unloading)
   */
  unregisterEntitySpawn(classname: string): void

  /**
   * Get list of registered custom entities
   */
  getCustomEntities(): string[]
}
```

**Rationale**: Custom entity registration (Section 07, Task 3) enables mod content.

**Workaround**: Fork library and modify entity spawn registry, not sustainable.

---

### Enhancement 7.2: Mod Initialization Hooks (P1)

**Package**: `@quake2ts/game`

**API Needed**:
```typescript
interface GameExports {
  /**
   * Call when mod is activated
   * Mod can initialize custom entities, register hooks, etc.
   */
  onModInit?: (modId: string, modApi: ModAPI) => void

  /**
   * Call when mod is deactivated
   * Mod can clean up resources
   */
  onModShutdown?: (modId: string) => void
}

interface ModAPI {
  registerEntity(classname: string, factory: EntityFactory): void
  registerCommand(name: string, handler: CommandHandler): void
  registerCvar(name: string, defaultValue: string): Cvar
  // ... other mod APIs
}
```

**Rationale**: Mod initialization (Section 07, Task 3.5) needs structured hooks.

**Workaround**: Declarative JSON-only mods (no code), limited functionality.

---

### Enhancement 7.3: VirtualFileSystem Priority Support (P1)

**Package**: `@quake2ts/engine`

**API Enhancement**:
```typescript
class VirtualFileSystem {
  /**
   * Mount PAK with explicit priority
   * Higher priority PAKs override lower priority
   */
  mountPak(pak: PakArchive, priority: number): void

  /**
   * Get PAKs in priority order
   */
  getPaks(): Array<{ pak: PakArchive; priority: number }>

  /**
   * Rearrange PAK priorities
   */
  setPriority(pak: PakArchive, newPriority: number): void
}
```

**Rationale**: PAK priority system (Section 07, Task 2) ensures correct mod overrides.

**Workaround**: Wrapper service managing PAK order, but complicates code.

---

### Enhancement 7.4: Cvar System Exposure (P2)

**Package**: `@quake2ts/shared` or `@quake2ts/game`

**API Needed**:
```typescript
/**
 * Console variable system for configuration
 */
class Cvar {
  constructor(name: string, defaultValue: string, flags: CvarFlags)

  getString(): string
  getFloat(): number
  getInt(): number
  getBoolean(): boolean

  set(value: string): void
  reset(): void

  onChange?: (newValue: string, oldValue: string) => void
}

enum CvarFlags {
  None = 0,
  Archive = 1 << 0,      // Save to config
  UserInfo = 1 << 1,     // Send to server
  ServerInfo = 1 << 2,   // Server cvar
  ReadOnly = 1 << 3,     // Cannot be changed by user
  Cheat = 1 << 4,        // Only in cheat mode
}

function getCvar(name: string): Cvar | null
function setCvar(name: string, value: string): void
function listCvars(): Cvar[]
```

**Rationale**: Mod configuration (Section 07, Task 6.4) uses cvars for settings.

**Workaround**: Custom config system, but doesn't integrate with library.

---

## Section 09: Performance Optimization

### Enhancement 9.1: Streaming PAK Reader API (P2)

**Package**: `@quake2ts/engine`

**API Needed**:
```typescript
/**
 * Read PAK file in chunks, streaming file contents on demand
 * Useful for very large PAKs (>500MB)
 */
class StreamingPakArchive {
  constructor(file: File | Blob)

  /**
   * Read directory asynchronously (doesn't load all file data)
   */
  async readDirectory(): Promise<PakDirectoryEntry[]>

  /**
   * Stream file contents on demand
   */
  async readFile(path: string): Promise<ReadableStream<Uint8Array>>

  /**
   * Get file without loading entire file into memory
   */
  async getFileBlob(path: string): Promise<Blob>
}
```

**Rationale**: Asset streaming (Section 09, Task 5.1) for large PAKs.

**Workaround**: Load entire PAK into memory, uses excessive RAM.

---

### Enhancement 9.2: Instancing API (P2)

**Package**: `@quake2ts/engine`

**API Needed**:
```typescript
class Renderer {
  /**
   * Render multiple instances of same model efficiently
   * Uses GPU instancing
   */
  renderInstanced(
    model: Md2Model | Md3Model,
    instances: InstanceData[]
  ): void
}

interface InstanceData {
  position: Vec3
  rotation: Vec3
  scale?: Vec3
  frame?: number
  skin?: number
}
```

**Rationale**: Geometry pooling (Section 09, Task 4.2) for duplicate entities.

**Workaround**: Render each instance separately, slower.

---

### Enhancement 9.3: LOD (Level of Detail) Support (P3)

**Package**: `@quake2ts/engine`

**API Needed**:
```typescript
interface Md2Model {
  /**
   * Multiple LOD versions of model (high, medium, low poly)
   */
  lods?: Md2Model[]
}

class Renderer {
  /**
   * Automatically select LOD based on distance from camera
   */
  setLodBias(bias: number): void  // 0.0 - 2.0
}
```

**Rationale**: LOD streaming (Section 09, Task 5.3) for progressive loading.

**Workaround**: Single LOD only, no optimization.

---

### Enhancement 9.4: Memory Tracking Hooks (P2)

**Package**: `@quake2ts/engine`

**API Needed**:
```typescript
class Renderer {
  /**
   * Get memory usage breakdown
   */
  getMemoryUsage(): MemoryUsage
}

interface MemoryUsage {
  texturesBytes: number
  geometryBytes: number
  shadersBytes: number
  buffersBytes: number
  totalBytes: number
}
```

**Rationale**: Memory profiling (Section 09, Task 4.5) for optimization.

**Workaround**: Estimate from asset counts, inaccurate.

---

## Summary Table

| Enhancement | Package | Priority | Section | Status |
|-------------|---------|----------|---------|--------|
| Game State Serialization | game | P0 | 01 | Needed |
| Admin/Cheat APIs | game | P1 | 01 | Needed |
| Master Server Client | client/net | P1 | 02 | Needed |
| WebSocket Protocol Docs | docs | P0 | 02 | Needed |
| Spectator Mode APIs | game/client | P1 | 02 | Needed |
| Demo Event Extraction | client | P1 | 03 | Needed |
| Demo Clip Extraction | client | P2 | 03 | Needed |
| Demo Metadata Access | client | P2 | 03 | Needed |
| Renderer Statistics API | engine | P1 | 04 | Needed |
| Debug Rendering Mode | engine | P1 | 04 | Needed |
| Lighting Control APIs | engine | P2 | 04 | Needed |
| Entity Bounds Access | game | P2 | 04 | Needed |
| Cross-Reference API | engine | P2 | 05 | Needed |
| Model Export Utilities | engine/tools | P3 | 05 | Nice-to-have |
| ENT Parser/Serializer | engine/tools | P1 | 06 | Needed |
| Entity Templates | game | P2 | 06 | Needed |
| BSP Entity Lump Replace | tools | P3 | 06 | Nice-to-have |
| Custom Entity Registration | game | P0 | 07 | Needed |
| Mod Initialization Hooks | game | P1 | 07 | Needed |
| VFS Priority Support | engine | P1 | 07 | Needed |
| Cvar System | shared/game | P2 | 07 | Needed |
| Streaming PAK Reader | engine | P2 | 09 | Needed |
| Instancing API | engine | P2 | 09 | Nice-to-have |
| LOD Support | engine | P3 | 09 | Nice-to-have |
| Memory Tracking | engine | P2 | 09 | Needed |

**Total Enhancements**: 25
- **P0 (Critical)**: 3
- **P1 (High)**: 10
- **P2 (Medium)**: 9
- **P3 (Low)**: 3

---

## Implementation Suggestions

### Phase 1: Critical Path (P0)
1. Game State Serialization (enables save/load)
2. WebSocket Protocol Documentation (unblocks multiplayer)
3. Custom Entity Registration (foundation for mods)

### Phase 2: High Priority (P1)
4. Admin/Cheat APIs
5. Debug Rendering Mode
6. Renderer Statistics
7. ENT Parser/Serializer
8. VFS Priority Support
9. Mod Initialization Hooks
10. Spectator Mode
11. Master Server Client
12. Demo Event Extraction

### Phase 3: Medium Priority (P2)
13. Lighting Controls
14. Entity Bounds Access
15. Cross-Reference API
16. Entity Templates
17. Cvar System
18. Streaming PAK Reader
19. Instancing API
20. Memory Tracking
21. Demo Clip Extraction
22. Demo Metadata Access

### Phase 4: Low Priority (P3)
23. Model Export Utilities
24. BSP Entity Lump Replacement
25. LOD Support

---

## Design Principles

When implementing these enhancements:

1. **Maintain API Consistency**: Follow existing library patterns and naming conventions
2. **Type Safety**: Full TypeScript types for all new APIs
3. **Documentation**: JSDoc comments for all public APIs
4. **Testing**: Unit tests for all new functionality
5. **Performance**: Profile any changes that could affect performance
6. **Backwards Compatibility**: Avoid breaking changes where possible
7. **Opt-In**: New features should be opt-in (don't change defaults)
8. **Minimal Dependencies**: Avoid adding new external dependencies

---

## Questions for Library Maintainers

1. **Architecture**: Should new features go in existing packages or new packages (e.g., `@quake2ts/tools`)?
2. **Breaking Changes**: Is v1.0.0 release planned? If so, can we batch breaking changes?
3. **Expansion Content**: What's the plan for Rogue and Xatrix support?
4. **Scripting**: Any plans for mod scripting (Lua, JavaScript)?
5. **WebWorker Support**: Should library APIs be WebWorker-compatible?
6. **Streaming**: Should we standardize on Streams API or custom streaming?

---

## Contributing

If you're a library contributor interested in implementing these enhancements:

1. Review this document and choose an enhancement to implement
2. Open a GitHub issue on quake2ts repository referencing this enhancement
3. Discuss design approach with maintainers
4. Implement with tests and documentation
5. Submit pull request
6. Update this document once merged (mark as "Implemented in v0.0.XXX")

**Contact**: Reference the quake2ts-explorer repository and this document in any discussions.

---

## Version History

- **v1.0** (2025-01-XX): Initial enhancement requests for quake2ts v0.0.470
- *(Future)* Track which enhancements have been implemented

---

**Thank you** to the quake2ts library maintainers for creating an amazing foundation! These enhancements will enable building a world-class Quake II web application. 🚀
