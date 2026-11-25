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
  // Optional bounds for WebGPU workaround
  readonly mins?: { readonly x: number; readonly y: number; readonly z: number };
  readonly maxs?: { readonly x: number; readonly y: number; readonly z: number };
}

export interface LightmapPlacement {
  readonly atlasIndex: number;
  readonly offset: [number, number];
  readonly scale: [number, number];
}

export interface BspSurfaceGeometry {
  readonly vao: VertexArray;
  /**
   * The world's one vertex array (every face's vertices, see PackedBspGeometry.vertices), shared
   * by all faces of an uploaded world; the frame draws whole batches from it.
   */
  readonly worldVao?: VertexArray;
  readonly firstVertex?: number;
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
  // Surface bounds for WebGPU worldPos correction
  readonly mins?: { readonly x: number; readonly y: number; readonly z: number };
  readonly maxs?: { readonly x: number; readonly y: number; readonly z: number };
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
  /**
   * Texture sizes by name. BSP texture coordinates are in texels; with a size here they are
   * divided by it (as the original renderer does), so a texture repeats once per its own size.
   */
  readonly textureSizes?: ReadonlyMap<string, { readonly width: number; readonly height: number }>;
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
  placement: LightmapPlacement | undefined,
  textureSize?: { readonly width: number; readonly height: number }
): Float32Array {
  const invWidth = textureSize ? 1 / textureSize.width : 1;
  const invHeight = textureSize ? 1 / textureSize.height : 1;
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
    interleaved[o + 3] = texCoords[t] * invWidth;
    interleaved[o + 4] = texCoords[t + 1] * invHeight;
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

      // As CalcSurfaceExtents in the original: the lightmap covers floor(min/16)..ceil(max/16)
      // in 16-unit luxels, so it is ceil(max/16) - floor(min/16) + 1 samples on each axis.
      const floorMinS = Math.floor(minS / 16);
      const floorMinT = Math.floor(minT / 16);
      const lmWidth = Math.ceil(maxS / 16) - floorMinS + 1;
      const lmHeight = Math.ceil(maxT / 16) - floorMinT + 1;

      // Each light style has its own lmWidth x lmHeight RGB layer, stored one after another.
      // The lump's per-face length runs to the next face's data, so take exactly what the
      // styles need rather than inferring sizes from it.
      const faceStyles = face.styles || [255, 255, 255, 255];
      const numStyles = Math.max(1, faceStyles.filter((style) => style !== 255).length);
      const needed = lmWidth * lmHeight * 3 * numStyles;
      const available = createFaceLightmap(face, map.lightMaps, lightmapInfo);

      if (available && available.length >= needed) {
          // Layers are stacked vertically in the atlas, so the atlas block is lmHeight * numStyles tall.
          lightmapData = { width: lmWidth, height: lmHeight * numStyles, samples: available.subarray(0, needed) };

          // Lightmap UVs in [0, 1] over the first layer, sampling luxel centres, as
          // GL_BuildPolygonFromSurface: ((s - texturemins) / 16 + 0.5) / smax. `v` is divided by
          // the style count because the placement scales to the whole stacked block; the vertex's
          // lightmap step (one layer's height) selects the other layers in the shader.
          for (let k = 0; k < lightmapCoords.length; k += 2) {
              lightmapCoords[k] = (textureCoords[k] / 16 - floorMinS + 0.5) / lmWidth;
              lightmapCoords[k + 1] = (textureCoords[k + 1] / 16 - floorMinT + 0.5) / lmHeight / numStyles;
          }
      }
    }

    // Determine bounds for workaround
    const mins = { x: Infinity, y: Infinity, z: Infinity };
    const maxs = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (let k = 0; k < vertices.length; k+=3) {
        if (vertices[k] < mins.x) mins.x = vertices[k];
        if (vertices[k+1] < mins.y) mins.y = vertices[k+1];
        if (vertices[k+2] < mins.z) mins.z = vertices[k+2];

        if (vertices[k] > maxs.x) maxs.x = vertices[k];
        if (vertices[k+1] > maxs.y) maxs.y = vertices[k+1];
        if (vertices[k+2] > maxs.z) maxs.z = vertices[k+2];
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
      mins,
      maxs
    });

  }

  return results;
}

