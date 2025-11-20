# Section 8: Input, UI & Client Systems

## Overview
This section covers the client-facing systems: input capture (keyboard, mouse, gamepad), HUD rendering (status bar, crosshair, messages), menu system, client-side prediction, and browser integration (PAK file loading UI, settings, fullscreen). These systems form the player's interface to the game and must be responsive, intuitive, and faithful to the original Quake II experience.

## Dependencies
- **Rendering System (Section 2)**: REQUIRED - needs HUD rendering primitives (Draw_Pic, Draw_String, etc.)
- **Shared pmove**: REQUIRED - needs movement system for client prediction - **COMPLETED**
- **Entity System (Section 4)**: Needs player state for HUD display
- **Combat/Items (Section 5)**: Needs inventory, weapon, ammo data for HUD
- **Engine loop**: Needs interpolation alpha, timing - **COMPLETED**

## Work Already Done
- ✅ Shared pmove system with all movement logic
- ✅ Fixed timestep loop with interpolation
- ✅ ConfigString registry for HUD asset indexing
- ✅ Cvar system for settings

## Tasks Remaining

### Input Capture System
- [x] Keyboard input
  - InputController listens for keydown/keyup, tracks multiple simultaneous bindings per action, and mirrors the rerelease key
    state accumulation semantics with per-frame fractions.
  - Key repeat is coalesced by code to avoid double-pressing a held key.
  - Key bindings: map keys to actions/commands via the InputBindings map with default Quake II style bindings plus
    rebinding support.
- [x] Mouse input
  - Pointer lock aware mouse delta capture; relative motion is accumulated when `setPointerLocked(true)` has been invoked by the
    host UI (UI wiring for requesting lock is still pending).
  - Sensitivity setting (pixels to view angle conversion) and optional invert-Y handling for mouse look.
  - Mouse buttons (fire, alt fire, etc.) participate in the same binding map so button presses feed into action bits.
  - Pointer lock request/exit UI still to be connected, but the controller accepts lock state updates.
- [x] Gamepad input (optional, but nice to have)
  - Gamepad API detection
  - Map gamepad buttons/axes to actions (default mapping mirrors rerelease pad layout: RT fire, LT zoom, A jump, B crouch, X use, bumpers for weapon cycling)
  - Analog stick for movement, look with per-frame polling
  - Trigger buttons for fire and zoom
  - Deadzone handling with configurable threshold
- [x] Touch input (mobile, optional)
  - Virtual joystick for movement delivered through `InputController.setTouchState`
  - Touch drag/look applies analog camera deltas without requiring pointer lock and honors invert-Y
  - Touch buttons generate +action/-action transitions for fire, jump, crouch, etc., matching rerelease semantics
  - Per-frame touch updates are stored and merged with other inputs; tests cover button transitions and analog scaling

### Input Bindings & Commands
- [x] Key binding system
  - Map key codes to console commands (e.g., "W" -> "+forward"), including defaults for WASD/arrow keys, mouse buttons,
    and weapon number slots.
  - +/- commands: +forward (key down), -forward (key up) handled through InputAction button state tracking.
  - Allow rebinding via config/menu through the InputBindings helper (per-frame resolution covered by tests).
  - Default bindings matching Quake II run/walk/mouse-look expectations with sensitivity and run modifier constants from the
    rerelease.
- [x] Action commands
  - Movement: +forward, +back, +moveleft, +moveright, +moveup, +movedown
  - Look: +lookup, +lookdown, +left, +right
  - Actions: +attack, +use, +jump, +crouch, +walk (toggle run/walk)
  - Weapon switching: weapon 1-10, nextweapon, prevweapon
  - Other: centerview, +zoom, showscores, screenshot
  - Transition-aware queue mirrors rerelease input so +action emits once per activation and -action once upon full release.
- [x] Command buffer
  - Queue input commands each frame
  - Convert to pmove command structure (forward, side, up, angles)
  - Send to game simulation
  - InputCommandBuffer now batches per-frame UserCommands with the console/action command queue for engine consumption.
- [x] Mouse look
  - Invert Y axis option
  - Mouse sensitivity (X and Y separate)
  - Mouse smoothing/acceleration (optional)
  - Per-axis sensitivity and optional m_filter-style smoothing implemented; acceleration remains optional for later tuning.

### Client Prediction
- [ ] Implement client-side prediction
  - Maintain copy of player state
  - Run shared pmove locally on client input
  - Predict movement before server confirms
  - Reconcile with authoritative server state
- [ ] Prediction reconciliation (for future multiplayer)
  - Compare predicted state to server snapshot
  - Correct if diverged (teleport, collision misprediction)
  - Replay unacknowledged inputs after correction
  - For single-player, prediction always matches (no network lag)
- [ ] View interpolation
  - Interpolate between previous and current frame
  - Smooth out 40Hz simulation to 60+ Hz render rate
  - Apply to player position, view angles
