import { Vec3 } from '@quake2ts/shared';
import type { CompileFace, CompilePlane } from '../types/compile.js';
import type { BspTexInfo } from '../types/bsp.js';
import type { Light } from './lights.js';
import type { TreeElement } from '../compiler/tree.js';
import { calculateLightmapSize, packLightmaps, PackedLightmaps, FaceLightingData } from './lightmap.js';
import { lightFaceStyles } from './direct.js';
import { createPatches, computeRadiosity, Patch, RadiosityOptions } from './radiosity.js';

export interface FullLightingOptions extends RadiosityOptions {
  luxelSize?: number;
  patchSize?: number;
}

/**
 * Full lighting pass - direct light and bounce lighting via radiosity patches
 */
export function computeFullLighting(
  faces: CompileFace[],
  texInfos: readonly BspTexInfo[],
  lights: Light[],
  tree: TreeElement,
  planes: CompilePlane[],
  options?: FullLightingOptions
): PackedLightmaps {
  const luxelSize = options?.luxelSize ?? 16;
  const patchSize = options?.patchSize ?? 64;

  const faceData: { face: CompileFace; texInfo: BspTexInfo; lighting: FaceLightingData; patches: Patch[] }[] = [];

  // 1. Setup Direct Lighting and base structures
  const faceLightmaps = faces.map(face => {
    const texInfo = texInfos[face.texInfo];

    const lightmapInfo = calculateLightmapSize(face, texInfo, luxelSize);

    const lightingData: FaceLightingData = {
        lightmapInfo,
        samplesByStyle: new Map()
    };

    if (lightmapInfo.width > 0 && lightmapInfo.height > 0) {
        lightingData.samplesByStyle = lightFaceStyles(face, lightmapInfo, texInfo, lights, tree, planes);
    }

    // Create initial patches for bounce lighting. We'll link these to faces later.
    // Skip faces that wouldn't contribute or receive meaningful bounce.
    let patches: Patch[] = [];
    if (options?.bounces && options.bounces > 0) {
        patches = createPatches([face], planes, patchSize);
        // Note: Emissive assignment needs to happen here. In Q2, surfaces with the light flag or specific textures are emissive.
        // For MVP, we will only use explicitly defined `Light` entities for direct light (handled in lightFaceStyles)
        // If a surface is explicitly emissive, we'd add its emission to the patches here.
    }

    faceData.push({ face, texInfo, lighting: lightingData, patches });

    return lightingData;
  });

  // 2. Perform Radiosity Bounces if requested
  if (options?.bounces && options.bounces > 0) {
      // Gather all patches into a flat array
      const allPatches: Patch[] = [];
      for (const fd of faceData) {
          allPatches.push(...fd.patches);
      }

      // Initial direct lighting -> patch emissive mapping.
      // We need to map the direct light calculated on the face samples to the patches
      // so the patches have light to bounce.
      for (const fd of faceData) {
          if (!fd.lighting.samplesByStyle.has(0) || fd.patches.length === 0) continue;

          const defaultSamples = fd.lighting.samplesByStyle.get(0)!;
          // Simple average of direct light to patch emissive.
          // Real Q2 does this via sample-to-patch mapping.

          // For now, average all default style samples to set the base emissive for the face's patches.
          let avgX = 0, avgY = 0, avgZ = 0;
          for (const s of defaultSamples) {
              avgX += s.color.x;
              avgY += s.color.y;
              avgZ += s.color.z;
          }
          if (defaultSamples.length > 0) {
              avgX /= defaultSamples.length;
              avgY /= defaultSamples.length;
              avgZ /= defaultSamples.length;
          }

          for (const patch of fd.patches) {
              patch.emissive = { x: avgX, y: avgY, z: avgZ };
          }
      }

      // Compute multi-bounce
      computeRadiosity(allPatches, tree, planes, options);

      // Map back patch total light to lightmap samples
      // Real Q2 maps back by casting rays from sample points to patches.
      // We will do a simple approximation: add the average patch bounce light to the default style samples.
      for (const fd of faceData) {
          if (fd.patches.length === 0 || !fd.lighting.samplesByStyle.has(0)) continue;

          const defaultSamples = fd.lighting.samplesByStyle.get(0)!;

          let totalPatchLightX = 0, totalPatchLightY = 0, totalPatchLightZ = 0;
          let validPatches = 0;
          for (const p of fd.patches) {
             // Total light includes emissive (direct) + bounce. We want just the bounce part to add to samples.
             // p.totalLight - p.emissive gives bounce light
             totalPatchLightX += Math.max(0, p.totalLight.x - p.emissive.x);
             totalPatchLightY += Math.max(0, p.totalLight.y - p.emissive.y);
             totalPatchLightZ += Math.max(0, p.totalLight.z - p.emissive.z);
             validPatches++;
          }

          if (validPatches > 0) {
             const bounceX = totalPatchLightX / validPatches;
             const bounceY = totalPatchLightY / validPatches;
             const bounceZ = totalPatchLightZ / validPatches;

             for (let i = 0; i < defaultSamples.length; i++) {
                 defaultSamples[i].color = { x: defaultSamples[i].color.x + bounceX, y: defaultSamples[i].color.y + bounceY, z: defaultSamples[i].color.z + bounceZ };


             }
          }
      }
  }

  // 3. Pack Lightmaps (Includes Tone Mapping HDR -> LDR inside)
  return packLightmaps(faceLightmaps);
}
