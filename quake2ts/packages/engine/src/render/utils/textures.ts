/**
 * Shared texture resolution utilities for both WebGL and WebGPU renderers
 */

import type { BspSurfaceGeometry } from '../bsp.js';
import type { MaterialManager } from '../materials.js';

/**
 * Generic texture resolution result
 * The actual texture type depends on the renderer (Texture2D for WebGL, GPUTexture for WebGPU)
 */
export interface TextureResolutionResult<T = any> {
  diffuse?: T;
  lightmap?: T;
  refraction?: T;
}

/**
 * Resolve textures for a BSP surface from materials and texture maps
 *
 * This utility tries the material system first (which handles animations and special effects),
 * then falls back to static texture lookup.
 *
 * @param geometry Surface geometry containing texture name and lightmap info
 * @param materials Material manager (optional)
 * @param textures Static texture map (optional)
 * @param lightmaps Lightmap array (optional)
 * @param refractionTexture Refraction texture for water surfaces (optional)
 * @returns Resolved textures (diffuse, lightmap, refraction)
 */
export function resolveSurfaceTextures<T>(
  geometry: BspSurfaceGeometry,
  materials: MaterialManager | undefined,
  textures: ReadonlyMap<string, T> | undefined,
  lightmaps: ReadonlyArray<{ texture: T }> | undefined,
  refractionTexture?: T
): TextureResolutionResult<T> {
  // Try material system first
  const material = materials?.getMaterial(geometry.texture);
  let diffuse: T | undefined;

  if (material) {
    // Material texture exists - use it (handles animations)
    diffuse = material.texture as unknown as T;
  }

  // Fallback to static lookup
  if (!diffuse) {
    diffuse = textures?.get(geometry.texture);
  }

  // Resolve lightmap
  const lightmapIndex = geometry.lightmap?.atlasIndex;
  const lightmap = lightmapIndex !== undefined
    ? lightmaps?.[lightmapIndex]?.texture
    : undefined;

  return { diffuse, lightmap, refraction: refractionTexture };
}
