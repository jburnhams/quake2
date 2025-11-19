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
- [ ] Initialize WebGL2 context with proper settings
  - Alpha blending, depth testing, culling setup
  - Extension detection and fallbacks
  - Context loss/restore handling
- [ ] Implement shader program management
  - Shader compilation and linking utilities
  - Uniform/attribute location caching
  - Shader variant system (e.g., lightmap vs. vertex-lit)
- [ ] Create GPU resource wrappers
  - Vertex Buffer Objects (VBO) with typed layouts
  - Index Buffer Objects (IBO)
  - Vertex Array Objects (VAO) for state caching
  - Texture object management
  - Framebuffer objects for effects

### BSP World Rendering
- [ ] Build BSP rendering data structures from loaded assets
  - Convert BSP faces to GPU vertex/index buffers
  - Upload lightmap atlas to texture array or large texture
  - Create face-to-texture mapping
- [ ] Implement BSP traversal and culling
  - Camera frustum culling
  - PVS (Potentially Visible Set) query from current leaf
  - Front-to-back face sorting for optimal fill rate
- [ ] Shader pipeline for BSP surfaces
  - Vertex shader: world transform, texture/lightmap UVs
  - Fragment shader: multi-texture (diffuse + lightmap)
  - Support for multiple lightmap styles (animated lighting)
  - Handle special surfaces (SKY, WARP, TRANS33, TRANS66, FLOWING)
- [ ] Sky rendering
  - Skybox texture loading (6-sided or dome)
  - Render sky faces at infinite distance
  - Support scrolling/animated sky textures
- [ ] Water/liquid surface effects
  - Warp shader for SURF_WARP surfaces
  - Animated texture scrolling for SURF_FLOWING
  - Optional reflection/refraction (stretch goal)

### Model Rendering (MD2/MD3)
- [ ] MD2 skeletal animation renderer
  - Per-frame vertex interpolation
  - Upload current/next frame to GPU
  - Interpolate in vertex shader based on lerp factor
  - Texture binding per model skin
- [ ] MD3 hierarchical model renderer
  - Multi-surface rendering (separate meshes)
  - Tag-based attachment system (weapons attached to hand tags)
  - Per-surface texture/shader assignment
- [ ] Model lighting
  - Vertex lighting based on current position (interpolate between BSP light samples)
  - Optional dynamic lights (from weapon fire, explosions)
  - Ambient + directional light from worldspawn

### Particle System
- [ ] Particle emitter framework
  - Particle pool with efficient allocation
  - Per-particle state: position, velocity, color, size, lifetime
  - Update loop (gravity, air resistance, collision)
- [ ] Particle rendering
  - Billboarded quads facing camera
  - Additive/alpha blending modes
  - Batch rendering for performance (instanced or dynamic VBO)
- [ ] Particle effect types
  - Bullet impacts (sparks, dust)
  - Explosions (fire, smoke)
  - Blood splatter
  - Teleport/respawn effects
  - Muzzle flash
  - Trail effects (rocket, grenade)

### Dynamic Lighting (Optional Enhancement)
- [ ] Point light data structure
  - Position, color, intensity, radius
  - Lifetime for temporary lights (weapon fire, explosions)
- [ ] Dynamic light application
  - Per-face dynamic light accumulation (expensive, consider simplified approach)
  - Or per-vertex lighting in fragment shader
  - Attenuation formula matching Quake II
- [ ] Light rendering passes
  - Base pass with lightmaps
  - Additive passes for dynamic lights
  - Or deferred lighting approach (advanced)

### HUD & UI Rendering
- [ ] 2D orthographic rendering mode
  - Screen-space coordinate system
  - Disable depth testing for UI
- [ ] Pic (image) rendering
  - `Draw_RegisterPic` equivalent: load and cache UI images
  - `Draw_Pic` / `Draw_StretchPic`: render at specified screen coords
  - `Draw_GetPicSize`: query image dimensions for layout
  - Alpha blending for transparent HUD elements
- [ ] Font rendering
  - Bitmap font atlas loading
  - Character lookup and UV mapping
  - `Draw_Char` / `Draw_String` / `Draw_AltString` equivalents
  - Color codes support (^1, ^2, etc.)
  - Text metrics for layout (width, height queries)
- [ ] HUD layout system
  - Status bar (health, armor, ammo)
  - Weapon/item icons
  - Crosshair rendering
  - Damage direction indicators
  - Center print messages
  - Notification area

### Camera & View System
- [ ] Camera state management
  - Position, orientation (pitch, yaw, roll)
  - FOV (field of view) setting
  - Interpolation between game ticks
- [ ] View matrix construction
  - Convert Quake II angles to view transform
  - Projection matrix (perspective)
  - Handle viewmodel (weapon) rendering with separate FOV
- [ ] Viewmodel rendering
  - Render weapon model with higher FOV in foreground
  - Separate depth range to avoid clipping with world
  - Apply view bob, roll, and kick effects

### Render Pipeline & Optimization
- [ ] Implement frame rendering sequence
  1. Clear buffers
  2. Update camera/view matrices
  3. Traverse BSP, cull, render world
  4. Render skybox
  5. Render models (entities)
  6. Render particles
  7. Render viewmodel
  8. Switch to 2D mode, render HUD
- [ ] Occlusion culling
  - Use BSP leaf/PVS data to skip invisible geometry
  - Frustum culling for models
- [ ] Batching and draw call reduction
  - Group faces by texture/lightmap
  - Batch particle rendering
  - Minimize state changes
- [ ] Frame timing and diagnostics
  - FPS counter
  - Draw call counter
  - Vertex/triangle counts
  - GPU time profiling (if extensions available)

### Material System
- [ ] Material definition structure
  - Texture bindings
  - Shader selection
  - Blend mode (opaque, alpha, additive)
  - Render flags (two-sided, depth write, etc.)
- [ ] Special material handling
  - Animated textures (texture cycling)
  - Scrolling textures (conveyor belts)
  - Warping (water, lava)
  - Transparency levels (TRANS33, TRANS66)
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
- Viewmodel rendering is tricky: must not clip through walls, requires careful depth range setup
- Particle system is CPU-intensive; consider GPU-based particles (compute shaders) as optimization
- PVS data is critical for performance; without it, frame rates will suffer in large maps