- [ ] View effects
  - View bob (up/down sway while walking)
  - View roll (lean when strafing)
  - View kick (recoil when firing)
  - Damage angle indicators (screen flash from damage direction)

### HUD (Heads-Up Display)
All HUD elements use renderer Draw_* functions (Section 2).

- [ ] **Status bar** (bottom of screen)
  - Health number (large, red if low)
  - Armor number and icon
  - Ammo count for current weapon
  - Weapon icon
  - Pickup item icon (recently picked up item)
  - Key icons (if keys collected)
  - Powerup timers (quad damage, invulnerability, etc.)
  - Layout varies by HUD style (original, expanded)
- [ ] **Crosshair**
  - Centered on screen
  - Multiple styles selectable
  - Color customizable
  - Size customizable
- [ ] **Center print messages**
  - Large text in center of screen
  - Used for important messages ("You need the blue key")
  - Auto-fade after a few seconds
- [ ] **Notification area** (top-right or chat area)
  - Scrolling text messages
  - Pickup messages ("You got the Shotgun")
  - Objective messages
  - Obituaries (in multiplayer)
  - Fade old messages
- [ ] **Damage indicators**
  - Screen flash when taking damage
  - Directional: show which direction damage came from
  - Red tint for health loss
  - Color varies by damage type (lava, slime, etc.)
- [ ] **Weapon/item wheels** (optional, for gamepad)
  - Radial menu for weapon selection
  - Item quick-select
  - Pause game while open (or slow time)

### Menu System
- [ ] Main menu
  - Single Player (start game)
  - Multiplayer (disabled for now, or grayed out)
  - Options (settings)
  - Quit
- [ ] Map selection menu
  - List of available maps from loaded PAKs
  - Thumbnails/previews (optional)
  - Difficulty selection
  - Start map
- [ ] Options menu
  - Video settings (resolution, fullscreen, FOV, brightness)
  - Audio settings (master, SFX, music volumes)
  - Controls (key bindings, mouse sensitivity)
  - Gameplay (crosshair, HUD style, difficulty)
  - Apply and save settings
- [ ] Pause menu (during game)
  - Resume
  - Options
  - Restart level
  - Quit to main menu
- [ ] Load/Save menu
  - List save files
  - Load selected save
  - Save current game with name
  - Delete saves
- [ ] Menu navigation
  - Keyboard (arrow keys, enter, escape)
  - Mouse (click buttons)
  - Gamepad (D-pad, A/B buttons)
- [ ] Menu rendering
  - Use HUD rendering (Draw_Pic, Draw_String)
  - Background image
  - Button highlights
  - Text input fields (for save names)

### Configstring Parsing (Client Side)
- [ ] Receive configstrings from engine
  - Model indices, sound indices, image indices
  - Player names, scores (multiplayer)
  - Level name, time limit, etc.
- [ ] Update client state based on configstrings
  - Precache assets referenced by configstrings
  - Adjust HUD elements (show level name)
  - Update prediction physics settings (air accel, N64 mode)

### Browser Integration & UI
- [ ] PAK file loading interface
  - File input or drag-and-drop area
  - "Load Quake II Data Files" button/screen
  - Show loaded PAKs (baseq2, mods)
  - Validate PAKs (check for required files)
  - Error messages for invalid/missing files
- [ ] Loading screens
  - Show progress during asset loading
  - "Loading map..." with progress bar
  - Asset count (models, textures, sounds)
  - Tips or flavor text (optional)
- [ ] Settings persistence
  - Save settings to localStorage
  - Load settings on startup
  - Cvars automatically persist if marked CVAR_ARCHIVE
- [ ] Fullscreen toggle
  - Button to enter/exit fullscreen
  - Pointer lock automatically requested in fullscreen
  - Handle fullscreen API events
- [ ] Error dialogs
  - Show friendly error messages for critical failures
  - "Failed to load map", "WebGL not supported", etc.
  - Fallback to canvas/alert if full UI broken

### Client API (cgame_export_t interface)
Expose from client package to engine:
- [ ] `Init()`: Initialize client/HUD systems
- [ ] `Shutdown()`: Clean up client resources
- [ ] `DrawHUD()`: Render HUD for current frame
- [ ] `TouchPics()`: Precache HUD images (called during load)
- [ ] `LayoutFlags()`: Return HUD layout mode flags
- [ ] `Pmove()`: Client-side prediction pmove callback
- [ ] `ParseCenterPrint()`: Handle centerprint configstring updates
- [ ] `ParseNotify()`: Handle notification messages

### Interpolation & Smoothing
- [ ] Position interpolation
  - Lerp between prev and current player position
  - Use interpolation alpha from engine loop
  - Smooth out discrete 40Hz steps
