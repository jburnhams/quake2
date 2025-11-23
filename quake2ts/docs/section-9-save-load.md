# Section 9: Save/Load & Persistence

## Overview
This section covers the save/load system that allows players to save game progress and resume later. It includes serializing all game state (entities, level, player inventory, global state) to a deterministic, JSON-compatible format, storing saves in browser storage (IndexedDB), and restoring game state on load. The system must be robust, version-aware, and compatible (or mappable) to the rerelease JSON save format.

## Dependencies
- **Entity System (Section 4)**: REQUIRED - must serialize all entity state
- **Game loop/level system**: REQUIRED - must save level time, frame number, global state
- **Combat/Items (Section 5)**: Must save player inventory, weapon state, ammo
- **AI (Section 6)**: Must save monster AI state (enemy, goals, timers)
- **Deterministic RNG**: Must save/restore RNG state for reproducibility - **COMPLETED**

## Work Already Done
- ✅ Deterministic RNG (MersenneTwister) with seed save/restore support
- ✅ LevelClock and GameFrameLoop with frame timing
- ✅ Entity structure designed for serialization (Section 4)
- ✅ Save data structure definition with versioning
- ✅ Entity/Player/Level/RNG state serialization and restoration
- ✅ IndexedDB storage layer
- ✅ Checksum validation for save integrity
- ✅ Determinism verification helpers
- ✅ Save/Load Menu Components (Backend/Factory)

## Tasks Remaining

### Save Data Structure
- [x] Define save file schema (TypeScript types)
  - **Version**: Save format version (for forward/backward compatibility)
  - **Timestamp**: When save was created
  - **Map name**: Current map/level
  - **Difficulty**: Game difficulty setting
  - **Playtime**: Total play time in seconds
  - **Game state**: Global game variables
  - **Level state**: Frame number, level time, random seed
  - **Player state**: Health, armor, inventory, position, angles, velocity
  - **Entity array**: All entities with relevant fields
  - **Configstrings**: Model/sound/image indices and names
  - **Cvars**: Archived cvar values
  - **Checksum**: Integrity verification hash
- [x] Determine which entity fields to save
  - Transform: origin, angles, velocity
  - Physics: mins, maxs, movetype, waterlevel, groundentity reference
  - Render: modelindex, frame, skin, effects
  - Gameplay: health, takedamage, deadflag, flags
  - AI: enemy reference, movetarget, goalentity, ideal_yaw, timers
  - Scripting: targetname, target (for resolving references)
  - Timing: nextthink, thinkfunc name (serialize function by name)
  - Skip: Transient data (render cache, temporary effects)
- [x] Handle entity references
  - Entities reference other entities (enemy, groundentity, target)
  - Serialize as entity index, restore by re-linking after load
  - Build entity reference map during deserialization

### Serialization System
- [x] Entity serialization
  - Convert entity to JSON-compatible object
  - Handle circular references (entity -> enemy -> entity)
  - Serialize callback functions by name (thinkfunc, touch, use, pain, die)
  - Store entity slot index for reference resolution
- [x] Entity field metadata
  - Mark fields as serializable (decorator or metadata)
  - Specify field type (number, string, vec3, entity reference, etc.)
  - Generate serializers automatically from metadata
- [x] Special type serialization
  - **vec3**: Store as `[x, y, z]` array
  - **Entity reference**: Store as entity index
  - **Function reference**: Store as function name string
  - **Enum/flags**: Store as number
  - **Buffers/typed arrays**: Convert to regular arrays
- [x] Level state serialization
  - Frame number, level time
  - Random seed state (entire RNG state for reproducibility)
  - Level-global flags, counters, objectives
  - Active triggers, doors (position, state)
- [x] Player state serialization
  - Full player entity
  - Inventory: weapons owned, ammo counts, keys, powerups
  - View angles, velocity, position
  - Weapon state (current weapon, reload status, etc.)

### Deserialization System
- [x] Parse save file JSON
  - Validate structure and version
  - Handle missing fields (backward compatibility)
  - Handle extra fields (forward compatibility)
- [x] Entity deserialization
  - Create entities in same slots as saved
  - Restore all saved fields
  - Build entity reference map (index -> entity)
- [x] Entity reference resolution
  - Second pass: resolve all entity references
  - enemy index -> enemy entity pointer
  - groundentity index -> groundentity pointer
  - target name -> target entity (via targetname lookup)
- [x] Function reference restoration
  - thinkfunc name -> actual function pointer
  - touch, use, pain, die callbacks by name
  - Maintain registry of serializable functions
- [x] Level state restoration
  - Restore frame number, level time
  - Restore RNG state (seed and internal state)
  - Restore level flags, objectives
  - Re-link entities into world (spatial structures)
- [x] Player state restoration
  - Restore player entity
  - Restore inventory, weapon state
  - Restore position, angles, velocity
  - Set camera position

