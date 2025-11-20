# Section 7: Audio System (WebAudio)

## Overview
This section covers the complete audio system for Quake II using the Web Audio API. It includes sound effect playback (positioned and ambient), music streaming, spatialization (3D positional audio), attenuation, and channel management. The audio system must match the rerelease sound API (`game_import_t` sound functions) to provide immersive, responsive audio for all game events.

## Dependencies
- **Asset Loading (Section 1)**: REQUIRED - needs decoded audio buffers (WAV, OGG)
- **Entity System (Section 4)**: Requires entity positions for positioned sounds
- **Physics System (Section 3)**: May use trace for sound occlusion (optional, advanced)
- **Engine configstring registry**: For sound index registration - **COMPLETED**

## Work Already Done
- ✅ ConfigString registry with `soundindex` support
- ✅ Asset loader prepares audio buffers (Section 1 when complete)

## Tasks Remaining

### WebAudio Context Setup
- [x] Initialize AudioContext
  - `AudioContextController` lazily creates contexts and resumes them on demand to satisfy autoplay policies.
  - Helper exposes current state for diagnostics.
- [x] Create master audio graph
  - Master gain node (volume control) and compressor built in `createAudioGraph`, connected to the destination.
  - Master gain initialized from the requested master volume so global mix levels are consistent from startup.
- [x] Audio channel management
  - Fixed pool of channels mirrors rerelease limits.
  - `pickChannel` matches `S_PickChannel` rules (channel 0 never prefers overrides, skips player sounds, steals the least remaining life).
  - Channel state tracked and cleared on `onended`.

### Sound Registration & Precaching
- [x] Sound index registry
  - `SoundRegistry` wraps the ConfigString registry and caches decoded buffers per index.
- [x] Sound loading
  - Accepts decoded buffers and retains them for playback (VFS decode hook still TODO).
 - [x] Sound precaching
   - `SoundPrecache` decodes `sound/` assets from the VFS via `decodeAudioData` and populates the registry, reusing placeholder entries from `soundindex`
   - Preload all sounds used in level during load screen to reduce latency

### Sound Playback (One-Shot Sounds)
- [x] Play positioned sound
  - **Signature**: `sound(entity: Entity, channel: number, soundindex: number, volume: number, attenuation: number, timeofs: number)`
  - Create AudioBufferSourceNode from cached buffer
  - Connect to PannerNode for 3D positioning
  - Set position from entity origin
  - Set volume, attenuation (distance falloff)
  - Set timeofs (delayed start, for timing effects)
  - Start playback
  - Auto-cleanup when sound finishes
- [x] Play ambient sound (no attenuation)
  - **Signature**: `ambient_sound(origin: vec3, soundindex: number, volume: number)`
  - Used for environmental sounds (water, wind, machines)
  - Positioned but no distance falloff
  - Often looping
- [x] Channel assignment
  - Channels 0-7: entity sounds (weapon fire, pain, etc.)
  - Channel 0 (CHAN_AUTO): auto-assign free channel
  - Channel 1 (CHAN_WEAPON): weapon sounds (override previous weapon sound)
  - Other channels: voice, body, item, etc.
  - Stop previous sound on same entity+channel before starting new one

### 3D Positional Audio (Spatialization)
- [x] Create PannerNode for each sound
  - Set position from entity or origin
  - Set velocity (for Doppler effect, optional)
  - Set distance model (linear, inverse, exponential)
  - Set max distance, reference distance, rolloff factor
  - Graceful fallback to a gain-based panner shim when `AudioContext` implementations omit `createPanner`, keeping positional updates working.
- [x] Listener (player) position
  - Update listener position every frame from player entity
  - Update listener orientation (forward, up vectors)
  - Affects all spatialized sounds
- [x] Attenuation modes
  - `ATTN_NONE (0)`: No attenuation, heard everywhere (announcements)
  - `ATTN_NORM (1)`: Normal attenuation (most sounds)
  - `ATTN_IDLE (2)`: Idle attenuation (ambient loops)
  - `ATTN_STATIC (3)`: Static attenuation (close range only)
  - Map to Web Audio distance parameters
