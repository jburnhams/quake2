# Section 17.2: Interactive Visualization

**Goal**: Enable clicking on entities to view metadata, inspect map structure, and navigate the entity graph.

---

## 2.1 Entity Selection API

### 2.1.1 Ray Casting for Entity Picking
- [ ] Implement `rayCastEntities(origin: Vec3, direction: Vec3): EntityHit[]` for mouse picking
- [ ] Support AABB intersection tests for all entity types
- [ ] Support BSP brush model intersection (func_door, func_wall, etc.)
- [ ] Support MD2/MD3 bounding box intersection
- [ ] Return sorted list by distance with hit position and normal
- [ ] Add method `screenToWorldRay(screenX: number, screenY: number, camera: Camera): Ray`

### 2.1.2 Entity Metadata API
- [ ] Create `getEntityMetadata(entityId: number): EntityMetadata` method
- [ ] Return all entity fields: classname, origin, angles, model, targetname, target, etc.
- [ ] Add method `getEntityFields(entityId: number): Record<string, any>` for all key-value pairs
- [ ] Add method `getEntityConnections(entityId: number): EntityConnection[]` for target/targetname graph
- [ ] Add method `getEntityBounds(entityId: number): BoundingBox`
- [ ] Add method `getEntityModel(entityId: number): ModelReference | null`

### 2.1.3 Entity Filtering and Search
- [ ] Add method `findEntitiesByClassname(classname: string): number[]`
- [ ] Add method `findEntitiesByTargetname(targetname: string): number[]`
- [ ] Add method `findEntitiesInRadius(origin: Vec3, radius: number): number[]`
- [ ] Add method `findEntitiesInBounds(mins: Vec3, maxs: Vec3): number[]`
- [ ] Add method `searchEntityFields(field: string, value: any): number[]`
- [ ] Add method `getAllEntityClassnames(): string[]` for filter UI

### 2.1.4 Entity Highlighting
- [ ] Add method `setEntityHighlight(entityId: number, color: Color): void` for selection feedback
- [ ] Add method `clearEntityHighlight(entityId: number): void`
- [ ] Render highlighted entities with overlay color or outline shader
- [ ] Support multiple highlight colors for different selection states

---

## 2.2 Map Structure Inspection

### 2.2.1 BSP Tree Traversal
- [ ] Add method `getBspNodeTree(): BspNodeTree` for tree visualization
- [ ] Add method `findLeafContainingPoint(point: Vec3): number` for leaf identification
- [ ] Add method `getLeafBounds(leafIndex: number): BoundingBox`
- [ ] Add method `getLeafCluster(leafIndex: number): number` for PVS debugging
- [ ] Add method `isClusterVisible(from: number, to: number): boolean` for visibility testing

### 2.2.2 Surface Inspection
- [ ] Add method `getSurfaceAtPoint(point: Vec3): SurfaceInfo | null` for face picking
- [ ] Return surface info: texture name, lightmap index, normal, plane, vertices
- [ ] Add method `getSurfacesByTexture(textureName: string): number[]`
- [ ] Add method `highlightSurface(surfaceId: number, color: Color): void`

### 2.2.3 Texture Browser Integration
- [ ] Add method `getAllLoadedTextures(): TextureInfo[]` listing cached textures
- [ ] Return texture info: name, width, height, format, memory size
- [ ] Add method `getTextureData(name: string): ImageData` for webapp display
- [ ] Add method `getTextureDependencies(mapName: string): string[]` for required textures

---

## 2.3 Entity Graph Visualization

### 2.3.1 Target/Targetname Graph
- [ ] Add method `getEntityGraph(): EntityGraph` returning nodes and edges
- [ ] Nodes: entity ID, classname, targetname
- [ ] Edges: entity ID → target references
- [ ] Add method `getEntityTargets(entityId: number): number[]` for forward links
- [ ] Add method `getEntitySources(entityId: number): number[]` for reverse links

### 2.3.2 Trigger Chain Analysis
- [ ] Add method `getActivationChain(entityId: number): number[][]` for all paths from trigger
- [ ] Add method `getTriggerVolumes(): TriggerVolume[]` for all trigger entities
- [ ] Return trigger info: bounds, target, delay, message, sounds
