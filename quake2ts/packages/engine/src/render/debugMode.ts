export enum DebugMode {
  None,
  BoundingBoxes,     // Show entity AABBs
  Normals,           // Visualize surface normals
  PVSClusters,       // Color by PVS cluster
  CollisionHulls,    // Show collision geometry
  Lightmaps,         // Lightmap-only rendering
  Wireframe          // Wireframe overlay
}
