# Section 18.4: Rendering Enhancements

**Priority**: 🟢 MEDIUM

This phase covers dynamic lighting, particle effects, view effects, water rendering, and sky enhancements.

---

## Phase 4: Rendering Enhancements (🟢 MEDIUM)

### 4.1 Dynamic Lighting

**Priority**: 🟢 MEDIUM
**Complexity**: MODERATE (15-25 hours)
**Original Source**: `/rerelease/cl_fx.cpp` (particle/light effects)
**TypeScript File**: `/packages/engine/src/render/dlight.ts`

#### 4.1.1 GPU Dynamic Light Implementation
- [x] Implement per-pixel dynamic lighting shader
  - Point light attenuation
  - Multiple lights per fragment
  - Reference: existing `dlight.ts` structure

- [x] Integrate dynamic lights with BSP renderer
  - Add light uniforms to BSP shader
  - Limit to nearest 8 lights per surface (Note: Implemented as global MAX_ACTIVE_LIGHTS=32 in shader for batching efficiency)
  - Reference: `/packages/engine/src/render/pipelines/bsp.ts`

- [ ] Add dynamic light culling
  - Frustum cull lights
  - Distance cull based on radius
  - Reference: `/packages/engine/src/render/renderer.ts`

#### 4.1.2 Muzzle Flash Lights
- [x] Create muzzle flash lights on weapon fire
  - Duration: 100ms
  - Color: yellow-orange
  - Intensity based on weapon
  - Reference: client handling in `cl_fx.cpp` lines 50-120

#### 4.1.3 Explosion Lights
- [x] Create explosion lights
  - Duration: 500ms with fade
  - Expanding radius
  - Orange-red color
  - Reference: `cl_fx.cpp` lines 122-200

#### 4.1.4 Rocket/Projectile Lights
- [x] Attach lights to projectiles
  - Follow projectile position
  - Color based on projectile type
  - Trail effect
  - Reference: `cl_fx.cpp` lines 202-280

---

### 4.2 Particle Effects

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE-MODERATE (10-20 hours)
**Original Source**: `/rerelease/cl_fx.cpp` (various effect functions)
**TypeScript File**: `/packages/engine/src/render/particleSystem.ts`

#### 4.2.1 Weapon Impact Effects
- [ ] Implement bullet impact particles
  - Dust puff on wall hit
  - Sparks on metal
  - Reference: `cl_fx.cpp` lines 350-420

- [ ] Implement blood splatter
  - Blood spray on flesh hit
  - Decal on nearby surfaces
  - Reference: `cl_fx.cpp` lines 422-500

- [ ] Implement explosion particles
  - Fire ball expanding
  - Smoke trailing
  - Debris chunks
  - Reference: `cl_fx.cpp` lines 502-620

#### 4.2.2 Environmental Effects
- [ ] Implement water splash
  - Ripples on water surface
  - Spray particles
  - Reference: `cl_fx.cpp` lines 622-700

- [ ] Implement steam effects
  - Rising steam particles
  - Hot water/lava proximity
  - Reference: `cl_fx.cpp` lines 702-780

#### 4.2.3 Monster Effects
- [ ] Implement monster blood trail
  - Leave blood particles when wounded
  - Different colors per monster type
  - Reference: `cl_fx.cpp` lines 782-850

- [ ] Implement gib particles
  - Chunks of flesh/metal on death
  - Physics-based trajectories
  - Reference: `cl_fx.cpp` lines 852-950

---

### 4.3 View Effects & Screen Blends

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE (8-15 hours)
**Original Source**: `/rerelease/p_view.cpp` (view calculations)
**TypeScript File**: `/packages/client/src/view.ts`

#### 4.3.1 Damage Flash
- [ ] Implement damage screen flash
  - Red blend on taking damage
  - Intensity based on damage amount
  - Fade over 200ms
  - Reference: `p_view.cpp` lines 180-250

- [ ] Apply blend to PlayerState
  - Set `blend` RGBA values
  - Client applies in render
  - Reference: existing blend system

#### 4.3.2 Powerup Effects
- [ ] Implement quad damage blue tint
  - Constant blue blend while active
  - Pulsing intensity
  - Reference: `p_view.cpp` lines 252-300

- [ ] Implement invulnerability white glow
  - White screen border
  - Full-screen flash on activation
  - Reference: `p_view.cpp` lines 302-350

- [ ] Implement environment suit green tint
  - Green blend when wearing
  - Reference: `p_view.cpp` lines 352-380

#### 4.3.3 Environmental Blends
- [ ] Implement underwater blue tint
  - Constant blue when submerged
  - Intensity based on water depth
  - Reference: `p_view.cpp` lines 382-430

- [ ] Implement lava red tint
  - Red blend when in lava
  - Pulsing effect
  - Reference: `p_view.cpp` lines 432-470

#### 4.3.4 Motion Effects
- [ ] Implement screen shake on explosions
  - Camera offset randomization
  - Duration and intensity based on distance
  - Reference: `p_view.cpp` lines 520-590

- [ ] Implement viewmodel bobbing refinements
  - Smooth weapon sway while walking
  - Running vs walking difference
  - Reference: `p_view.cpp` lines 80-170

---

### 4.4 Water Rendering

**Priority**: 🟢 MEDIUM
**Complexity**: MODERATE (20-30 hours)
**Original Source**: N/A (renderer-specific)
**TypeScript File**: `/packages/engine/src/render/pipelines/water.ts` (NEW)

#### 4.4.1 Water Surface Shader
- [ ] Create water surface rendering pipeline
  - Transparent rendering pass
  - Alpha blending
  - Reference: BSP pipeline structure

- [ ] Implement wave animation
  - Vertex displacement in shader
  - Time-based sine wave
  - Configurable wave parameters

- [ ] Implement water texture scrolling
  - Animate UV coordinates
  - SURF_FLOWING support
  - Reference: existing surface flag handling

#### 4.4.2 Refraction Effect
- [ ] Implement screen-space refraction
  - Distort background behind water
  - Render to texture
  - Apply distortion in water shader

#### 4.4.3 Underwater Caustics
- [ ] Implement animated caustic lighting
  - Projected texture animation
  - Multiply with lightmap
  - Only when underwater

---

### 4.5 Sky Rendering Enhancements

**Priority**: 🟢 MEDIUM
**Complexity**: SIMPLE (5-10 hours)
**Original Source**: `/rerelease/g_spawn.cpp` (worldspawn configstrings)
**TypeScript File**: `/packages/engine/src/render/pipelines/skybox.ts`

#### 4.5.1 Sky Rotation
- [ ] Implement sky rotation
  - Read CS_SKYROTATE configstring
  - Rotate skybox matrix each frame
  - Reference: `g_spawn.cpp` lines 850-900

- [ ] Implement sky rotation axis
  - Read CS_SKYAXIS configstring
  - Custom rotation axis (not just vertical)
  - Reference: `g_spawn.cpp` lines 880-920

#### 4.5.2 Animated Sky
- [ ] Implement cloud layer scrolling
  - Dual-layer skybox
  - Independent scroll speeds
  - Reference: BSP sky surface handling
