# Section 2: Rendering System (WebGL2)

## Overview
This section covers the complete WebGL2 rendering pipeline for Quake II, including world BSP rendering with lightmaps, animated models (MD2/MD3), particle effects, and HUD/UI primitives. The renderer must faithfully reproduce the visual quality of the original while running efficiently in the browser, with support for frustum culling, PVS-based occlusion, and interpolated animation.

## Dependencies
- **Asset Loading (Section 1)**: REQUIRED - needs loaded BSP geometry, lightmaps, textures, and model data
- **Shared package**: Requires vec3 math, angle conversions - **COMPLETED**
- **Engine loop**: Requires interpolation alpha from fixed timestep loop - **COMPLETED**

## Work Already Done
- ✅ Vec3/matrix math utilities in shared package
- ✅ Fixed timestep loop with interpolation reporting (`packages/engine/src/loop.ts`)
- ✅ ConfigString registry for deterministic asset indexing

## Tasks Remaining

### WebGL2 Context & Core Abstractions
- [x] Initialize WebGL2 context with proper settings (engine `createWebGLContext` covers blending, depth/cull defaults, extension lookup, and loss/restore callbacks)
  - Alpha blending, depth testing, culling setup
  - Extension detection and fallbacks
  - Context loss/restore handling
- [x] Implement shader program management (compilation/linking helpers with uniform/attribute caching in `ShaderProgram`)
  - Shader compilation and linking utilities
  - Uniform/attribute location caching
  - Shader variant system (e.g., lightmap vs. vertex-lit)
- [x] Create GPU resource wrappers (buffer/VAO/texture/framebuffer helpers in the engine render package)
  - Vertex Buffer Objects (VBO) with typed layouts
  - Index Buffer Objects (IBO)
  - Vertex Array Objects (VAO) for state caching
  - Texture object management
  - Framebuffer objects for effects

### BSP World Rendering
- [x] Build BSP rendering data structures from loaded assets (lightmap atlas packer, face-to-texture mapping, VAO/VBO/IBO setup)
  - Convert BSP faces to GPU vertex/index buffers
  - Upload lightmap atlas to texture array or large texture
  - Create face-to-texture mapping
- [x] Implement BSP traversal and culling (frustum extraction helpers, PVS-aware leaf selection, front-to-back ordering)
  - Camera frustum culling
  - PVS (Potentially Visible Set) query from current leaf
  - Front-to-back face sorting for optimal fill rate
- [x] Shader pipeline for BSP surfaces
  - [x] Vertex shader: world transform, texture/lightmap UVs
  - [x] Fragment shader: multi-texture (diffuse + lightmap)
  - [x] Support for multiple lightmap styles (animated lighting)
  - [x] Handle special surfaces (SKY, WARP, TRANS33, TRANS66, FLOWING)
- [x] Sky rendering
  - [x] Skybox texture loading (6-sided or dome)
  - [x] Render sky faces at infinite distance
  - [x] Support scrolling/animated sky textures
  - [x] Skip drawing BSP sky surfaces in the world pass once skybox is rendered
- [x] Water/liquid surface effects
  - [x] Warp shader for SURF_WARP surfaces
  - [x] Animated texture scrolling for SURF_FLOWING
  - [ ] Optional reflection/refraction (stretch goal, deferred)

### Model Rendering (MD2/MD3)
- [x] MD2 skeletal animation renderer
  - [x] Per-frame vertex interpolation
  - [x] Upload current/next frame to GPU
  - [x] Interpolate based on lerp factor (with renormalized normals)
  - [x] Texture binding per model skin
- [x] MD3 hierarchical model renderer
  - [x] Multi-surface rendering (separate meshes)
  - [x] Tag-based attachment system (weapons attached to hand tags)
  - [x] Per-surface texture/shader assignment
- [x] Model lighting (basic directional lighting supplied in MD2 pipeline; world samples TBD)
  - [x] Vertex lighting based on current position (interpolate between BSP light samples or fallback to floor/worldspawn ambient)
  - [x] Optional dynamic lights (from weapon fire, explosions)
  - [x] Ambient + directional light from worldspawn

### Particle System
- [x] Particle emitter framework
  - Particle pool with efficient allocation
  - Per-particle state: position, velocity, color, size, lifetime
  - Update loop (gravity, air resistance, collision)
- [x] Particle rendering
  - Billboarded quads facing camera
  - Additive/alpha blending modes
  - Batch rendering for performance (instanced or dynamic VBO)
- [x] Particle effect types
  - Bullet impacts (sparks, dust)
  - Explosions (fire, smoke)
  - Blood splatter
  - Teleport/respawn effects
  - Muzzle flash
  - Trail effects (rocket, grenade)

### Dynamic Lighting
- [x] Point light data structure
  - [x] Position, color, intensity, radius
  - [x] Lifetime for temporary lights (weapon fire, explosions)
- [x] Dynamic light application
  - [x] Per-face dynamic light accumulation (via additive lighting in fragment shader)
  - [x] Or per-vertex lighting in fragment shader
  - [x] Attenuation formula matching Quake II (linear falloff based on radius)
- [x] Light rendering passes
  - [x] Base pass with lightmaps
  - [x] Additive passes for dynamic lights (integrated into single pass via uniforms)

### HUD & UI Rendering
- [x] 2D orthographic rendering mode
  - Screen-space coordinate system
  - Disable depth testing for UI
