# Section 18.5: Audio Systems

**Priority**: 🟡 HIGH (5.1), 🟢 MEDIUM (5.2, 5.3)

This phase covers ambient sound systems, environmental audio, and music systems.

---

## Phase 5: Audio Systems (🟡 HIGH)

### 5.1 Ambient Sound System

**Priority**: 🟡 HIGH
**Complexity**: SIMPLE-MODERATE (10-15 hours)
**Original Source**: `/rerelease/g_target.cpp` (target_speaker)
**TypeScript File**: `/packages/engine/src/audio/ambient.ts` (NEW)

#### 5.1.1 Target Speaker Entity
- [ ] Implement `SP_target_speaker(entity: Entity): void`
  - Ambient sound emitter
  - Looping vs one-shot mode
  - Volume configuration
  - Attenuation distance
  - Reference: `g_target.cpp` lines 352-480

- [ ] Add to entity spawn registry
  - Register classname: "target_speaker"
  - Reference: `/packages/game/src/entities/index.ts`

#### 5.1.2 Ambient Sound Playback
- [ ] Implement looping ambient sounds
  - Create looping audio source
  - 3D spatialization
  - Auto-restart when complete
  - Reference: existing audio system

- [ ] Implement ambient sound triggering
  - Enable/disable speakers via triggers
  - Change sound file dynamically
  - Reference: `g_target.cpp` lines 420-470

---

### 5.2 Environmental Audio

**Priority**: 🟢 MEDIUM
**Complexity**: MODERATE (15-20 hours)
**Original Source**: N/A (audio-specific)
**TypeScript File**: `/packages/engine/src/audio/reverb.ts` (NEW)

#### 5.2.1 Reverb System
- [ ] Implement convolution reverb using Web Audio API
  - ConvolverNode for reverb
  - Impulse response files for different spaces

- [ ] Implement room size detection
  - Estimate room dimensions from BSP
  - Select reverb based on size
  - Small room: short decay
  - Large room: long decay

- [ ] Add reverb to audio system
  - Route sounds through reverb
  - Configurable wet/dry mix
  - Reference: `/packages/engine/src/audio/system.ts`

#### 5.2.2 Sound Occlusion
- [ ] Implement sound occlusion
  - Trace from listener to sound source
  - If blocked, apply low-pass filter
  - BiquadFilterNode in Web Audio
  - Implemented `createOcclusionResolver` in `occlusion.ts` using engine traces.
  - Validated via `tests/audio/occlusion_integration.test.ts` showing correct integration with `AudioSystem`.

- [ ] Implement distance-based low-pass
  - Attenuate high frequencies at distance
  - Realistic distant sound

---

### 5.3 Music System

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE (5-10 hours)
**Original Source**: `/rerelease/g_spawn.cpp` (worldspawn)
**TypeScript File**: `/packages/engine/src/audio/music.ts`

#### 5.3.1 CD Track System
- [ ] Implement CD track configstring handling
  - Read CS_CDTRACK from worldspawn
  - Map track numbers to music files
  - Reference: `g_spawn.cpp` lines 920-970

- [ ] Add configstring parsing in worldspawn
  - Set CS_CDTRACK in `SP_worldspawn`
  - Reference: `/packages/game/src/entities/worldspawn.ts`

#### 5.3.2 Music Transitions
- [ ] Implement music crossfading
  - Fade out current track
  - Fade in new track
  - Configurable fade duration (1-3 seconds)

- [ ] Implement track looping
  - Seamless loop points
  - Restart on completion
