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
  - **Player state**: Health, armor, inventory, position, angles, velocity *(player details still TODO; stub stored in gameState for now)*
  - **Entity array**: All entities with relevant fields
  - **Configstrings**: Model/sound/image indices and names
  - **Cvars**: Archived cvar values
- [x] Determine which entity fields to save
  - Transform: origin, angles, velocity
  - Physics: mins, maxs, movetype, waterlevel, groundentity reference
  - Render: modelindex, frame, skin, effects
  - Gameplay: health, takedamage, deadflag, flags
  - AI: enemy reference, movetarget, goalentity, ideal_yaw, timers
  - Scripting: targetname, target (for resolving references)
  - Timing: nextthink, thinkfunc name (serialize function by name) *(functions still excluded pending registry work)*
  - Skip: Transient data (render cache, temporary effects)
- [x] Handle entity references
  - Entities reference other entities (enemy, groundentity, target)
  - Serialize as entity index, restore by re-linking after load
  - Build entity reference map during deserialization

### Serialization System
- [x] Entity serialization
  - Convert entity to JSON-compatible object
  - Handle circular references (entity -> enemy -> entity)
  - Serialize callback functions by name (thinkfunc, touch, use, pain, die) *(deferred)*
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
  - Level-global flags, counters, objectives *(basic time counters captured; doors/triggers still TODO)*
  - Active triggers, doors (position, state)
- [ ] Player state serialization
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
- [ ] Function reference restoration
  - thinkfunc name -> actual function pointer
  - touch, use, pain, die callbacks by name
  - Maintain registry of serializable functions
- [x] Level state restoration
  - Restore frame number, level time
  - Restore RNG state (seed and internal state)
  - Restore level flags, objectives *(needs door/trigger state once implemented)*
  - Re-link entities into world (spatial structures)
- [ ] Player state restoration
  - Restore player entity
  - Restore inventory, weapon state
  - Restore position, angles, velocity
  - Set camera position

### Save File Management
- [ ] Save file storage
  - Use IndexedDB for large save files (localStorage too small)
  - Store saves as JSON blobs
  - Key by save name or timestamp
- [ ] Save file metadata
  - List of saves with preview info (map name, time, date)
  - Thumbnails (screenshot at save time, optional)
  - Quick save / auto save support
- [ ] Save operations
  - **Quick save**: Save to "quicksave" slot (overwrite previous)
  - **Manual save**: Prompt for save name
  - **Auto save**: Save automatically at checkpoints (level start, objectives)
  - **Prevent save**: Some moments should block saving (mid-cinematic, dead)
- [ ] Load operations
  - **Quick load**: Load from "quicksave" slot
  - **Manual load**: Choose from save list
  - **Verify save**: Check version, map exists, data valid before loading
  - **Error handling**: Graceful failure if save corrupted
- [ ] Delete saves
  - Remove save from IndexedDB
  - Update save list UI

### Determinism & Reproducibility
- [ ] Ensure deterministic save/load
  - Same save loaded twice produces identical gameplay
  - RNG state must be saved and restored exactly
  - Entity order must be preserved (save by slot index)
  - Frame timing must match (use saved frame number)
- [ ] Test reproducibility
  - Save game, load twice in parallel, verify divergence-free
  - Useful for debugging desyncs (multiplayer future-proofing)

### Save Format Versioning
- [x] Version number in save file
  - Increment when save format changes
  - Check version on load
- [ ] Backward compatibility
  - Load old saves with migration logic
  - Fill in missing fields with defaults
  - Warn user if save is from incompatible version
- [ ] Forward compatibility
  - Ignore unknown fields from newer saves
  - May lose data, but don't crash

### Rerelease JSON Save Compatibility (Optional)
- [ ] Analyze rerelease JSON save format
  - Study structure, field names, types
  - Document differences from quake2ts format
- [ ] Implement converter (mapper)
  - **Import**: Read rerelease JSON, convert to quake2ts format
  - **Export**: Convert quake2ts save to rerelease JSON format
  - May not be 100% compatible (some fields/systems differ)
