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
- [ ] Initialize AudioContext
  - Handle browser autoplay policies (require user interaction)
  - Resume context on user input (click, keypress)
  - Handle context state changes (suspended, running)
- [ ] Create master audio graph
  - Master gain node (volume control)
  - Optional compressor/limiter (prevent clipping)
  - Route to destination (speakers)
- [ ] Audio channel management
  - Fixed number of channels (e.g., 32 simultaneous sounds)
  - Channel allocation: find free channel or steal lowest-priority
  - Track active sounds per channel

### Sound Registration & Precaching
- [ ] Sound index registry
  - Map sound name -> sound index (via ConfigString registry)
  - Called during level load by game layer (`soundindex("weapons/blastf1a.wav")`)
  - Return unique index for each sound
- [ ] Sound loading
  - Load audio buffer from VFS/PAK
  - Decode (WAV, OGG) to PCM buffer
  - Store in cache keyed by index
  - Async loading with loading state tracking
- [ ] Sound precaching
  - Preload all sounds used in level during load screen
  - Reduce latency during gameplay

### Sound Playback (One-Shot Sounds)
- [ ] Play positioned sound
  - **Signature**: `sound(entity: Entity, channel: number, soundindex: number, volume: number, attenuation: number, timeofs: number)`
  - Create AudioBufferSourceNode from cached buffer
  - Connect to PannerNode for 3D positioning
  - Set position from entity origin
  - Set volume, attenuation (distance falloff)
  - Set timeofs (delayed start, for timing effects)
  - Start playback
  - Auto-cleanup when sound finishes
- [ ] Play ambient sound (no attenuation)
  - **Signature**: `ambient_sound(origin: vec3, soundindex: number, volume: number)`
  - Used for environmental sounds (water, wind, machines)
  - Positioned but no distance falloff
  - Often looping
- [ ] Channel assignment
  - Channels 0-7: entity sounds (weapon fire, pain, etc.)
  - Channel 0 (CHAN_AUTO): auto-assign free channel
  - Channel 1 (CHAN_WEAPON): weapon sounds (override previous weapon sound)
  - Other channels: voice, body, item, etc.
  - Stop previous sound on same entity+channel before starting new one

### 3D Positional Audio (Spatialization)
- [ ] Create PannerNode for each sound
  - Set position from entity or origin
  - Set velocity (for Doppler effect, optional)
  - Set distance model (linear, inverse, exponential)
  - Set max distance, reference distance, rolloff factor
- [ ] Listener (player) position
  - Update listener position every frame from player entity
  - Update listener orientation (forward, up vectors)
  - Affects all spatialized sounds
- [ ] Attenuation modes
  - `ATTN_NONE (0)`: No attenuation, heard everywhere (announcements)
  - `ATTN_NORM (1)`: Normal attenuation (most sounds)
  - `ATTN_IDLE (2)`: Idle attenuation (ambient loops)
  - `ATTN_STATIC (3)`: Static attenuation (close range only)
  - Map to Web Audio distance parameters
- [ ] Distance falloff
  - Linear or inverse distance falloff
  - Clamp at max distance (silent beyond range)
  - Adjust rolloff factor based on attenuation mode

### Looping Sounds
- [ ] Start looping sound
  - Create AudioBufferSourceNode with `loop = true`
  - Store reference for later stopping
  - Used for ambient sounds (water, lava, machines)
  - Used for continuous entity sounds (jetpack, teleporter)
- [ ] Stop looping sound
  - Find active source for entity+channel
  - Call `stop()` on source node
  - Remove from active sound list
- [ ] Update looping sound position
  - Each frame, update PannerNode position for moving entities
  - Used for moving platforms with sound, flying monsters

### Music System
- [ ] Music streaming
  - Load music files (OGG, typically)
  - Use HTMLAudioElement or AudioBufferSourceNode
  - Stream long tracks (don't load entire file into memory)
- [ ] Music playback control
  - Play, pause, stop, resume
  - Volume control (separate from SFX volume)
  - Crossfade between tracks (optional)
- [ ] Music tracks
  - Main menu music
  - Level music (varies by map)
  - Boss fight music
  - Intermission music
- [ ] Music triggers
  - Start music on level load
  - Change music on events (boss spawn, etc.)

### Volume & Mixing
- [ ] Master volume
  - User-configurable (0.0 - 1.0)
  - Affects all sounds
  - Connected to master gain node
- [ ] Sound effect volume
  - Separate slider for SFX
  - Multiplied with master volume
- [ ] Music volume
  - Separate slider for music
  - Independent from SFX volume
- [ ] Per-sound volume
  - Each sound call specifies volume (0-255 in Quake II)
  - Normalize to 0.0-1.0 for Web Audio
  - Multiply per-sound * SFX volume * master volume

### Sound Channels & Prioritization
- [ ] Channel allocation
  - Limited number of simultaneous sounds (e.g., 32)
  - Allocate channel when sound plays
  - Free channel when sound ends
- [ ] Channel stealing
  - If all channels busy, steal lowest-priority sound
  - Priority: player sounds > nearby entities > distant entities
  - Never steal looping sounds if possible
- [ ] Channel groups
  - CHAN_AUTO, CHAN_WEAPON, CHAN_VOICE, CHAN_ITEM, CHAN_BODY
  - Some channels override previous sound (weapon fire)
  - Others stack (multiple body sounds)

### Special Sound Features
- [ ] Time offset (`timeofs`)
  - Delay sound start by N milliseconds
  - Used for synchronized effects (e.g., grenade lands, then explodes)
- [ ] Sound entity tracking
  - When entity moves, update sound position
  - When entity dies/removed, stop entity sounds
- [ ] Underwater sound filtering (optional)
  - Apply lowpass filter when player underwater
  - Muffled, distant sound effect
  - Toggle filter based on player water level
- [ ] Occlusion (optional, advanced)
  - Trace from listener to sound source
  - If blocked by wall, reduce volume or apply filter
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
- [ ] `soundindex(name: string) -> number`: Register sound, return index
- [ ] `sound(entity, channel, soundindex, volume, attenuation, timeofs)`: Play positioned sound
- [ ] `positioned_sound(origin, soundindex, volume, attenuation)`: Play at position (no entity)
- [ ] Looping sound functions (if separate from `sound()`)
- [ ] Music control functions (play, stop, volume)

### Debugging & Diagnostics
- [ ] Sound visualization (optional)
  - Show active sound sources in 3D (debug overlay)
  - Display sound names, volumes, channels
- [ ] Channel usage display
  - Show how many channels active
  - Identify channel stealing
- [ ] Volume meters
  - Visual feedback for master/SFX/music volumes

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
