# Section 17.1: Basic Asset Viewing

**Goal**: Enable web app to load PAK files and browse their contents, load BSP maps and display them with basic camera control.

---

## 1.1 PAK File Browser API

### 1.1.1 VirtualFileSystem Enhancements
- [x] Add method `listDirectory(path: string): Promise<FileInfo[]>` to enumerate directory contents
- [x] Add method `getFileMetadata(path: string): FileMetadata` returning size, offset, PAK source
- [x] Add method `getDirectoryTree(): DirectoryNode` for hierarchical browsing
- [x] Add filtering by extension: `listByExtension(extensions: string[]): FileInfo[]`
- [x] Add method `searchFiles(pattern: RegExp): FileInfo[]` for text search
- [x] Add method `getPakInfo(): PakInfo[]` returning metadata for all mounted PAKs (filename, entry count, total size)

### 1.1.2 File Type Detection
- [x] Implement `detectFileType(path: string): FileType` using magic bytes and extensions
- [x] Support detection for: BSP, MD2, MD3, WAL, PCX, TGA, WAV, OGG, TXT, CFG, DEM
- [x] Add method `isTextFile(path: string): boolean` for viewer selection
- [x] Add method `isBinaryFile(path: string): boolean`

### 1.1.3 Asset Preview API
- [x] Create `AssetPreviewGenerator` class for generating thumbnails
- [x] Implement `generateTextureThumbnail(path: string, size: number): Promise<ImageData>` for WAL/PCX/TGA
- [x] Implement `generateModelThumbnail(path: string, size: number): Promise<ImageData>` for MD2/MD3
- [x] Implement `getMapBounds(mapName: string): Promise<BoundingBox>` for map overview
- [x] Add method `extractMapScreenshot(mapName: string): Promise<ImageData | null>` from embedded levelshots

### 1.1.4 Text File Reading
- [x] Add method `readTextFile(path: string): Promise<string>` with UTF-8/ASCII fallback
- [x] Add method `readBinaryFile(path: string): Promise<Uint8Array>` for raw access
- [x] Handle large file streaming for web app progress display

---

## 1.2 Map Viewer API

### 1.2.1 Headless Rendering Mode
- [x] Create `RenderMode` enum: `WebGL` | `Headless`
- [x] Implement headless BSP loading: parse geometry without GPU upload
- [x] Add `getMapGeometry(mapName: string): Promise<MapGeometry>` returning vertices, indices, bounds
- [x] Add `getMapTextures(mapName: string): Promise<TextureReference[]>` listing required textures
- [x] Add `getMapLightmaps(mapName: string): Promise<LightmapData[]>` for custom rendering

### 1.2.2 Camera Control API
- [x] Expose `Camera` class from engine with configurable properties
- [x] Add method `setPosition(x: number, y: number, z: number): void`
- [x] Add method `setRotation(pitch: number, yaw: number, roll: number): void`
- [x] Add method `setFov(fov: number): void`
- [x] Add method `setAspectRatio(aspect: number): void`
- [x] Add method `lookAt(target: Vec3): void`
- [x] Add event callback `onCameraMove?: (camera: CameraState) => void`

### 1.2.3 Free Camera Movement
- [x] Implement `FreeCameraController` class independent of player input
- [x] Add WASD + QE (up/down) movement in world space
- [x] Add mouse drag for pitch/yaw rotation
- [x] Add configurable movement speed and acceleration
- [x] Add method `update(deltaTime: number, input: CameraInput): void`
- [x] Add collision toggle: fly-through vs collision-aware movement

**Implementation Notes:**
- Enhanced `Camera` class in `packages/engine/src/render/camera.ts` with requested API methods.
- Created `FreeCameraController` in `packages/engine/src/render/cameraController.ts` handling WASD/QE and mouse look.
- Implemented collision toggle in `FreeCameraController` with `setCollision(boolean)` and `checkPosition` callback.

### 1.2.4 Map Statistics API
- [x] Add method `getMapStatistics(mapName: string): Promise<MapStatistics>`
- [x] Return statistics: entity count, surface count, lightmap count, vertex count, bounds
- [x] Add method `getUsedTextures(mapName: string): Promise<string[]>` for missing texture detection
- [x] Add method `getUsedModels(mapName: string): Promise<string[]>` for missing model detection
- [x] Add method `getUsedSounds(mapName: string): Promise<string[]>` for missing sound detection

---

## 1.3 Basic Rendering Improvements

### 1.3.1 Render Options API
- [ ] Create `RenderOptions` interface for webapp control
- [ ] Add option `wireframe: boolean` for wireframe overlay
- [ ] Add option `showLightmaps: boolean` to toggle lightmap vs fullbright
- [ ] Add option `showSkybox: boolean` to toggle skybox rendering
- [ ] Add option `showBounds: boolean` to display entity bounding boxes
- [ ] Add option `showNormals: boolean` to display surface normals (debug)
- [ ] Add option `cullingEnabled: boolean` to toggle PVS/frustum culling

### 1.3.2 Debug Visualization
- [ ] Implement `DebugRenderer` class for overlay rendering
- [ ] Add method `drawBoundingBox(mins: Vec3, maxs: Vec3, color: Color): void`
- [ ] Add method `drawLine(start: Vec3, end: Vec3, color: Color): void`
- [ ] Add method `drawPoint(position: Vec3, size: number, color: Color): void`
- [ ] Add method `drawText3D(text: string, position: Vec3): void` for in-world labels
- [ ] Add support for drawing entity origins and axes

### 1.3.3 Rendering Performance Metrics
- [ ] Expose `RenderStatistics` from GPUProfiler
- [ ] Add counters: draw calls, triangles rendered, vertices processed, texture binds
- [ ] Add timings: frame time, render time, culling time
- [ ] Add memory stats: texture memory used, buffer memory used
- [ ] Add method `getPerformanceReport(): PerformanceReport`