- [x] Distance falloff
  - Linear or inverse distance falloff
  - Clamp at max distance (silent beyond range)
  - Adjust rolloff factor based on attenuation mode

### Looping Sounds
- [x] Start looping sound
  - Create AudioBufferSourceNode with `loop = true`
  - Store reference for later stopping
  - Used for ambient sounds (water, lava, machines)
  - Used for continuous entity sounds (jetpack, teleporter)
- [x] Stop looping sound
  - Find active source for entity+channel
  - Call `stop()` on source node
  - Remove from active sound list
- [x] Update looping sound position
  - Each frame, update PannerNode position for moving entities
  - Used for moving platforms with sound, flying monsters

### Music System
- [x] Music streaming
  - `MusicSystem` resolves sources asynchronously (default identity resolver) and streams via injected `AudioElementLike` (HTMLAudioElement-compatible)
  - Streaming-friendly: leaves decoding/streaming to the element instead of preloading entire files
- [x] Music playback control
  - Play, pause, stop, resume helpers on `MusicSystem`
  - Volume control isolated from SFX volume, preserved when switching tracks
  - Crossfade optional/TODO
- [x] Music tracks
  - Track-agnostic loader handles main menu, level, boss, and intermission URIs provided by caller
- [x] Music triggers
  - Engine/game can call `play(track, { loop })` on level load or event hooks; API exposed via `AudioApi`

### Volume & Mixing
- [x] Master volume
  - User-configurable (0.0 - 1.0)
  - Affects all sounds
  - Connected to master gain node
- [x] Sound effect volume
  - Separate slider for SFX
  - Multiplied with master volume
- [x] Music volume
  - `MusicSystem.setVolume` controls music independently from SFX/master
- [x] Per-sound volume
  - Each sound call specifies volume (0-255 in Quake II)
  - Normalize to 0.0-1.0 for Web Audio
  - Multiply per-sound * SFX volume * master volume

### Sound Channels & Prioritization
- [x] Channel allocation
  - Limited number of simultaneous sounds (e.g., 32)
  - Allocate channel when sound plays
  - Free channel when sound ends
- [x] Channel stealing
  - If all channels busy, steal lowest-priority sound
  - Priority: player sounds > nearby entities > distant entities
  - Never steal looping sounds if possible
- [x] Channel groups
  - CHAN_AUTO, CHAN_WEAPON, CHAN_VOICE, CHAN_ITEM, CHAN_BODY
  - Some channels override previous sound (weapon fire)
  - Others stack (multiple body sounds)

### Special Sound Features
- [x] Time offset (`timeofs`)
  - Delay sound start by N milliseconds
  - Used for synchronized effects (e.g., grenade lands, then explodes)
- [x] Sound entity tracking
  - Entity panners update every frame; `stopEntitySounds` clears active channels when entities are removed
  - [x] Underwater sound filtering (optional)
    - Lowpass `BiquadFilter` wired into the master chain; toggleable with cutoff controls
    - [x] Occlusion (optional, advanced)
    - Trace from listener to sound source
    - If blocked by wall, reduce volume or apply filter
    - Lowpass filters are pre-wired for occlusion-enabled contexts so mid-sound occlusion reports can immediately clamp cutoff frequencies and later clear back to full bandwidth when visibility returns
    - Expensive, may skip for initial release

### Sound Effects Library
No implementation needed here, but be aware of sound categories:
- **Weapons**: Fire, reload, impact sounds for each weapon
- **Monsters**: Idle, sight, pain, death, attack sounds for each monster type
- **Player**: Jump, land, pain, death, drown, item pickup
- **World**: Doors, buttons, platforms, water, lava, wind
- **Items**: Pickup sounds, powerup activate/expire
- **Ambient**: Looping environment sounds (machines, fire, water)

