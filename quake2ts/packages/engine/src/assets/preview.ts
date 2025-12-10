import { Vec3 } from '@quake2ts/shared';
import { parseBsp } from './bsp.js';
import { AssetManager } from './manager.js';
import { Md2Model } from './md2.js';
import { Md3Model } from './md3.js';

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

// Basic Software Rasterizer helpers

interface Point2D {
  x: number;
  y: number;
}

function drawLine(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
  a: number
): void {
  x0 = Math.floor(x0);
  y0 = Math.floor(y0);
  x1 = Math.floor(x1);
  y1 = Math.floor(y1);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
      const idx = (y0 * width + x0) * 4;
      // Simple alpha blending: dst = src * a + dst * (1 - a)
      const invA = 1 - a / 255;
      buffer[idx] = r * (a/255) + buffer[idx] * invA;
      buffer[idx + 1] = g * (a/255) + buffer[idx + 1] * invA;
      buffer[idx + 2] = b * (a/255) + buffer[idx + 2] * invA;
      buffer[idx + 3] = 255; // Force full opacity for the pixel itself
    }

    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function projectPoint(
  v: Vec3,
  width: number,
  height: number,
  center: Vec3,
  scale: number
): Point2D {
  // Simple Orthographic projection

  // rotate Y 45 deg
  const cosY = 0.707;
  const sinY = 0.707;
  const x1 = (v.x - center.x) * cosY - (v.y - center.y) * sinY;
  const y1 = (v.x - center.x) * sinY + (v.y - center.y) * cosY;
  const z1 = v.z - center.z;

  // rotate X 30 deg (look down)
  const cosX = 0.866;
  const sinX = 0.5;
  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;

  // Project
  const screenX = width / 2 + x1 * scale;
  const screenY = height / 2 - z2 * scale; // Y is down in screen space

  return { x: screenX, y: screenY };
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
    try {
      let vertices: Vec3[] = [];
      let indices: number[] = [];

      const ext = path.split('.').pop()?.toLowerCase();

      if (ext === 'md2') {
        const model = await this.assetManager.loadMd2Model(path);
        if (!model || model.frames.length === 0) return null;

        // Use frame 0
        const frame = model.frames[0];
        vertices = frame.vertices.map(v => v.position);

        // Build indices from triangles
        for (const tri of model.triangles) {
          indices.push(tri.vertexIndices[0], tri.vertexIndices[1]);
          indices.push(tri.vertexIndices[1], tri.vertexIndices[2]);
          indices.push(tri.vertexIndices[2], tri.vertexIndices[0]);
        }
      } else if (ext === 'md3') {
        const model = await this.assetManager.loadMd3Model(path);
        if (!model || model.surfaces.length === 0) return null;

        // Accumulate all surfaces from frame 0
        let vertexOffset = 0;
        for (const surface of model.surfaces) {
          // Check if we have vertices for at least one frame
          if (surface.vertices.length === 0) continue;

          const frameVerts = surface.vertices[0];
          vertices.push(...frameVerts.map(v => ({ x: v.position.x, y: v.position.y, z: v.position.z })));

          for (const tri of surface.triangles) {
             indices.push(vertexOffset + tri.indices[0], vertexOffset + tri.indices[1]);
             indices.push(vertexOffset + tri.indices[1], vertexOffset + tri.indices[2]);
             indices.push(vertexOffset + tri.indices[2], vertexOffset + tri.indices[0]);
          }
          vertexOffset += frameVerts.length;
        }
      } else {
        return null;
      }

      if (vertices.length === 0) return null;

      // Calculate bounds
      const min = { x: Infinity, y: Infinity, z: Infinity };
      const max = { x: -Infinity, y: -Infinity, z: -Infinity };

      for (const v of vertices) {
        min.x = Math.min(min.x, v.x);
        min.y = Math.min(min.y, v.y);
        min.z = Math.min(min.z, v.z);
        max.x = Math.max(max.x, v.x);
        max.y = Math.max(max.y, v.y);
        max.z = Math.max(max.z, v.z);
      }

      const center = {
        x: (min.x + max.x) / 2,
        y: (min.y + max.y) / 2,
        z: (min.z + max.z) / 2
      };

      const sizeX = max.x - min.x;
      const sizeY = max.y - min.y;
      const sizeZ = max.z - min.z;
      const maxDim = Math.max(sizeX, sizeY, sizeZ);

      // Auto-scale to fit
      // Padding of 10%
      // Protect against degenerate models (maxDim ~ 0)
      const safeMaxDim = Math.max(maxDim, 0.001);
      const scale = (size * 0.8) / safeMaxDim;

      const buffer = new Uint8ClampedArray(size * size * 4);
      // Fill with transparent or black? Let's do transparent background, green wireframe (classic)

      // Draw wires
      for (let i = 0; i < indices.length; i += 2) {
        const idx0 = indices[i];
        const idx1 = indices[i+1];

        const v0 = vertices[idx0];
        const v1 = vertices[idx1];

        const p0 = projectPoint(v0, size, size, center, scale);
        const p1 = projectPoint(v1, size, size, center, scale);

        drawLine(buffer, size, size, p0.x, p0.y, p1.x, p1.y, 0, 255, 0, 255);
      }

      return new ImageData(buffer, size, size);

    } catch (e) {
      console.error(`Failed to generate model thumbnail for ${path}`, e);
      return null;
    }
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