- [ ] Use cases
  - Allow players to migrate saves from rerelease to quake2ts
  - Debugging: compare quake2ts state to rerelease state
  - Not critical for initial release; defer if complex

### Save/Load UI Integration
- [ ] In-game save menu
  - Pause game, show save menu
  - List existing saves
  - Prompt for save name (text input)
  - Confirm overwrite if name exists
  - Show success message, dismiss menu
- [ ] In-game load menu
  - Pause game, show load menu
  - List existing saves with metadata (map, date, playtime)
  - Select save, confirm load
  - Discard current game state, load selected save
- [ ] Main menu save/load
  - Access saves from main menu (before starting game)
  - Load save directly into game
  - Delete saves from list

### Error Handling & Validation
- [ ] Save validation
  - Check map exists in loaded PAKs
  - Check entity count within limits
  - Check required fields present
  - Checksum or hash for corruption detection
- [ ] Error messages
  - "Save file corrupted"
  - "Save file from incompatible version"
  - "Map not found (mod required)"
  - User-friendly explanations
- [ ] Fallback behavior
  - If load fails, return to main menu
  - Don't crash or leave game in broken state
  - Log detailed error for debugging

### Debugging & Development Tools
- [ ] Save file inspection
  - Export save as human-readable JSON
  - Import save from JSON (for testing)
  - Diff tool to compare two saves
- [ ] Save state snapshots (for testing)
  - Capture game state at any moment
  - Restore to snapshot for rapid iteration
  - Useful for testing specific scenarios
- [ ] Determinism testing
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

## Testing Requirements

### Unit Tests (Standard)
- Serialize and deserialize simple entities
- Entity reference resolution (index -> pointer)
- Function name serialization (thinkfunc by name)
- Version compatibility checks
- RNG state save/restore

### Integration Tests
- **Full save/load cycle**: Save game, load, verify state identical
- **Entity references**: Save game with entity references (enemy, groundentity), load, verify links restored
- **Callbacks**: Save game with think/touch callbacks, load, verify callbacks execute
- **Inventory**: Save with various items/weapons, load, verify inventory intact
- **Monster AI**: Save with monsters mid-combat, load, verify AI resumes correctly
- **Level objects**: Save with doors open, buttons pressed, triggers fired; load, verify states preserved
- **RNG reproducibility**: Save, load, verify random events reproduce exactly

### Stress Tests
- **Large save files**: Save game with 1000+ entities, verify load time acceptable (<2 seconds)
- **Many saves**: Create 100 saves, verify IndexedDB handles it, verify UI responsive
- **Save file size**: Measure save file size, ensure reasonable (target <1MB per save)

### Compatibility Tests
- **Version migration**: Create save with old version, load with new version, verify migration
- **Missing map**: Save game, remove map PAK, try to load, verify error handling
- **Corrupted save**: Corrupt save file data, try to load, verify graceful failure

### Determinism Tests (Critical)
- **Replay test**: Save game, load, play 1000 frames, save again; compare saves byte-for-byte
- **Parallel load**: Load same save in two instances, play N frames, compare states
- **RNG consistency**: Save with known RNG seed, load, verify random values match expected sequence

## Notes
- Save/load is critical for single-player experience; must be rock-solid
- Determinism is essential for save/load to work reliably
- Entity references are tricky; careful bookkeeping required during deserialization
- Function pointers can't be serialized directly; use name-based lookup
- IndexedDB is async; handle save/load with promises/async functions
- Save file corruption is rare but possible; validate on load
- Rerelease JSON compatibility is a nice-to-have, not essential
- Quick save/load is expected by players; map to common keys (F5/F9)
- Auto-save at level transitions prevents losing progress
- Save file size can grow with many entities; consider compression (gzip) if needed
- Rerelease source reference: `g_save.cpp` (save/load logic, JSON serialization)
- Some entities are "client-only" (particles, temporary effects) and shouldn't be saved
- Worldspawn and static entities may not need full serialization; can respawn from BSP
- Player state is most critical; if anything, prioritize saving player over minor entity details
- Consider "checkpoint" system as alternative to full save/load (simpler, less flexible)
- Save format should be documented for modders/future developers