### Save File Management
- [x] Save file storage
  - Use IndexedDB for large save files (localStorage too small)
  - Store saves as JSON blobs
  - Key by save name or timestamp
- [x] Save file metadata
  - List of saves with preview info (map name, time, date)
  - Thumbnails (screenshot at save time, optional)
  - Quick save / auto save support
- [x] Save operations
  - **Quick save**: Save to "quicksave" slot (overwrite previous)
  - **Manual save**: Prompt for save name
  - **Auto save**: Save automatically at checkpoints (level start, objectives)
  - **Prevent save**: Some moments should block saving (mid-cinematic, dead)
- [x] Load operations
  - **Quick load**: Load from "quicksave" slot
  - **Manual load**: Choose from save list
  - **Verify save**: Check version, map exists, data valid before loading
  - **Error handling**: Graceful failure if save corrupted (Checksum validation)
- [x] Delete saves
  - Remove save from IndexedDB (storage layer now reports deletion status)
  - Update save list UI

### Determinism & Reproducibility
- [x] Ensure deterministic save/load
  - Same save loaded twice produces identical gameplay (validated via entity pool/think snapshot parity tests)
  - RNG state must be saved and restored exactly (round-trip tests cover `RandomGenerator` state)
  - Entity order must be preserved (save by slot index)
  - Frame timing must match (use saved frame number)
- [x] Test reproducibility
  - Save game, load twice in parallel, verify divergence-free
  - Useful for debugging desyncs (multiplayer future-proofing)

### Save Format Versioning
- [x] Version number in save file
  - Increment when save format changes
  - Check version on load
- [x] Backward compatibility
  - Load old saves with migration logic
  - Fill in missing fields with defaults (parsing now tolerates absent optional fields and defaults level/RNG state)
  - Warn user if save is from incompatible version
- [x] Forward compatibility
  - Ignore unknown fields from newer saves (parser accepts newer versions unless explicitly disallowed)
  - May lose data, but don't crash

### Rerelease JSON Save Compatibility (Optional)
- [x] Analyze rerelease JSON save format
  - Study structure, field names, types (top-level `save_version`, game saves with `game` + `clients[]`, level saves with `level` + sparse `entities` object keyed by edict index string)
  - Document differences from quake2ts format (slot-index array vs rerelease object map)
- [x] Implement converter (mapper)
  - **Import**: Read rerelease JSON level saves, convert to quake2ts format with deterministic pool reconstruction and vec3/entity field normalization
  - **Export**: Convert quake2ts level snapshots to rerelease-shaped JSON (snake_case with `entities` keyed by edict index)
  - Game-save conversion intentionally blocked until client/player state is mapped; emits explicit error to avoid silent drift
- [x] Use cases
  - Allow players to migrate level saves from rerelease to quake2ts and round-trip snapshots for debugging
  - Debugging: compare quake2ts state to rerelease state
  - Game-save migration deferred pending client serialization

### Save/Load UI Integration
- [x] In-game save menu (Backend/Factory implemented)
  - Pause game, show save menu
  - List existing saves
  - Prompt for save name (text input)
  - Confirm overwrite if name exists
  - Show success message, dismiss menu
- [x] In-game load menu (Backend/Factory implemented)
  - Pause game, show load menu
  - List existing saves with metadata (map, date, playtime)
  - Select save, confirm load
  - Discard current game state, load selected save
- [ ] Main menu save/load (Integration remaining)
  - Access saves from main menu (before starting game)
  - Load save directly into game
  - Delete saves from list

### Error Handling & Validation
- [x] Save validation
  - Check map exists in loaded PAKs
  - Check entity count within limits
  - Check required fields present
  - Checksum or hash for corruption detection
- [x] Error messages
  - "Save file corrupted"
  - "Save file from incompatible version"
  - "Map not found (mod required)"
  - User-friendly explanations
- [x] Fallback behavior
  - If load fails, return to main menu
  - Don't crash or leave game in broken state
  - Log detailed error for debugging

### Debugging & Development Tools
- [x] Save file inspection
  - Export save as human-readable JSON
  - Import save from JSON (for testing)
  - Diff tool to compare two saves
- [x] Save state snapshots (for testing)
  - Capture game state at any moment
  - Restore to snapshot for rapid iteration
  - Useful for testing specific scenarios
- [x] Determinism testing
  - Record input sequence
  - Play back inputs, verify state matches
  - Catch non-deterministic bugs

## Integration Points
- **From Entity System (Section 4)**: Serializes all entities
- **From Game loop (Section 4)**: Saves level time, frame number, stage states
- **From Combat/Items (Section 5)**: Saves player inventory, weapon state
- **From AI (Section 6)**: Saves monster AI state (enemy, timers, goals)
- **From Client (Section 8)**: Saves player view angles, position
- **To UI (Section 8)**: Provides save/load menu functionality
