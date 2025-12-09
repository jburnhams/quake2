import { Vec3 } from '@quake2ts/shared';
import { parseBsp } from './bsp.js';
import { AssetManager } from './manager.js';

export interface BoundingBox {
  readonly mins: Vec3;
  readonly maxs: Vec3;
}

function resizeBilinear(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstWidth * dstHeight * 4);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;
      const xFloor = Math.floor(srcX);
      const yFloor = Math.floor(srcY);
      const xWeight = srcX - xFloor;
      const yWeight = srcY - yFloor;
      const xCeil = Math.min(xFloor + 1, srcWidth - 1);
      const yCeil = Math.min(yFloor + 1, srcHeight - 1);

      const offset00 = (yFloor * srcWidth + xFloor) * 4;
      const offset10 = (yFloor * srcWidth + xCeil) * 4;
      const offset01 = (yCeil * srcWidth + xFloor) * 4;
      const offset11 = (yCeil * srcWidth + xCeil) * 4;

      const dstOffset = (y * dstWidth + x) * 4;

      for (let c = 0; c < 4; c++) {
        const v00 = src[offset00 + c]!;
        const v10 = src[offset10 + c]!;
        const v01 = src[offset01 + c]!;
        const v11 = src[offset11 + c]!;

        const v0 = v00 * (1 - xWeight) + v10 * xWeight;
        const v1 = v01 * (1 - xWeight) + v11 * xWeight;
        const v = v0 * (1 - yWeight) + v1 * yWeight;

        dst[dstOffset + c] = v;
      }
    }
  }
  return dst;
}

export class AssetPreviewGenerator {
  constructor(private readonly assetManager: AssetManager) {}

  async generateTextureThumbnail(path: string, size: number): Promise<ImageData | null> {
    try {
      const texture = await this.assetManager.loadTexture(path);
      if (!texture || texture.levels.length === 0) {
        return null;
      }
      const level0 = texture.levels[0];

      // Calculate aspect ratio
      const aspect = level0.width / level0.height;
      let dstWidth = size;
      let dstHeight = size;

      if (aspect > 1) {
        dstHeight = Math.floor(size / aspect);
      } else {
        dstWidth = Math.floor(size * aspect);
      }

      // Ensure at least 1px
      dstWidth = Math.max(1, dstWidth);
      dstHeight = Math.max(1, dstHeight);

      const resizedData = resizeBilinear(
        level0.rgba,
        level0.width,
        level0.height,
        dstWidth,
        dstHeight
      );

      return new ImageData(resizedData, dstWidth, dstHeight);
    } catch (e) {
      console.error(`Failed to generate thumbnail for ${path}`, e);
      return null;
    }
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
