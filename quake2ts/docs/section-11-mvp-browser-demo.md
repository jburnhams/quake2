# Section 11: MVP Browser Demo

## Overview
This section focuses on creating a **minimal viable product (MVP) browser demo** that brings together all the implemented functionality into a playable, visual experience. The goal is to create a working demo as quickly as possible so you can see, experiment with, and showcase the Quake II port's current capabilities in a browser. This demo will live in `apps/demo` as a new application component separate from the minimal `apps/viewer`.

The demo prioritizes **getting something running** over feature completeness. It will be rough around the edges but functional enough to:
- Load user-provided PAK files
- Parse and render a Quake II map
- Spawn and control a player entity
- Display basic gameplay HUD
- Accept keyboard/mouse input
- Show debug visualizations of what's working

This is your **first playable build** - a critical milestone for validation, debugging, and motivation.

## Philosophy
- **Glue over Polish**: Focus on connecting existing systems, not perfecting them
- **Visible Progress**: Every piece should contribute to something you can see or interact with
- **Debug-Friendly**: Include visualizations and diagnostics to understand what's happening
- **Iterative**: Start with the bare minimum, add features incrementally
- **Hacky is OK**: Shortcuts and hardcoded values are acceptable for the demo

## Dependencies
- **Asset Loading (Section 1)**: CRITICAL - needs PAK ingestion, BSP parsing, texture loading
- **Rendering (Section 2)**: CRITICAL - needs BSP world rendering, basic 3D setup
- **Physics (Section 3)**: Partial - needs collision for player movement
- **Entity System (Section 4)**: Partial - needs player entity spawn
- **Input (Section 8)**: CRITICAL - needs keyboard/mouse capture
- **Shared pmove (Section 8)**: CRITICAL - needs player movement

## Demo Architecture

### User Journey
1. **Landing Page**: Show "Load Quake II Data" button
2. **File Loading**: User drops PAK file(s), app validates and mounts VFS
3. **Map Selection**: Show list of available maps from PAK
4. **Loading Screen**: Parse map, load assets, show progress
5. **In-Game**: First-person view, can move around map with WASD/mouse
6. **HUD**: Simple overlay showing position, velocity, FPS, etc.
7. **Debug Panel**: Toggle visibility of collision geometry, entity bounds, etc.

### App Structure (`apps/demo`)
```
apps/demo/
├── src/
│   ├── index.html          # Main HTML page
│   ├── main.ts             # Entry point, initialization
│   ├── ui/
│   │   ├── landing.ts      # PAK loading UI
│   │   ├── mapSelect.ts    # Map picker
│   │   ├── loading.ts      # Loading progress screen
│   │   └── hud.ts          # In-game HUD overlay
│   ├── demo/
│   │   ├── DemoApp.ts      # Main demo application class
│   │   ├── DemoWorld.ts    # World/map management
│   │   ├── DemoPlayer.ts   # Player entity and controls
│   │   └── DemoRenderer.ts # Rendering coordination
│   └── debug/
│       ├── DebugOverlay.ts # FPS, position, velocity display
│       └── DebugDraw.ts    # Wireframe collision, entity bounds
├── public/
│   └── styles.css          # Basic styling
├── package.json
├── vite.config.ts          # Vite bundler config
└── tsconfig.json
```

## Critical Missing Pieces (From Other Sections)

These pieces are **essential blockers** for the demo and must be completed in their respective sections before the demo will work:

### From Section 2 (Rendering)
- [x] **WebGL2 context initialization** ✅ (already done)
- [x] **Shader compilation helpers** ✅ (already done)
- [x] **BSP world rendering basics** ✅ (already done)
  - [x] Upload BSP geometry to GPU ✅
  - [x] Basic vertex/fragment shaders for world ✅
  - [x] Texture binding ✅
  - [x] Lightmap support ✅