/**
 * One BSP face's geometry on the CPU, ready for any backend to upload.
 * `vertexData` is interleaved (position 3, texture UV 2, lightmap UV 2, lightmap step 1).
 */
export interface PackedBspSurface {
  readonly faceIndex: number;
  readonly texture: string;
  readonly surfaceFlags: SurfaceFlag;
  readonly lightmap?: LightmapPlacement;
  readonly styleIndices: readonly number[];
  readonly styleLayers: readonly number[];
  readonly vertexData: Float32Array;
  readonly indexData: Uint16Array;
  readonly vertexCount: number;
  readonly indexCount: number;
  /** Where this face's vertices start in the geometry's one `vertices` array. */
  readonly firstVertex?: number;
  readonly mins?: { readonly x: number; readonly y: number; readonly z: number };
  readonly maxs?: { readonly x: number; readonly y: number; readonly z: number };
}

/** A lightmap atlas page as RGBA pixels. */
export interface PackedLightmapAtlas {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

/**
 * A map's world geometry with no GPU objects. `surfaces` is indexed by BSP face number
 * (sparse: faces with no geometry or hidden by `hiddenClassnames` are holes), because the
 * frame renderers look surfaces up by the face numbers the BSP traversal returns.
 */
export interface PackedBspGeometry {
  readonly surfaces: readonly (PackedBspSurface | undefined)[];
  readonly lightmaps: readonly PackedLightmapAtlas[];
  /**
   * Every face's vertices in one array (8 floats each, in the order the faces were packed), so a backend
   * keeps the world in one vertex buffer and draws batches of faces with one call. Each
   * surface's `firstVertex` says where its own start.
   */
  readonly vertices?: Float32Array;
}

function hiddenFacesFor(map: BspMap | undefined, hiddenClassnames: Set<string> | undefined): Set<number> {
  const hiddenFaces = new Set<number>();
  if (!map || !hiddenClassnames || hiddenClassnames.size === 0) return hiddenFaces;
  for (const entity of map.entities.entities) {
    if (!entity.classname || !hiddenClassnames.has(entity.classname)) continue;
    const modelProp = entity.properties['model'];
    if (!modelProp || !modelProp.startsWith('*')) continue;
    const modelIndex = parseInt(modelProp.substring(1), 10);
    if (isNaN(modelIndex) || modelIndex < 0 || modelIndex >= map.models.length) continue;
    const model = map.models[modelIndex];
    for (let i = 0; i < model.numFaces; i++) {
      hiddenFaces.add(model.firstFace + i);
    }
  }
  return hiddenFaces;
}

/**
 * Packs surfaces into lightmap atlases and interleaved vertex data, with no GPU calls,
 * so it runs in a worker or in Node and feeds the WebGL and WebGPU backends alike.
 */
export function packBspGeometry(
  surfaces: readonly BspSurfaceInput[],
  map?: BspMap,
  options: BspBuildOptions = {}
): PackedBspGeometry {
  const hiddenFaces = hiddenFacesFor(map, options.hiddenClassnames);
  const kept = hiddenFaces.size > 0 ? surfaces.filter((s) => !hiddenFaces.has(s.faceIndex)) : surfaces;

  const resolved: Required<BspBuildOptions> = {
    atlasSize: options.atlasSize ?? 1024,
    lightmapPadding: options.lightmapPadding ?? 1,
    hiddenClassnames: options.hiddenClassnames ?? new Set(),
    textureSizes: options.textureSizes ?? new Map(),
  };

  const atlasBuilders: AtlasBuilder[] = [];
  const packed: (PackedBspSurface | undefined)[] = [];
  let worldVertexCount = 0;

  for (const surface of kept) {
    let placement: LightmapPlacement | undefined;
    if (surface.lightmap) {
      const placed = placeLightmap(atlasBuilders, surface.lightmap, resolved);
      writeLightmapIntoAtlas(placed.atlas, placed.placement, surface.lightmap);
      placement = {
        atlasIndex: placed.placement.atlasIndex,
        offset: [
          (placed.placement.x + resolved.lightmapPadding) / resolved.atlasSize,
          (placed.placement.y + resolved.lightmapPadding) / resolved.atlasSize,
        ],
        scale: [placed.placement.width / resolved.atlasSize, placed.placement.height / resolved.atlasSize],
      };
    }

    const vertexData = buildVertexData(surface, placement, resolved.textureSizes.get(surface.texture));
    const indexData = ensureIndexArray(surface.indices, vertexData.length / 8);

    const styles = surface.styles || [255, 255, 255, 255];
    const styleLayers = [-1, -1, -1, -1];
    let layerCounter = 0;
    for (let i = 0; i < 4; i++) {
      if (styles[i] !== 255) {
        styleLayers[i] = layerCounter;
        layerCounter++;
      }
    }

    packed[surface.faceIndex] = {
      faceIndex: surface.faceIndex,
      texture: surface.texture,
      surfaceFlags: surface.surfaceFlags ?? SURF_NONE,
      lightmap: placement,
      styleIndices: styles,
      styleLayers,
      vertexData,
      indexData,
      vertexCount: vertexData.length / 8,
      indexCount: indexData.length,
      firstVertex: worldVertexCount,
      mins: surface.mins,
      maxs: surface.maxs,
    };
    worldVertexCount += vertexData.length / 8;
  }

  const lightmaps = atlasBuilders.map((b) => ({ width: b.width, height: b.height, pixels: b.data }));
  const vertices = new Float32Array(worldVertexCount * 8);
  for (const surface of packed) if (surface) vertices.set(surface.vertexData, surface.firstVertex! * 8);
  return { surfaces: packed, lightmaps, vertices };
}

/** Uploads packed geometry to WebGL. The result keeps `packBspGeometry`'s face-number indexing. */
export function uploadBspGeometry(gl: WebGL2RenderingContext, geometry: PackedBspGeometry): BspGeometryBuildResult {
  const lightmaps: LightmapAtlas[] = geometry.lightmaps.map((atlas) => {
    const texture = new Texture2D(gl);
    texture.setParameters({
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
    });
    texture.uploadImage(0, gl.RGBA, atlas.width, atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.pixels);
    return { texture, width: atlas.width, height: atlas.height, pixels: atlas.pixels };
  });

  let worldVao: VertexArray | undefined;
  if (geometry.vertices) {
    const worldBuffer = new VertexBuffer(gl, gl.STATIC_DRAW, gl.ARRAY_BUFFER);
    worldBuffer.upload(geometry.vertices as unknown as BufferSource);
    worldVao = new VertexArray(gl);
    worldVao.configureAttributes(BSP_VERTEX_LAYOUT, worldBuffer);
  }

  const surfaces: BspSurfaceGeometry[] = [];
  geometry.surfaces.forEach((surface, faceIndex) => {
    if (!surface) return;
    const vertexBuffer = new VertexBuffer(gl, gl.STATIC_DRAW, gl.ARRAY_BUFFER);
    vertexBuffer.upload(surface.vertexData as unknown as BufferSource);
    const indexBuffer = new IndexBuffer(gl, gl.STATIC_DRAW);
    indexBuffer.upload(surface.indexData as unknown as BufferSource);
    const vao = new VertexArray(gl);
    vao.configureAttributes(BSP_VERTEX_LAYOUT, vertexBuffer);
    surfaces[faceIndex] = {
      ...surface,
      vao,
      vertexBuffer,
      indexBuffer,
      worldVao: worldVao && surface.firstVertex !== undefined ? worldVao : undefined,
    };
  });

  return { surfaces, lightmaps };
}

/**
 * Packs and uploads in one step. `surfaces` in the result is indexed by BSP face number.
 */
export function buildBspGeometry(
  gl: WebGL2RenderingContext,
  surfaces: readonly BspSurfaceInput[],
  map?: BspMap,
  options: BspBuildOptions = {}
): BspGeometryBuildResult {
  return uploadBspGeometry(gl, packBspGeometry(surfaces, map, options));
}
