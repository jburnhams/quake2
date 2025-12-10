export interface RenderOptions {
  wireframe?: boolean;
  showLightmaps?: boolean; // If false, lightmaps are disabled (fullbright or diffuse only)
  showSkybox?: boolean;
  showBounds?: boolean;
  showNormals?: boolean;
  cullingEnabled?: boolean;
}