- [ ] **HUD/2D rendering primitives** ⚠️ CRITICAL
  - [ ] `Draw_RegisterPic(name)`: Load HUD image, return handle
  - [ ] `Draw_Pic(x, y, pic)`: Draw image at screen position
  - [ ] `Draw_String(x, y, text)`: Draw text string
  - [ ] `Draw_Char(x, y, char)`: Draw single character
  - [ ] Bitmap font rendering or canvas-based text
  - **Status**: NOT IMPLEMENTED - this blocks all HUD/debug text
- [ ] **Camera/view matrix setup**
  - [ ] Perspective projection matrix
  - [ ] View matrix from player position/angles
  - [ ] Frustum culling (optional for MVP, improves performance)
  - **Status**: Partially done, needs player integration

### From Section 3 (Physics/Collision)
- [x] **BSP collision trace** ✅ (core trace done)
  - [x] `trace(start, end, mins, maxs, contentmask)` working ✅
  - [x] Collision with world geometry ✅
- [ ] **Player movement integration** ⚠️ CRITICAL
  - [ ] Wire shared pmove to real trace function
  - [ ] Implement pmove callback for player entity
  - [ ] Ground detection, step climbing
  - [ ] Apply player inputs (forward/back/strafe) to pmove
  - **Status**: Trace works, but not wired to player movement yet

### From Section 4 (Entity System)
- [ ] **Player entity spawn** ⚠️ CRITICAL
  - [ ] Create player entity at map spawn point
  - [ ] Initialize player state (health, position, angles)
  - [ ] Set player bounding box (standing mins/maxs)
  - [ ] Attach player to camera for rendering
  - **Status**: Entity system exists, but no player spawn logic

### From Section 8 (Input/UI)
- [x] **Keyboard input capture** ✅ (already done)
- [x] **Mouse look with pointer lock** ✅ (already done)
- [ ] **Input command buffer** ⚠️ CRITICAL
  - [x] Convert input state to pmove command structure ✅
  - [ ] Pass commands to player entity each frame
  - **Status**: Input works, but not connected to player movement

### From Section 1 (Asset Loading)
- [x] **PAK file reader** ✅ (already done)
- [x] **VFS with browser file input** ✅ (already done)
- [x] **BSP loader** ✅ (already done)
- [x] **Texture loading and upload** ✅ (already done)
- [ ] **Find player spawn point** ⚠️ NEEDED
  - [ ] Parse `info_player_start` from BSP entity string
  - [ ] Extract origin and angles for player spawn
  - **Status**: BSP entity parsing exists, need to query spawn points

## Demo-Specific Tasks

These are tasks specific to the `apps/demo` application, not core engine/game work:

### Phase 1: Basic Skeleton (Get Something on Screen)
- [ ] **Set up demo app scaffold**
  - [ ] Create `apps/demo` directory structure
  - [ ] Set up Vite bundler for TypeScript + HTML
  - [ ] Create basic `index.html` with canvas element
  - [ ] Wire up TypeScript entry point (`main.ts`)
  - [ ] Add CSS for fullscreen canvas
- [ ] **Initialize WebGL canvas**
  - [ ] Get canvas element, create WebGL2 context
  - [ ] Set up viewport, clear color
  - [ ] Render loop with `requestAnimationFrame`
  - [ ] Show FPS counter (basic benchmark)
- [ ] **Test render something simple**
  - [ ] Render single colored triangle (sanity check)
  - [ ] Rotate triangle to verify animation loop
  - **Goal**: Prove WebGL2 works in the demo app

### Phase 2: PAK Loading UI
- [ ] **Create landing page**
  - [ ] Show title "Quake II TS Demo"
  - [ ] "Load PAK Files" button and drag-drop area
  - [ ] Instructions: "Drag baseq2/pak0.pak here"
  - [ ] Style with basic CSS
- [ ] **Wire PAK file input**
  - [ ] Handle file drop events
  - [ ] Call engine VFS ingest functions
  - [ ] Show loading progress (file size, bytes loaded)
  - [ ] Display error if PAK invalid
  - [ ] Show success message when mounted
