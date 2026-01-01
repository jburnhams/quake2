import { SURF_NONE, type SurfaceFlag } from '@quake2ts/shared';
import {
  IndexBuffer,
  Texture2D,
  VertexArray,
  VertexBuffer,
  type VertexAttributeLayout,
} from './resources.js';
import { BspMap, createFaceLightmap } from '../assets/bsp.js';

export interface BspLightmapData {
  readonly width: number;
  readonly height: number;
  readonly samples: Uint8Array;
}

export interface BspSurfaceInput {
  readonly vertices: ReadonlyArray<number> | Float32Array;
  readonly textureCoords: ReadonlyArray<number> | Float32Array;
  readonly lightmapCoords?: ReadonlyArray<number> | Float32Array;
  readonly indices?: ReadonlyArray<number> | Uint16Array | Uint32Array;
  readonly texture: string;
  readonly surfaceFlags?: SurfaceFlag;
  readonly lightmap?: BspLightmapData;
  readonly faceIndex: number;
  readonly styles?: readonly number[];
}

export interface LightmapPlacement {
  readonly atlasIndex: number;
  readonly offset: [number, number];
  readonly scale: [number, number];
}

export interface BspSurfaceGeometry {
  readonly vao: VertexArray;
  readonly vertexBuffer: VertexBuffer;
  readonly indexBuffer: IndexBuffer;
  readonly indexCount: number;
  readonly vertexCount: number;
  readonly texture: string;
  readonly surfaceFlags: SurfaceFlag;
  readonly lightmap?: LightmapPlacement;
  readonly styleIndices?: readonly number[];
  readonly styleLayers?: readonly number[];
  // CPU copies retained for deterministic tests and debugging.
  readonly vertexData: Float32Array;
  readonly indexData: Uint16Array;
}