- [ ] Angle interpolation
  - Slerp or shortest-path angle lerp
  - Smooth view rotation
  - Apply view bob/roll on top
- [ ] Animation interpolation
  - Lerp model frames for smooth animations
  - Blend between animation frames based on time

### View Presentation
- [ ] View bob (walking sway)
  - Sine wave based on walk cycle
  - Bob intensity setting
  - Disabled when in air
- [ ] View roll (strafe lean)
  - Lean left/right when moving sideways
  - Roll angle based on strafe velocity
  - Smooth in/out
- [ ] View kick (recoil)
  - Pitch up when firing
  - Decay back to center
  - Varies by weapon
- [ ] FOV (field of view)
  - User-configurable (60-120 degrees typical)
  - Zoom effect (reduce FOV temporarily)
  - Separate FOV for viewmodel (weapon)
- [ ] Screen blends (full-screen color tints)
  - Damage flash (red)
  - Pickup flash (green/blue)
  - Underwater tint (blue)
  - Lava/slime tint (red/green)
  - Powerup tints (quad damage, invulnerability)
  - Blend multiple colors using shared color blend math

### Accessibility & Quality of Life
- [ ] Colorblind modes
  - Adjust HUD colors for colorblind players
  - Adjust damage indicator colors
- [ ] Subtitles (optional)
  - Display text for spoken dialogue
  - Display sound effect names (for hearing-impaired)
- [ ] HUD scaling
  - Adjust HUD size for different resolutions
  - Keep readable on 4K displays
- [ ] Crosshair options
  - Multiple styles, colors, sizes
  - Disable crosshair option

## Integration Points
- **From Rendering (Section 2)**: Uses Draw_Pic, Draw_String, Draw_Char for HUD
- **From Entity System (Section 4)**: Receives player entity state
- **From Combat/Items (Section 5)**: Receives inventory, weapon, ammo, health, armor data
- **From Audio (Section 7)**: May play UI sounds (menu clicks, etc.)
- **To Game (Section 4)**: Sends player input commands
- **From Shared pmove**: Uses for client-side prediction

## Testing Requirements

### Unit Tests (Standard)
- Key binding resolution (key code -> command)
- Pmove command construction from input state
- View angle calculation from mouse delta
- Interpolation math (lerp, slerp)
- Gamepad deadzone handling

### Integration Tests
- **Input capture**: Press keys, move mouse, verify input commands generated
- **Pointer lock**: Request pointer lock, move mouse, verify camera rotates
- **Gamepad**: Connect gamepad, test all buttons/sticks
- **HUD rendering**: Render full HUD, verify all elements visible and correct
- **Menu navigation**: Navigate all menus with keyboard, mouse, gamepad
- **Settings persistence**: Change settings, reload page, verify settings restored
- **PAK loading UI**: Drag-and-drop PAK file, verify loads and lists maps
- **Fullscreen**: Enter/exit fullscreen, verify works correctly
- **Client prediction**: Move player, verify smooth interpolation between frames

### Browser Compatibility Tests
- **Pointer lock**: Test on Chrome, Firefox, Safari
- **Fullscreen API**: Test on all browsers
- **LocalStorage**: Verify settings save/load
- **Gamepad API**: Test on various browsers
- **Touch events**: Test on mobile (if supported)

### Performance Tests
- **Input latency**: Measure time from input to action (should be <16ms)
- **HUD render time**: Should be <1ms (HUD is 2D, fast)
- **Menu render time**: Should be <5ms

### Usability Tests
- **Key bindings**: Verify default bindings feel good
- **Mouse sensitivity**: Test various sensitivities, verify feels responsive
- **HUD readability**: Verify HUD text legible at various resolutions
- **Menu clarity**: Verify menu layout intuitive, buttons obvious

## Notes
- Pointer lock is essential for FPS controls; without it, mouse hits screen edges
- Browser autoplay policies affect pointer lock too; may need user click
- Input should feel responsive; minimize latency between input and visual feedback
- Client prediction eliminates perceived input lag in multiplayer; less critical for single-player but still important for smoothness
- View bob/roll should be subtle; too much causes motion sickness
- HUD must scale well across resolutions (1080p, 1440p, 4K)
- Menu system can be complex; consider using a UI library (React, Vue) or keep it simple with direct canvas rendering
- LocalStorage has size limits; settings are small, but save files may need IndexedDB
- Gamepad support is nice-to-have; keyboard+mouse is primary for FPS
- Rerelease source reference: `cg_*.c` files (client game HUD/prediction), `cl_*.c` (input, view, screen)
- HUD layout can be customized; consider multiple HUD styles (classic, modern)
- Color codes in strings (^1, ^2, etc.) should be parsed and rendered in color
- Center print and notification messages should stack and auto-scroll
- Damage direction indicators greatly improve spatial awareness; important for gameplay
- FOV >90 degrees can cause distortion; warn user if they set very high FOV
