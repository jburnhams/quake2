# Section 17.6: Advanced Features

**Goal**: Polish and additional features for production-quality experience.

---

## 6.1 Rendering Enhancements

### 6.1.1 Dynamic Lights
- [x] Implement GPU-based dynamic lighting for entities
- [x] Support point lights with configurable radius and color
- [x] Add muzzle flash lights with timed decay
- [x] Add explosion lights
- [x] Optimize light batching for multiple sources

### 6.1.2 Water and Transparent Surfaces
- [ ] Implement water surface rendering with refraction
- [ ] Add water fog/tint when camera underwater
- [ ] Implement glass/window transparency
- [ ] Add surface ripple effects (optional)

### 6.1.3 Post-Processing Effects
- [x] Implement damage screen flash (red overlay)
- [x] Implement pickup flash (yellow overlay)
- [ ] Implement underwater distortion
- [ ] Add bloom/glow for bright surfaces
- [ ] Add configurable gamma/brightness adjustment

### 6.1.4 Advanced Culling
- [ ] Optimize PVS lookup for large maps
- [ ] Add occlusion culling for complex scenes
- [ ] Add distance-based LOD for models (if supported by assets)
- [ ] Add portal culling for indoor areas

---

## 6.2 Console and Configuration

### 6.2.1 Console System
- [x] Expose `ConsoleSystem` for command execution
- [x] Add method `executeCommand(cmd: string): void`
- [x] Add method `registerCommand(name: string, handler: CommandHandler): void`
- [x] Add event `onConsoleOutput?: (message: string) => void`
- [ ] Support command history and autocomplete data

### 6.2.2 Cvar System
- [x] Expose `CvarSystem` for configuration management
- [x] Add method `setCvar(name: string, value: string): void`
- [x] Add method `getCvar(name: string): Cvar`
- [x] Add method `listCvars(): CvarInfo[]`
- [x] Support cvar flags (archive, cheat, server-only)
- [x] Add event `onCvarChange?: (name: string, value: string) => void`

---

## 6.3 Modding Support

### 6.3.1 Custom Entity Registration
- [ ] Add method `registerEntityClass(classname: string, factory: EntityFactory): void`
- [ ] Allow webapp to add custom entity types
- [ ] Expose entity spawn/think/touch hooks
- [ ] Document entity lifecycle and callbacks

### 6.3.2 Custom Weapon Registration
- [ ] Add method `registerWeapon(weapon: WeaponDefinition): void`
- [ ] Allow custom firing logic, ammo types, animations
- [ ] Expose weapon state machine hooks

### 6.3.3 Script Hooks
- [ ] Add lifecycle hooks: `onMapLoad`, `onMapUnload`, `onPlayerSpawn`, `onPlayerDeath`
- [ ] Add event hooks: `onEntitySpawn`, `onEntityRemove`, `onDamage`, `onPickup`
- [ ] Allow webapp to inject custom logic at key points

---

## 6.4 Performance and Optimization

### 6.4.1 Asset Streaming
- [ ] Implement progressive asset loading with priority queue
- [ ] Add method `preloadAssets(paths: string[]): Promise<void>` for loading screens
- [ ] Add LRU eviction for texture/model/sound caches
- [ ] Add configurable memory limits per asset type

### 6.4.2 Worker Thread Support
- [ ] Move BSP parsing to worker thread for non-blocking load
- [ ] Move demo parsing to worker thread
- [ ] Move audio decoding to worker thread (already async via WASM)
- [ ] Expose worker-based API with progress callbacks

### 6.4.3 Memory Management
- [ ] Add method `getMemoryUsage(): MemoryUsage` reporting heap usage
- [ ] Add method `clearCache(type: AssetType): void` for manual cache clearing
- [ ] Add automatic garbage collection triggers for low-memory scenarios
- [ ] Document memory budget recommendations for different device classes