export interface LightmapAtlas {
  readonly texture: Texture2D;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

export interface BspBuildOptions {
  readonly atlasSize?: number;
  readonly lightmapPadding?: number;
  readonly hiddenClassnames?: Set<string>;
}

export interface BspGeometryBuildResult {
  readonly surfaces: readonly BspSurfaceGeometry[];
  readonly lightmaps: readonly LightmapAtlas[];
}

const FLOAT_BYTES = 4;
const STRIDE = 8 * FLOAT_BYTES; // Position(3) + TexCoord(2) + LightmapCoord(2) + LightmapStep(1)

export const BSP_VERTEX_LAYOUT: readonly VertexAttributeLayout[] = [
  // Position
  { index: 0, size: 3, type: 0x1406, stride: STRIDE, offset: 0 },
  // Diffuse UV
  { index: 1, size: 2, type: 0x1406, stride: STRIDE, offset: 3 * FLOAT_BYTES },
  // Lightmap UV
  { index: 2, size: 2, type: 0x1406, stride: STRIDE, offset: 5 * FLOAT_BYTES },
  // Lightmap step (for multi-style lightmap layers)
  { index: 3, size: 1, type: 0x1406, stride: STRIDE, offset: 7 * FLOAT_BYTES },
];

interface LightmapPlacementInfo {
  readonly atlasIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
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
  const channelCount = 4; // We upload as RGBA for compatibility.
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

function detectChannels(lightmap: BspLightmapData): number {
  const pixels = lightmap.width * lightmap.height;
  if (pixels === 0) {
    throw new Error('Invalid lightmap with zero area');
  }
  const channels = lightmap.samples.byteLength / pixels;
  if (!Number.isInteger(channels) || channels < 3 || channels > 4) {
    throw new Error('Unsupported lightmap channel count');
  }
  return channels;
}

function writeLightmapIntoAtlas(
  atlas: AtlasBuilder,
  placement: LightmapPlacementInfo,
  lightmap: BspLightmapData
): void {
  const channels = detectChannels(lightmap);
  const stride = atlas.width * 4;
  const startX = placement.x + atlas.padding;
  const startY = placement.y + atlas.padding;
  let srcIndex = 0;

  for (let y = 0; y < lightmap.height; y++) {
    const destRow = (startY + y) * stride + startX * 4;
    for (let x = 0; x < lightmap.width; x++) {
      const dest = destRow + x * 4;
      atlas.data[dest] = lightmap.samples[srcIndex];
      atlas.data[dest + 1] = lightmap.samples[srcIndex + 1];
      atlas.data[dest + 2] = lightmap.samples[srcIndex + 2];
      atlas.data[dest + 3] = channels === 4 ? lightmap.samples[srcIndex + 3] : 255;
      srcIndex += channels;
    }
  }
}

function placeLightmap(
  builders: AtlasBuilder[],
  lightmap: BspLightmapData,
  options: Required<BspBuildOptions>
): { placement: LightmapPlacementInfo; atlas: AtlasBuilder } {
  const paddedWidth = lightmap.width + options.lightmapPadding * 2;
  const paddedHeight = lightmap.height + options.lightmapPadding * 2;
  if (paddedWidth > options.atlasSize || paddedHeight > options.atlasSize) {
    throw new Error('Lightmap too large for atlas');
  }

  for (const atlas of builders) {
    if (atlas.cursorX + paddedWidth > atlas.width) {
      atlas.cursorX = 0;
      atlas.cursorY += atlas.rowHeight + options.lightmapPadding;
      atlas.rowHeight = 0;
    }

    if (atlas.cursorY + paddedHeight > atlas.height) {
      continue;
    }

    const placement: LightmapPlacementInfo = {
      atlasIndex: builders.indexOf(atlas),
      x: atlas.cursorX,
      y: atlas.cursorY,
      width: lightmap.width,
      height: lightmap.height,
    };

    atlas.cursorX += paddedWidth + options.lightmapPadding;
    atlas.rowHeight = Math.max(atlas.rowHeight, paddedHeight);
    return { placement, atlas };
  }

  const atlas = createAtlasBuilder(options.atlasSize, options.lightmapPadding);
  builders.push(atlas);
  const placement: LightmapPlacementInfo = { atlasIndex: builders.length - 1, x: 0, y: 0, width: lightmap.width, height: lightmap.height };
  atlas.cursorX = paddedWidth + options.lightmapPadding;
  atlas.rowHeight = paddedHeight;
  return { placement, atlas };
}

function ensureFloat32(array: ReadonlyArray<number> | Float32Array): Float32Array {
  return array instanceof Float32Array ? array : new Float32Array(array);
}

function ensureIndexArray(indices: ReadonlyArray<number> | Uint16Array | Uint32Array | undefined, vertexCount: number): Uint16Array {
  if (!indices) {
    const generated = new Uint16Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      generated[i] = i;
    }
    return generated;
  }

