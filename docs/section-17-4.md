# Section 17.4: Single Player Gameplay

**Goal**: Enable full single-player game functionality with save/load, complete game loop, and all features.

---

## 4.1 Game Initialization API

### 4.1.1 Game Session Management
- [x] Create `GameSession` class wrapping game, client, and engine lifecycle
- [x] Add method `createSession(options: SessionOptions): GameSession`
- [x] Options: map name, skill level, render mode, audio enabled
- [x] Add method `startNewGame(mapName: string, skill: number): void`
- [x] Add method `loadSavedGame(saveData: SaveData): void`
- [x] Add method `shutdown(): void` for cleanup

### 4.1.2 Input Integration
- [x] Expose `InputController` with method `bindInputSource(source: InputSource): void`
- [x] Support keyboard, mouse, gamepad, touch inputs
- [x] Add method `setKeyBinding(action: string, keys: string[]): void`
- [x] Add method `getDefaultBindings(): KeyBindings` for webapp initialization
- [x] Add event `onInputCommand?: (cmd: UserCommand) => void` for input recording

### 4.1.3 Game State Queries
- [x] Add method `getPlayerState(): PlayerState` for current player status
- [x] Add method `getGameTime(): number` returning elapsed game seconds
- [x] Add method `isPaused(): boolean`
- [x] Add method `getSkillLevel(): number`
- [x] Add method `getMapName(): string`
- [x] Add method `getGameMode(): string` (single/deathmatch/coop)

---

## 4.2 HUD and UI Integration

### 4.2.1 HUD Data API
- [x] Create `getHudData(): HudData` method for webapp HUD rendering (headless mode)
- [x] Return: health, armor, ammo, weapon, inventory, pickups, damage indicators
- [x] Add method `getStatusBar(): StatusBarData` for classic Quake 2 HUD
- [x] Add method `getCrosshairInfo(): CrosshairInfo` for hit indication
- [x] Add event `onHudUpdate?: (data: HudData) => void` for reactive UI

### 4.2.2 Message Display
- [ ] Add event `onCenterPrint?: (message: string, duration: number) => void` for center messages
- [ ] Add event `onNotify?: (message: string) => void` for console-style notifications
- [ ] Add event `onPickupMessage?: (item: string) => void` for pickup feedback
- [ ] Add event `onObituaryMessage?: (message: string) => void` for death messages

### 4.2.3 Menu Integration
- [ ] Expose `MenuSystem` API for pause/options menus
- [ ] Add method `showPauseMenu(): void` and `hidePauseMenu(): void`
- [ ] Add method `isMenuActive(): boolean` to pause game updates
- [ ] Add event `onMenuStateChange?: (active: boolean) => void`
- [ ] Provide menu data structure for webapp custom rendering

---

## 4.3 Save/Load System

### 4.3.1 Save Game API
- [ ] Add method `saveGame(slotName: string): Promise<SaveData>`
- [ ] Return serialized game state as transferable object
- [ ] Include: player state, entity states, inventory, level time, map name
- [ ] Add method `getSaveMetadata(saveData: SaveData): SaveMetadata`
- [ ] Return: timestamp, map name, player health, screenshot (optional)

### 4.3.2 Load Game API
- [ ] Add method `loadGame(saveData: SaveData): Promise<void>`
- [ ] Restore full game state from save data
- [ ] Add validation to detect corrupted saves
- [ ] Add event `onLoadComplete?: () => void`
- [ ] Add event `onLoadError?: (error: Error) => void`

### 4.3.3 Quick Save/Load
- [ ] Add method `quickSave(): Promise<void>` to internal slot
- [ ] Add method `quickLoad(): Promise<void>` from last quick save
- [ ] Add method `hasQuickSave(): boolean`

---

## 4.4 Missing Game Features

### 4.4.1 Complete Weapon System
- [ ] Implement all weapon alt-fires (if applicable to rerelease)
- [ ] Implement weapon switching queue/cycle logic
- [ ] Add ammo depletion and auto-switch on empty
- [ ] Add weapon animations and proper view weapon rendering
- [ ] Fix weapon firing state machine edge cases

### 4.4.2 Power-ups and Items
- [x] Implement quad damage visual and damage multiplication
- [x] Implement invulnerability effect (screen tint, damage immunity)
- [x] Implement environment suit (breathing underwater, lava protection)
- [x] Implement power screen/shield effects
- [ ] Add proper item respawn timers and visual indicators

### 4.4.3 Complete Monster AI
- [ ] Implement pathfinding using monster_path_corner entities
- [ ] Fix monster sight/sound perception edge cases
- [ ] Implement all monster attacks and special moves
- [ ] Add monster pain/death animations and sounds
- [ ] Implement monster-specific behaviors (flying, swimming, jumping)

### 4.4.4 Level Triggers and Scripts
- [x] Complete trigger_relay, trigger_counter, trigger_always implementations
- [x] Implement target_speaker for ambient sounds
- [x] Implement target_explosion, target_splash effects
- [x] Implement func_timer for repeating events
- [x] Implement target_changelevel for map transitions
- [ ] Fix complex entity chains (multi-target, delayed activation)

### 4.4.5 Special Effects
- [ ] Implement dynamic lights for muzzle flashes, explosions, rockets
- [ ] Implement light styles for flickering/pulsing lights
- [ ] Implement screen blend effects (damage red, pickup flash, underwater tint)
- [ ] Implement view kick/roll for damage and movement
- [ ] Add particle effects for all weapon impacts and explosions

---

## 4.5 Audio Completeness

### 4.5.1 Missing Sound Features
- [ ] Implement ambient sound looping for all entities
- [ ] Add attenuation curves matching original Quake 2
- [ ] Implement sound occlusion (muffled through walls)
- [ ] Add reverb/environment effects for different map areas
- [ ] Fix spatialization edge cases (inside entity bounds)

### 4.5.2 Music System
- [ ] Add music track crossfading for smooth transitions
- [ ] Implement music triggers (target_music or map-based)
- [ ] Add configurable music volume separate from SFX
- [ ] Support OGG Vorbis and fallback formats
