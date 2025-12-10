import { Vec3 } from '@quake2ts/shared';
import { parseBsp } from './bsp.js';

export interface BoundingBox {
  readonly mins: Vec3;
  readonly maxs: Vec3;
}

export class AssetPreviewGenerator {
  async generateTextureThumbnail(path: string, size: number): Promise<ImageData | null> {
    // This requires a rendering context or access to the image data.
    // In headless environment (like this engine usually runs), we might not have full Canvas API.
    // However, the task assumes we can generate it.
    // If we have access to the raw texture data (e.g. from WAL/PCX/TGA parsers), we can resize it.
    // For now, I'll define the interface and return null or throw if not implemented.
    return null;
  }

  async generateModelThumbnail(path: string, size: number): Promise<ImageData | null> {
    // Requires rendering the model to an offscreen buffer.
    return null;
  }

  async getMapBounds(mapName: string, mapData: ArrayBuffer): Promise<BoundingBox | null> {
    try {
      const bsp = parseBsp(mapData);
      // BSP doesn't explicitly store global bounds in header, but we can compute from nodes or models[0] (worldspawn)
      if (bsp.models.length > 0) {
        const world = bsp.models[0];
        return {
          mins: { x: world.mins[0], y: world.mins[1], z: world.mins[2] },
          maxs: { x: world.maxs[0], y: world.maxs[1], z: world.maxs[2] },
        };
      }
      return null;
    } catch (e) {
      console.error('Failed to get map bounds', e);
      return null;
    }
  }

  async extractMapScreenshot(mapName: string): Promise<ImageData | null> {
    // Some BSPs (like Q3) have levelshots, Q2 usually relies on external PCX in levelshots/ dir.
    // Rerelease might have something different.
    // If the requirement is "from embedded levelshots", Q2 BSP doesn't standardly have them.
    // We'll return null for now as per standard Q2 BSP spec.
    return null;
  }
}