- [x] Pic (image) rendering
  - `Draw_RegisterPic` equivalent: load and cache UI images
  - `Draw_Pic` / `Draw_StretchPic`: render at specified screen coords
  - `Draw_GetPicSize`: query image dimensions for layout
  - Alpha blending for transparent HUD elements
- [x] Font rendering
  - Bitmap font atlas loading
  - Character lookup and UV mapping
  - `Draw_Char` / `Draw_String` / `Draw_AltString` equivalents
  - Color codes support (^1, ^2, etc.)
  - Text metrics for layout (width, height queries)
  - **Status**: Implemented using a bitmap font loaded from `pics/conchars.pcx`.
- [x] HUD layout system
  - [x] Status bar (health, armor, ammo)
  - [x] Weapon/item icons
  - [x] Crosshair rendering
  - [x] Damage direction indicators
  - [x] Center print messages
  - [x] Notification area

### Camera & View System
- [x] Camera state management
  - [x] Position, orientation (pitch, yaw, roll)
  - [x] FOV (field of view) setting
  - [x] Interpolation between game ticks
- [x] View matrix construction
  - [x] Convert Quake II angles to view transform
  - [x] Projection matrix (perspective)
  - [x] Handle viewmodel (weapon) rendering with separate FOV
- [x] Viewmodel rendering
  - [x] Render weapon model with higher FOV in foreground
  - [x] Separate depth range to avoid clipping with world
  - [x] Anchor transform to camera (strip world translation)
  - [x] Apply view bob, roll, and kick effects

### Render Pipeline & Optimization
- [x] Implement frame rendering sequence
  1. Clear buffers
  2. Update camera/view matrices
  3. Traverse BSP, cull, render world
  4. Render skybox
  5. Render models (entities)
  6. Render particles
  7. Render viewmodel
  8. Switch to 2D mode, render HUD
  - **Status**: All passes are now wired into the main render loop.
- [x] Occlusion culling
  - [x] Use BSP leaf/PVS data to skip invisible geometry
  - [x] Frustum culling for models
- [ ] Batching and draw call reduction
  - [x] Group faces by texture/lightmap
  - [x] Batch particle rendering
  - [x] Minimize state changes (state re-use, texture binding cache)
- [x] Frame timing and diagnostics
  - [x] FPS counter
  - [x] Draw call counter (per-frame stats reported by renderer)
  - [x] Vertex/triangle counts
  - [x] GPU time profiling using `EXT_disjoint_timer_query_webgl2`

### Material System
- [ ] Material definition structure
  - [x] Texture bindings
  - [x] Shader selection
  - [x] Blend mode (opaque, alpha, additive)
  - [x] Render flags (two-sided, depth write, etc.)
- [ ] Special material handling
  - [x] Animated textures (texture cycling)
  - [x] Scrolling textures (conveyor belts)
  - [x] Warping (water, lava)
  - [x] Transparency levels (TRANS33, TRANS66)
- [ ] Material precache and lookup
  - Match material to surface by texinfo/surface flags
  - Runtime material switching for effects

## Integration Points
- **From Asset Loading (Section 1)**: Receives BSP geometry, lightmaps, model data, textures
- **From Physics (Section 3)**: May query BSP for camera collision, dynamic light occlusion
- **To Client/HUD (Section 8)**: Exposes Draw_* functions for HUD rendering
- **From Entity System (Section 4)**: Receives entity render state (model index, frame, position, angles)

## Testing Requirements

### Unit Tests (Standard)
- Shader compilation and linking
- Matrix math (view, projection transforms)
- Texture upload and binding
- Buffer creation and updates
- Frame renderer batching/state caching and viewmodel depth range handling

### Integration Tests
- **Full frame render**: Load a map, render a complete frame with world, models, HUD
- **PVS culling correctness**: Verify invisible geometry is skipped
- **Multi-lightmap styles**: Test animated lighting (flickering, pulsing)
- **Model animation**: Render MD2 model through full animation sequence, verify smooth interpolation
- **Particle system**: Spawn 1000+ particles, verify performance and visual correctness
- **HUD rendering**: Render complete status bar, verify text and images align correctly
- **Special surfaces**: Test sky, water warp, transparent surfaces

### Performance Tests
- **Frame time budget**: Target 60 FPS (16.67ms per frame) on reference hardware
- **Draw call count**: Minimize to <500 per frame for complex scenes
- **Fill rate**: Test on high-resolution displays (1440p, 4K)
- **GPU memory usage**: Track texture/buffer memory, ensure no leaks
- **Context loss recovery**: Simulate WebGL context loss, verify clean restore

### Visual Regression Tests
- **Screenshot comparison**: Capture frames from known camera positions, compare to reference images
- **Lighting accuracy**: Verify lightmaps match original Quake II appearance
- **Animation correctness**: Check model animations match expected frame sequences

## Notes
- WebGL2 is required (not WebGL1) for features like texture arrays, instancing, and better performance
- Consider WebGPU as future enhancement, but WebGL2 has better browser support currently
- Shader compilation can be slow on first load; consider shader precompilation or caching
- Large lightmap atlases may exceed texture size limits on some devices; plan for tiling or compression
- HUD rendering should be resolution-independent (scale with window size)
- Viewmodel rendering uses a separate projection/depth range path; remaining work includes bob/roll/kick effects
- Particle system is CPU-intensive; consider GPU-based particles (compute shaders) as optimization
- PVS data is critical for performance; without it, frame rates will suffer in large maps
