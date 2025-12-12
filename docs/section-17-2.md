# Section 17.2: Interactive Visualization

**Goal**: Enable clicking on entities to view metadata, inspect map structure, and navigate the entity graph.

---

## 2.1 Entity Selection API

### 2.1.1 Ray Casting for Entity Picking
- [x] Implement `rayCastEntities(origin: Vec3, direction: Vec3): EntityHit[]` for mouse picking
- [x] Support AABB intersection tests for all entity types
- [x] Support BSP brush model intersection (func_door, func_wall, etc.)
  * *Implemented via `traceModel` support in EntitySystem.*
- [x] Support MD2/MD3 bounding box intersection
  * *Implemented OBB intersection in `selection.ts` to account for entity rotation.*
- [x] Return sorted list by distance with hit position and normal
- [x] Add method `screenToWorldRay(screenX: number, screenY: number, camera: Camera): Ray`

### 2.1.2 Entity Metadata API
- [x] Create `getEntityMetadata(entityId: number): EntityMetadata` method
- [x] Return all entity fields: classname, origin, angles, model, targetname, target, etc.
- [x] Add method `getEntityFields(entityId: number): Record<string, any>` for all key-value pairs
- [x] Add method `getEntityConnections(entityId: number): EntityConnection[]` for target/targetname graph
- [x] Add method `getEntityBounds(entityId: number): BoundingBox`
- [x] Add method `getEntityModel(entityId: number): ModelReference | null`

### 2.1.3 Entity Filtering and Search
- [x] Add method `findEntitiesByClassname(classname: string): number[]`
- [x] Add method `findEntitiesByTargetname(targetname: string): number[]`
- [x] Add method `findEntitiesInRadius(origin: Vec3, radius: number): number[]`
- [x] Add method `findEntitiesInBounds(mins: Vec3, maxs: Vec3): number[]`
- [x] Add method `searchEntityFields(field: string, value: any): number[]`
- [x] Add method `getAllEntityClassnames(): string[]` for filter UI

### 2.1.4 Entity Highlighting
- [x] Add method `setEntityHighlight(entityId: number, color: Color): void` for selection feedback
- [x] Add method `clearEntityHighlight(entityId: number): void`
- [x] Render highlighted entities with overlay color or outline shader
- [x] Support multiple highlight colors for different selection states

---

## 2.2 Map Structure Inspection

### 2.2.1 BSP Tree Traversal
- [x] Add method `getBspNodeTree(): BspNodeTree` for tree visualization
- [x] Add method `findLeafContainingPoint(point: Vec3): number` for leaf identification
- [x] Add method `getLeafBounds(leafIndex: number): BoundingBox`
- [x] Add method `getLeafCluster(leafIndex: number): number` for PVS debugging
- [x] Add method `isClusterVisible(from: number, to: number): boolean` for visibility testing
  * *Implemented in `BspInspector` using decompressed PVS data.*

### 2.2.2 Surface Inspection
- [x] Add method `getSurfaceAtPoint(point: Vec3): SurfaceInfo | null` for face picking
  * *Implemented in `BspInspector` by searching faces in the containing leaf.*
- [ ] Return surface info: texture name, lightmap index, normal, plane, vertices
  * *Partial support: Texture, LightmapId, Normal implemented.*
- [x] Add method `getSurfacesByTexture(textureName: string): number[]`
- [ ] Add method `highlightSurface(surfaceId: number, color: Color): void`

### 2.2.3 Texture Browser Integration
- [x] Add method `getAllLoadedTextures(): TextureInfo[]` listing cached textures
  * *Note: `BspInspector` lists textures referenced by the BSP faces. Integration with Engine TextureManager for dimensions/memory usage is deferred.*
- [ ] Return texture info: name, width, height, format, memory size
- [ ] Add method `getTextureData(name: string): ImageData` for webapp display
- [ ] Add method `getTextureDependencies(mapName: string): string[]` for required textures

---

## 2.3 Entity Graph Visualization

### 2.3.1 Target/Targetname Graph
- [x] Add method `getEntityGraph(): EntityGraph` returning nodes and edges
- [x] Nodes: entity ID, classname, targetname
- [x] Edges: entity ID → target references
- [x] Add method `getEntityTargets(entityId: number): number[]` for forward links
- [x] Add method `getEntitySources(entityId: number): number[]` for reverse links

### 2.3.2 Trigger Chain Analysis
- [x] Add method `getActivationChain(entityId: number): number[][]` for all paths from trigger
  * *Implemented in `editor/analysis.ts`.*
- [x] Add method `getTriggerVolumes(): TriggerVolume[]` for all trigger entities
  * *Implemented in `editor/analysis.ts`.*
- [x] Return trigger info: bounds, target, delay, message, sounds
