import { BspMap, createFaceLightmap } from '../assets/bsp.js';

export interface LightmapExport {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/**
 * Extracts all valid lightmaps from a BSP map and packs them into a series of atlases.
 * This function does not require a WebGL context.
 *
 * @param map The parsed BSP map.
 * @param atlasSize The width/height of the generated atlases (default 1024).
 * @param padding Padding between packed lightmaps (default 1).
 * @returns An array of atlases, each containing width, height, and raw RGBA pixel data.
 */
export function exportLightmaps(map: BspMap, atlasSize = 1024, padding = 1): LightmapExport[] {
  const surfaces = extractLightmapData(map);
  const atlases: LightmapExport[] = [];
  const builders: AtlasBuilder[] = [];

  for (const surface of surfaces) {
    const { atlas, x, y } = placeLightmap(builders, surface, atlasSize, padding);
    writeLightmapIntoAtlas(atlas, surface, x, y, padding);
  }

  for (const builder of builders) {
    atlases.push({
      width: builder.width,
      height: builder.height,
      data: builder.data
    });
  }

  return atlases;
}

interface BspLightmapData {
  readonly width: number;
  readonly height: number;
  readonly samples: Uint8Array;
  readonly index: number;
}

interface AtlasBuilder {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly data: Uint8Array;
  cursorX: number;
  cursorY: number;
  rowHeight: number;
}

function createAtlasBuilder(size: number, padding: number): AtlasBuilder {
  const channelCount = 4;
  return {
    width: size,
    height: size,
    padding,
    data: new Uint8Array(size * size * channelCount),
    cursorX: 0,
    cursorY: 0,
    rowHeight: 0,
  };
}

function extractLightmapData(map: BspMap): BspLightmapData[] {
  const results: BspLightmapData[] = [];

  for (let faceIndex = 0; faceIndex < map.faces.length; faceIndex++) {
    const face = map.faces[faceIndex];
    if (face.texInfo < 0) continue;

    const texInfo = map.texInfo[face.texInfo];
    const textureCoords: number[] = [];

    // Reconstruct texture coordinates to calculate dimensions
    for (let i = 0; i < face.numEdges; i++) {
      const edgeIndex = map.surfEdges[face.firstEdge + i];
      const edge = map.edges[Math.abs(edgeIndex)];
      const vIndex = edgeIndex >= 0 ? edge.vertices[0] : edge.vertices[1];
      const vertex = map.vertices[vIndex];

      const s = vertex[0] * texInfo.s[0] + vertex[1] * texInfo.s[1] + vertex[2] * texInfo.s[2] + texInfo.sOffset;
      const t = vertex[0] * texInfo.t[0] + vertex[1] * texInfo.t[1] + vertex[2] * texInfo.t[2] + texInfo.tOffset;
      textureCoords.push(s, t);
    }

    const lightmapInfo = map.lightMapInfo[faceIndex];
    if (lightmapInfo) {
      let minS = Infinity, maxS = -Infinity, minT = Infinity, maxT = -Infinity;
      for (let k = 0; k < textureCoords.length; k+=2) {
        const s = textureCoords[k];
        const t = textureCoords[k+1];
        if (s < minS) minS = s;
        if (s > maxS) maxS = s;
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }

      const floorMinS = Math.floor(minS / 16);
      const floorMinT = Math.floor(minT / 16);
      const lmWidth = Math.ceil(maxS / 16) - floorMinS + 1;
      const lmHeight = Math.ceil(maxT / 16) - floorMinT + 1;

      const samples = createFaceLightmap(face, map.lightMaps, lightmapInfo);

      if (samples) {
        const expectedSize = lmWidth * lmHeight * 3;
        if (samples.length >= expectedSize) {
            const exactSamples = samples.length === expectedSize ? samples : samples.slice(0, expectedSize);
            results.push({ width: lmWidth, height: lmHeight, samples: exactSamples, index: results.length });
        }
      }
    }
  }

  // Sort largest to smallest for better packing, stable sort by index
  return results.sort((a, b) => {
    const areaDiff = (b.width * b.height) - (a.width * a.height);
    if (areaDiff !== 0) return areaDiff;
    return a.index - b.index;
  });
}

function placeLightmap(
  builders: AtlasBuilder[],
  lightmap: BspLightmapData,
  atlasSize: number,
  padding: number
): { atlas: AtlasBuilder; x: number; y: number } {
  const paddedWidth = lightmap.width + padding * 2;
  const paddedHeight = lightmap.height + padding * 2;

  if (paddedWidth > atlasSize || paddedHeight > atlasSize) {
     throw new Error(`Lightmap too large: ${lightmap.width}x${lightmap.height}`);
  }

  for (const atlas of builders) {
    if (atlas.cursorX + paddedWidth > atlas.width) {
      atlas.cursorX = 0;
      atlas.cursorY += atlas.rowHeight;
      atlas.rowHeight = 0;
    }

    if (atlas.cursorY + paddedHeight <= atlas.height) {
       const x = atlas.cursorX;
       const y = atlas.cursorY;
       atlas.cursorX += paddedWidth;
       atlas.rowHeight = Math.max(atlas.rowHeight, paddedHeight);
       return { atlas, x, y };
    }
  }

  const atlas = createAtlasBuilder(atlasSize, padding);
  builders.push(atlas);
  const x = 0;
  const y = 0;
  atlas.cursorX = paddedWidth;
  atlas.rowHeight = paddedHeight;
  return { atlas, x, y };
}

function writeLightmapIntoAtlas(
  atlas: AtlasBuilder,
  lightmap: BspLightmapData,
  placeX: number,
  placeY: number,
  padding: number
): void {
  const stride = atlas.width * 4;
  const startX = placeX + padding;
  const startY = placeY + padding;
  let srcIndex = 0;

  for (let y = 0; y < lightmap.height; y++) {
    const destRow = (startY + y) * stride + startX * 4;
    for (let x = 0; x < lightmap.width; x++) {
      const dest = destRow + x * 4;
      atlas.data[dest] = lightmap.samples[srcIndex];
      atlas.data[dest + 1] = lightmap.samples[srcIndex + 1];
      atlas.data[dest + 2] = lightmap.samples[srcIndex + 2];
      atlas.data[dest + 3] = 255;
      srcIndex += 3;
    }
  }
}