  const converted = indices instanceof Uint16Array ? indices : new Uint16Array(indices);
  return converted;
}

function remapLightmapCoords(
  coords: Float32Array,
  placement: LightmapPlacement,
): Float32Array {
  const remapped = new Float32Array(coords.length);
  for (let i = 0; i < coords.length; i += 2) {
    remapped[i] = placement.offset[0] + coords[i] * placement.scale[0];
    remapped[i + 1] = placement.offset[1] + coords[i + 1] * placement.scale[1];
  }
  return remapped;
}

function buildVertexData(
  surface: BspSurfaceInput,
  placement: LightmapPlacement | undefined
): Float32Array {
  const vertices = ensureFloat32(surface.vertices);
  const texCoords = ensureFloat32(surface.textureCoords);
  const lightmapCoords = placement
    ? remapLightmapCoords(ensureFloat32(surface.lightmapCoords ?? surface.textureCoords), placement)
    : ensureFloat32(surface.lightmapCoords ?? new Float32Array(texCoords.length));

  // Calculate lightmap step (height of one style layer in atlas texture coordinates)
  // If surface has multiple styles, they're packed vertically, so step = total_height / num_styles
  let lightmapStep = 0.0;
  if (placement) {
    const styles = surface.styles || [255, 255, 255, 255];
    const numValidStyles = styles.filter(s => s !== 255).length;
    if (numValidStyles > 0) {
      lightmapStep = placement.scale[1] / numValidStyles;
    }
  }

  const vertexCount = vertices.length / 3;
  if (texCoords.length / 2 !== vertexCount) {
    throw new Error('Texture coordinates count mismatch');
  }
  if (lightmapCoords.length / 2 !== vertexCount) {
    throw new Error('Lightmap coordinates count mismatch');
  }

  const interleaved = new Float32Array(vertexCount * 8); // Now 8 floats per vertex
  for (let i = 0; i < vertexCount; i++) {
    const v = i * 3;
    const t = i * 2;
    const o = i * 8; // Changed from 7 to 8
    interleaved[o] = vertices[v];
    interleaved[o + 1] = vertices[v + 1];
    interleaved[o + 2] = vertices[v + 2];
    interleaved[o + 3] = texCoords[t];
    interleaved[o + 4] = texCoords[t + 1];
    interleaved[o + 5] = lightmapCoords[t];
    interleaved[o + 6] = lightmapCoords[t + 1];
    interleaved[o + 7] = lightmapStep; // Add lightmap step
  }

  return interleaved;
}

/**
 * Converts a parsed BSP map into a set of flat surface inputs ready for rendering.
 *
 * This function handles:
 * 1. Traversing faces and their edges to build vertex lists.
 * 2. Calculating texture coordinates (UVs) from surface normals and texture info.
 * 3. Generating triangle indices (fan triangulation) for convex polygon faces.
 * 4. Extracting and calculating lightmap data and coordinates.
 *
 * @param map The parsed BSP map structure.
 * @returns An array of surface inputs suitable for consumption by `buildBspGeometry`.
 */
export function createBspSurfaces(map: BspMap): BspSurfaceInput[] {
  const results: BspSurfaceInput[] = [];

  // Iterate over all faces using index to allow efficient lookups of parallel arrays (e.g. lightMapInfo).
  for (let faceIndex = 0; faceIndex < map.faces.length; faceIndex++) {
    const face = map.faces[faceIndex];

    // Skip faces with invalid texture info (e.g., logic/clip brushes).
    if (face.texInfo < 0) continue;

    const texInfo = map.texInfo[face.texInfo];
    const vertices: number[] = [];
    const textureCoords: number[] = [];
    const lightmapCoords: number[] = [];

    // Retrieve vertices for this face by walking its edges.
    // BSP faces are stored as references to a global edge list.
    for (let i = 0; i < face.numEdges; i++) {
      const edgeIndex = map.surfEdges[face.firstEdge + i];
      const edge = map.edges[Math.abs(edgeIndex)];
      // A positive edge index means traversal from vertex 0 to 1.
      // A negative edge index means traversal from vertex 1 to 0.
      const vIndex = edgeIndex >= 0 ? edge.vertices[0] : edge.vertices[1];
      const vertex = map.vertices[vIndex];

      vertices.push(vertex[0], vertex[1], vertex[2]);

      // Calculate standard texture coordinates (s, t) using the texture axes.
      // s = dot(v, s_vector) + s_offset
      // t = dot(v, t_vector) + t_offset
      const s = vertex[0] * texInfo.s[0] + vertex[1] * texInfo.s[1] + vertex[2] * texInfo.s[2] + texInfo.sOffset;
      const t = vertex[0] * texInfo.t[0] + vertex[1] * texInfo.t[1] + vertex[2] * texInfo.t[2] + texInfo.tOffset;

      textureCoords.push(s, t);

      // Lightmap coordinates are tentatively set to texture coordinates.
      // If valid lightmap data exists, they will be recalculated later.
      lightmapCoords.push(s, t);
    }

    // Triangulate the face. BSP faces are convex polygons, so a simple triangle fan
    // originating from the first vertex (index 0) covers the surface.
    const indices: number[] = [];
    const vertexCount = vertices.length / 3;
    for (let i = 1; i < vertexCount - 1; i++) {
      indices.push(0, i, i + 1);
    }

    // Process lightmap data if available.
    let lightmapData: BspLightmapData | undefined;
    const lightmapInfo = map.lightMapInfo[faceIndex];

    if (lightmapInfo) {
      // Calculate the extents of the texture coordinates to determine lightmap dimensions.
      // Quake 2 lightmaps are 1/16th scale of the texture coordinates.
      let minS = Infinity, maxS = -Infinity, minT = Infinity, maxT = -Infinity;
      for (let k = 0; k < textureCoords.length; k+=2) {
        const s = textureCoords[k];
        const t = textureCoords[k+1];
        if (s < minS) minS = s;
        if (s > maxS) maxS = s;
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }

      // Lightmap dimensions are ceil(max/16) - floor(min/16) + 1
      const floorMinS = Math.floor(minS / 16);
      const floorMinT = Math.floor(minT / 16);
      const lmWidth = Math.ceil(maxS / 16) - floorMinS + 1;
      const lmHeight = Math.ceil(maxT / 16) - floorMinT + 1;

      // Extract the raw lightmap samples from the BSP lump.
      const samples = createFaceLightmap(face, map.lightMaps, lightmapInfo);

      if (samples && samples.length > 0) {
          // Count valid light styles for this face
          const faceStyles = face.styles || [255, 255, 255, 255];
          const numStyles = Math.max(1, faceStyles.filter(s => s !== 255).length);

          // Calculate expected dimensions
          // Multi-style lightmaps have data packed vertically (multiple RGB layers).
          const expectedSize = lmWidth * lmHeight * 3 * numStyles;

          // Try to infer dimensions from sample size if they don't match calculated dimensions
          let actualWidth = lmWidth;
          let actualHeight = lmHeight;

          if (samples.length === expectedSize) {
              // Perfect match - use calculated dimensions with styles
              actualHeight = lmHeight * numStyles;
          } else if (samples.length % 3 === 0) {
              // Try to infer from actual data size
              const pixelCount = samples.length / 3;
              const layerPixelCount = pixelCount / numStyles;
              const layerSide = Math.sqrt(layerPixelCount);

              if (Math.abs(layerSide - Math.floor(layerSide)) < 0.001) {
                  // Square lightmap
                  actualWidth = Math.floor(layerSide);
                  actualHeight = Math.floor(layerSide) * numStyles;
              } else {
                  // Use calculated dimensions anyway
                  actualHeight = lmHeight * numStyles;
              }
          }

          lightmapData = { width: actualWidth, height: actualHeight, samples };

          // Recalculate lightmap UVs based on the 1/16th scale and min offset.
          // We add 0.5 to center the sample.
          for (let k = 0; k < lightmapCoords.length; k+=2) {
              lightmapCoords[k] = (textureCoords[k] / 16) - floorMinS + 0.5;
              lightmapCoords[k+1] = (textureCoords[k+1] / 16) - floorMinT + 0.5;
          }
      }
    }

    results.push({
      vertices: new Float32Array(vertices),
      textureCoords: new Float32Array(textureCoords),
      lightmapCoords: new Float32Array(lightmapCoords),
      indices: new Uint16Array(indices),
      texture: texInfo.texture,
      surfaceFlags: texInfo.flags,
      lightmap: lightmapData,
      faceIndex,
      styles: face.styles || [255, 255, 255, 255],
    });
  }

  return results;
}

export function buildBspGeometry(
  gl: WebGL2RenderingContext,
  surfaces: readonly BspSurfaceInput[],
  map?: BspMap,
  options: BspBuildOptions = {}
): BspGeometryBuildResult {
  // Filter surfaces based on hidden classnames
  let filteredSurfaces = surfaces;
  if (map && options.hiddenClassnames && options.hiddenClassnames.size > 0) {
    const hiddenFaces = new Set<number>();
    for (const entity of map.entities.entities) {
      if (entity.classname && options.hiddenClassnames.has(entity.classname)) {
        const modelProp = entity.properties['model'];
        if (modelProp && modelProp.startsWith('*')) {
          const modelIndex = parseInt(modelProp.substring(1), 10);
          if (!isNaN(modelIndex) && modelIndex >= 0 && modelIndex < map.models.length) {
            const model = map.models[modelIndex];
            for (let i = 0; i < model.numFaces; i++) {
              hiddenFaces.add(model.firstFace + i);
            }
          }
        }
      }
    }
    if (hiddenFaces.size > 0) {
      filteredSurfaces = surfaces.filter((s) => !hiddenFaces.has(s.faceIndex));
    }
  }

  const resolved: Required<BspBuildOptions> = {
    atlasSize: options.atlasSize ?? 1024,
    lightmapPadding: options.lightmapPadding ?? 1,
    hiddenClassnames: options.hiddenClassnames ?? new Set(),
  };

  const atlasBuilders: AtlasBuilder[] = [];
  const placements = new Map<number, LightmapPlacement>();

  filteredSurfaces.forEach((surface, index) => {
    if (!surface.lightmap) {
      return;
    }
    const { placement, atlas } = placeLightmap(atlasBuilders, surface.lightmap, resolved);
    writeLightmapIntoAtlas(atlas, placement, surface.lightmap);
    placements.set(index, {
      atlasIndex: placement.atlasIndex,
      offset: [
        (placement.x + resolved.lightmapPadding) / resolved.atlasSize,
        (placement.y + resolved.lightmapPadding) / resolved.atlasSize,
      ],
      scale: [placement.width / resolved.atlasSize, placement.height / resolved.atlasSize],
    });
  });

  const lightmaps: LightmapAtlas[] = atlasBuilders.map((builder) => {
    const texture = new Texture2D(gl);
    texture.setParameters({
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
    });
    texture.uploadImage(0, gl.RGBA, builder.width, builder.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, builder.data);
    return { texture, width: builder.width, height: builder.height, pixels: builder.data };
  });

  const results: BspSurfaceGeometry[] = filteredSurfaces.map((surface, index) => {
    const placement = placements.get(index);
    const vertexData = buildVertexData(surface, placement);
    const indexData = ensureIndexArray(surface.indices, vertexData.length / 8);

    const vertexBuffer = new VertexBuffer(gl, gl.STATIC_DRAW, gl.ARRAY_BUFFER);
    vertexBuffer.upload(vertexData as unknown as BufferSource);

    const indexBuffer = new IndexBuffer(gl, gl.STATIC_DRAW);
    indexBuffer.upload(indexData as unknown as BufferSource);

    const vao = new VertexArray(gl);
    vao.configureAttributes(BSP_VERTEX_LAYOUT, vertexBuffer);

    // Calculate styleLayers from styles
    const styles = surface.styles || [255, 255, 255, 255];
    const styleLayers = [-1, -1, -1, -1];
    let layerCounter = 0;
    for (let i = 0; i < 4; i++) {
      if (styles[i] !== 255) {
        styleLayers[i] = layerCounter;
        layerCounter++;
      }
    }

    return {
      vao,
      vertexBuffer,
      indexBuffer,
      indexCount: indexData.length,
      vertexCount: vertexData.length / 8,
      texture: surface.texture,
      surfaceFlags: surface.surfaceFlags ?? SURF_NONE,
      lightmap: placement,
      styleIndices: styles,
      styleLayers,
      vertexData,
      indexData,
    };
  });

  return { surfaces: results, lightmaps };
}