### Audio API (game_import_t interface)
Expose to game layer:
- [x] `soundindex(name: string) -> number`: Register sound, return index (configstring placeholder preserved until precached)
- [x] `sound(entity, channel, soundindex, volume, attenuation, timeofs)`: Play positioned sound
- [x] `positioned_sound(origin, soundindex, volume, attenuation)`: Play at position (no entity)
- [x] Looping sound functions (if separate from `sound()`)
- [x] Music control functions (play, stop, volume)

### Debugging & Diagnostics
- [x] Sound visualization (optional)
  - `AudioSystem.getDiagnostics` surfaces live channel metadata (origins, gains, attenuation, occlusion) for overlays
  - Display sound names, volumes, channels
- [x] Channel usage display
  - `getDiagnostics` reports active channel count and channel table snapshot for UI consumption
  - Identify channel stealing
- [x] Volume meters
  - `getDiagnostics` exposes current master and SFX gain levels for quick meters

## Integration Points
- **From Asset Loading (Section 1)**: Receives decoded audio buffers keyed by sound index
- **From Entity System (Section 4)**: Receives entity positions for positioned sounds
- **From Combat (Section 5)**: Plays weapon fire, impact sounds
- **From AI (Section 6)**: Plays monster sounds (idle, sight, pain, death, attack)
- **To HUD (Section 8)**: May play UI sounds (menu clicks, etc.)
- **From Physics (Section 3)**: Optional trace for occlusion

## Testing Requirements

### Unit Tests (Standard)
- Sound index registration and lookup
- Volume calculation (per-sound * SFX * master)
- Channel allocation and stealing logic
- Attenuation mode to distance parameter mapping

### Integration Tests
- **Sound playback**: Play sound, verify audible, correct duration
- **Positioned sound**: Play at various positions, verify volume falloff with distance
- **3D audio**: Move listener, verify panning (left/right) and volume changes
- **Looping sound**: Start loop, verify continuous playback, stop, verify silent
- **Music playback**: Start music, verify plays, stop, pause, resume
- **Channel stealing**: Play 50 sounds simultaneously, verify oldest/lowest-priority stolen
- **Entity tracking**: Spawn moving entity with looping sound, verify sound follows entity
- **Volume controls**: Adjust master/SFX/music volumes, verify all sounds update

### Performance Tests
- **Many sounds**: 100+ simultaneous sounds, verify no crackling or distortion
- **Memory usage**: Load all game sounds, measure memory footprint
- **Latency**: Measure delay from `sound()` call to audible output (should be <50ms)

### Browser Compatibility Tests
- **Autoplay policy**: Verify context resumes on user interaction (Chrome, Safari)
- **Audio formats**: Verify WAV and OGG decode correctly on all browsers
- **Context state**: Verify recovery from suspended/interrupted contexts (mobile)

### Audio Quality Tests
- **Attenuation accuracy**: Verify distance falloff matches expected curve
- **Spatialization**: Verify 3D audio feels correct (left/right, front/back)
- **No clipping**: Play loud sounds, verify no distortion or clipping
- **Volume balance**: Verify weapons, monsters, ambient sounds have good relative volumes

## Notes
- Web Audio has browser autoplay restrictions; must wait for user interaction before starting
- AudioContext can suspend when tab inactive; handle context resume
- OGG Vorbis is well-supported, but ensure fallback or pre-decode for compatibility
- Distance models: `inverse` is most common for games, gives realistic falloff
- PannerNode has HRTF (binaural) and equalpower panning modes; HRTF is more immersive but more expensive
- Looping sounds can accumulate if not properly stopped; track and clean up carefully
- Rerelease uses OpenAL for audio; Web Audio is similar but API differs
- Some Quake II sounds are 11kHz or 22kHz; Web Audio handles resampling automatically
- Sound occlusion is expensive (requires traces) but greatly enhances immersion; consider as stretch goal
- Underwater filtering uses BiquadFilterNode (lowpass) with adjustable frequency cutoff
- Music can be large files; consider streaming via HTMLAudioElement instead of preloading
- Rerelease source reference: `snd_*.c` files (sound mixing, positioning), though OpenAL-specific
- Channel limits prevent audio overload; 32 channels is typical for games
- Doppler effect (via velocity) is subtle but adds realism for fast-moving entities