- [ ] **Validate PAK contents**
  - [ ] Check for required files (maps/*.bsp, pics/*, textures/*)
  - [ ] List available maps from VFS
  - [ ] Warn if incomplete (missing textures, etc.)
- [ ] **Persist PAK in IndexedDB (optional)**
  - [ ] Cache PAK data to avoid re-uploading
  - [ ] Show "Previously loaded PAK detected" on reload
  - **Goal**: User can load their Quake II data into the demo

### Phase 3: Map Selection & Loading
- [ ] **Build map selection screen**
  - [ ] Query VFS for `maps/*.bsp` files
  - [ ] Display list of map names (e.g., "base1", "base2")
  - [ ] Clickable list items
  - [ ] "Load Map" button
- [ ] **Implement map loading**
  - [ ] Show loading screen with progress bar
  - [ ] Call BSP loader with selected map
  - [ ] Report loading stages:
    - Parsing BSP header
    - Loading geometry
    - Loading lightmaps
    - Loading textures
    - Building GPU buffers
  - [ ] Handle loading errors gracefully
  - [ ] Transition to in-game view when complete
- [ ] **Parse entity spawn points**
  - [ ] Extract entity string from BSP
  - [ ] Find first `info_player_start` entity
  - [ ] Parse `origin` and `angle` keys
  - [ ] Store spawn position for player
  - **Goal**: Load a real Quake II map and prepare it for rendering

### Phase 4: Render the World
- [ ] **Set up camera**
  - [ ] Create camera class with position, angles, FOV
  - [ ] Build view matrix from camera position/angles
  - [ ] Build projection matrix (90° FOV, near/far planes)
  - [ ] Initially position camera at map spawn point
- [ ] **Render BSP world**
  - [ ] Upload BSP geometry to GPU (use existing engine renderer)
  - [ ] Bind world textures
  - [ ] Draw all BSP faces (no culling initially)
  - [ ] Apply lightmaps
  - [ ] Render in 3D with camera matrices
- [ ] **Handle map-specific setup**
  - [ ] Parse worldspawn entity for sky, fog, ambient settings
  - [ ] Clear color based on map settings
  - [ ] Set up skybox rendering (if available, otherwise skip)
- [ ] **Test navigation**
  - [ ] Hardcode camera movement (keyboard W/A/S/D)
  - [ ] Hardcode camera rotation (arrow keys or mouse)
  - [ ] Fly around map to verify rendering
  - **Goal**: See the Quake II map rendered in 3D, fly around freely

### Phase 5: Player Entity & Movement
- [ ] **Spawn player entity**
  - [ ] Create player entity at spawn point
  - [ ] Set bounding box (16x16x56 standing)
  - [ ] Initialize health (100), armor (0)
  - [ ] Set initial angles from spawn point
- [ ] **Wire input to player**
  - [ ] Capture keyboard state (W/A/S/D, space, ctrl)
  - [ ] Capture mouse delta for view rotation
  - [ ] Build pmove command structure each frame
  - [ ] Set forward/side/up movement from keys
  - [ ] Set angles from mouse look
- [ ] **Run pmove for player**
  - [ ] Call shared pmove with player state + input
  - [ ] Provide trace callback (using engine collision)
  - [ ] Update player position/velocity from pmove result
  - [ ] Detect ground, handle jumping
  - [ ] Handle crouch (toggle or hold)
- [ ] **Attach camera to player**
  - [ ] Set camera position = player position + view height
  - [ ] Set camera angles = player angles
  - [ ] Apply view bob (optional, adds realism)
  - [ ] Interpolate camera smoothly (framerate independent)
- [ ] **Test player movement**
  - [ ] Walk around map, verify collision with walls
  - [ ] Jump, verify air control and landing
  - [ ] Strafe, verify side movement
  - [ ] Walk up stairs, verify step climbing
  - **Goal**: Full player movement with real physics

### Phase 6: Basic HUD & Debug Info
- [ ] **Implement HUD text rendering**
  - [ ] Choose approach:
    - Option A: Canvas 2D overlay (easiest)
    - Option B: WebGL bitmap font (more authentic)
    - Option C: HTML/CSS overlay (simplest)
  - [ ] Implement `Draw_String(x, y, text)` using chosen method
  - [ ] Test rendering text at various positions
- [ ] **Create debug overlay**
  - [ ] Top-left corner: FPS counter
  - [ ] Position: `x, y, z` coordinates
  - [ ] Velocity: `vx, vy, vz` speeds
  - [ ] Ground status: "On Ground" / "In Air"
  - [ ] Health: `100` (hardcoded for now)
  - [ ] Current map name
- [ ] **Add toggle key for debug info**
  - [ ] Press ` (backtick) or F1 to show/hide
  - [ ] Default: visible
- [ ] **Optional: Crosshair**
  - [ ] Draw simple crosshair in center of screen
  - [ ] Can be a dot or small cross
  - **Goal**: See real-time player state and debug info

### Phase 7: Debug Visualizations
- [ ] **Collision geometry visualization**
  - [ ] Render BSP brush wireframes (optional)
  - [ ] Render player bounding box as wireframe
  - [ ] Show trace lines for pmove queries
  - [ ] Toggle with F2 key
- [ ] **Entity visualization**
  - [ ] Render entity origins as colored spheres
  - [ ] Show entity bounding boxes
  - [ ] Label entities with classname
  - [ ] Toggle with F3 key
- [ ] **Camera debug info**
  - [ ] Show frustum planes (optional)
  - [ ] Show current leaf index (BSP traversal)
  - [ ] Show PVS status
- [ ] **Performance overlay**
  - [ ] Frame time graph (last 60 frames)
  - [ ] Draw call count
  - [ ] Triangle count
  - [ ] Memory usage
  - [ ] Toggle with F4 key
- [ ] **Console output**
  - [ ] Overlay text log at bottom of screen
  - [ ] Log important events (map loaded, player spawned, etc.)
  - [ ] Scrollable with page up/down
  - **Goal**: Rich debugging tools to understand what's happening

### Phase 8: Polish & Usability
- [ ] **Main menu**
  - [ ] Escape key to pause game, show menu
  - [ ] Menu options:
    - Resume
    - Load Different Map
    - Reload Current Map
    - Load Different PAK
    - Quit to Landing Page
  - [ ] Render menu over paused game
- [ ] **Settings panel**
  - [ ] Mouse sensitivity slider
  - [ ] FOV slider (60-120°)
  - [ ] Toggle view bob
  - [ ] Toggle debug overlays
  - [ ] Save settings to localStorage
- [ ] **Error handling UI**
  - [ ] Show friendly error messages on screen
  - [ ] "Failed to load map: base1.bsp not found"
  - [ ] "WebGL2 not supported" with link to supported browsers
  - [ ] Allow recovery without page reload
- [ ] **Loading states**
  - [ ] Smooth transitions between screens
  - [ ] Spinner or progress indicator
  - [ ] Prevent interaction during loading
- [ ] **Responsive layout**
  - [ ] Fullscreen toggle button
  - [ ] Scale HUD for different resolutions
  - [ ] Handle window resize gracefully
- [ ] **README for demo**
  - [ ] Instructions: where to get Quake II PAK files
  - [ ] Controls: WASD, mouse, spacebar, etc.
  - [ ] Known limitations and missing features
  - [ ] How to report issues or contribute
  - **Goal**: Usable, understandable demo app

## Minimal Feature Set for MVP

The **absolute minimum** to have a functional demo:

### Must Have
1. ✅ Load PAK file from browser
2. ✅ Parse and load BSP map
3. ✅ Render 3D world geometry
4. ❌ Spawn player at map start
5. ❌ WASD + mouse controls with collision
6. ❌ Basic HUD showing position/FPS
7. ❌ Fullscreen mode

### Nice to Have (Defer if Needed)
- Entity visualization
- Debug wireframes
- Performance overlay
- Main menu
- Settings panel
- Multiple map support (start with one hardcoded map)

### Explicitly Out of Scope for MVP
- Weapons/combat (Section 5 incomplete)
- Monsters/AI (Section 6 incomplete)
- Audio (Section 7 complete, but not critical for first demo)
- HUD graphics (can use plain text)
- Particle effects
- Skybox rendering (can use solid color)
- Save/load
- Multiplayer

## Implementation Strategy

### Week 1: Core Infrastructure
- Set up demo app scaffold
- Get WebGL2 working with test triangle
- Wire PAK loading UI
- Load and parse a BSP map

### Week 2: Rendering & Player
- Render world geometry with textures
- Implement player spawn
- Wire input to player movement
- Get player walking around map

### Week 3: HUD & Debug
- Implement text rendering
- Create debug overlay
- Add debug visualizations
- Polish usability

### Ongoing: Fix Critical Gaps
Work in parallel on the critical missing pieces in other sections:
- HUD rendering primitives (Section 2)
- Player movement integration (Section 3)
- Player spawn logic (Section 4)
- Input-to-movement wiring (Section 8)

## Testing Strategy

### Manual Testing Checklist
- [ ] Can load baseq2/pak0.pak successfully
- [ ] Map list shows available maps
- [ ] Can load base1.bsp without errors
- [ ] World geometry renders correctly
- [ ] Can move player with WASD
- [ ] Can look around with mouse
- [ ] Collision prevents walking through walls
- [ ] Can jump and land
- [ ] FPS counter updates
- [ ] Position/velocity display updates
- [ ] Debug overlays toggle correctly
- [ ] Can reload map without errors
- [ ] Can load different map
- [ ] Performance is acceptable (>30 FPS)

### Browser Compatibility
Test on:
- Chrome (primary target)
- Firefox (should work)
- Safari (may have issues with pointer lock)
- Edge (should work)

### Performance Targets
- Maintain 60 FPS on reference hardware (mid-range laptop)
- Load base1.bsp in <5 seconds
- PAK ingestion in <10 seconds for 400MB file

## Success Criteria

The demo is **successful** when:
1. ✅ You can load a real Quake II PAK file in the browser
2. ✅ You can see a Quake II map rendered in 3D
3. ❌ You can walk around the map with WASD/mouse controls
4. ❌ You can see your position, velocity, and FPS on screen
5. ❌ The experience is smooth (no crashes, acceptable FPS)

At this point, you have a **playable MVP demo** that validates the port and provides a foundation for adding weapons, monsters, audio, and other features incrementally.

## Future Enhancements (Post-MVP)

Once the MVP is working, you can incrementally add:
- **Combat**: Spawn a monster, fire weapon, see damage
- **Items**: Spawn health/ammo pickups, collect them
- **Audio**: Add weapon sounds, footsteps, ambient
- **HUD Graphics**: Replace text with Quake II HUD images
- **Multiple maps**: Support map transitions
- **Save/Load**: Quick save/load functionality
- **Better graphics**: Particles, dynamic lights, skybox
- **AI**: Monsters that move and attack
- **Full game**: Complete single-player campaign

But for now, focus on **getting the MVP running** so you can see your work in action and build momentum.

## Integration Points
- **From All Sections**: This demo integrates and exercises work from every section
- **To Documentation**: Serves as a living example of how to use the engine
- **To Testing**: Provides manual testing environment for all subsystems
- **To Contributors**: Shows potential contributors what's possible

## Notes
- The demo is a **separate app**, not part of the core engine/game packages
- It's OK to have demo-specific hacks and shortcuts
- Prioritize **visibility** over **correctness** initially
- The goal is to **unblock experimentation**, not ship a polished product
- Use this demo to drive development priorities: what's blocking the demo is what to work on next
- Keep the demo simple; resist feature creep until MVP is solid
- Document limitations clearly so users know what to expect
- The demo will evolve as more sections are completed
- Consider this the **first playable build** of many iterations
