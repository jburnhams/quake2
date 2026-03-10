import { Vec3 } from '@quake2ts/shared';
import type { CompileFace, CompilePlane } from '../types/compile.js';
import type { BspTexInfo } from '../types/bsp.js';
import type { Light } from './lights.js';
import type { TreeElement } from '../compiler/tree.js';
import { calculateLightmapSize, packLightmaps, PackedLightmaps } from './lightmap.js';
import { lightFaceStyles } from './direct.js';

/**
 * Quick lighting pass - direct light only
 * Calculates direct lighting without bouncing (no radiosity patches)
 */
export function computeFastLighting(
  faces: CompileFace[],
  texInfos: readonly BspTexInfo[],
  lights: Light[],
  tree: TreeElement,
  planes: CompilePlane[],
  luxelSize: number = 16
): PackedLightmaps {
  // Compute lighting for each face
  const faceLightmaps = faces.map(face => {
    // Determine texInfo
    const texInfo = texInfos[face.texInfo];

    // Some faces (like sky or nodraw) don't need lightmaps.
    // For now, if the flag SURF_SKY is present, we'd skip.
    // If we don't have flags mapped yet, we just generate them.
    // Actually, in BspCompiler flags might not be fully mapped, but we'll leave it as is.
    // We can just try to calculate size and see if valid.

    const lightmapInfo = calculateLightmapSize(face, texInfo, luxelSize);

    if (lightmapInfo.width === 0 || lightmapInfo.height === 0) {
      return {
        lightmapInfo,
        samplesByStyle: new Map()
      };
    }

    // Direct lighting computation, grouped by style
    const samplesByStyle = lightFaceStyles(face, lightmapInfo, texInfo, lights, tree, planes);

    return {
      lightmapInfo,
      samplesByStyle
    };
  });

  // Pack the computed samples into a single buffer
  return packLightmaps(faceLightmaps);
}
