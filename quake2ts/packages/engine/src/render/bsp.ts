import { SURF_NONE, type SurfaceFlag } from '@quake2ts/shared';
import {
  IndexBuffer,
  Texture2D,
  VertexArray,
  VertexBuffer,
  type VertexAttributeLayout,
} from './resources.js';

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
  readonly texture: string;
  readonly surfaceFlags: SurfaceFlag;
  readonly lightmap?: LightmapPlacement;
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
}

export interface BspGeometryBuildResult {
  readonly surfaces: readonly BspSurfaceGeometry[];
  readonly lightmaps: readonly LightmapAtlas[];
}

const FLOAT_BYTES = 4;
const STRIDE = 7 * FLOAT_BYTES;

export const BSP_VERTEX_LAYOUT: readonly VertexAttributeLayout[] = [
  // Position
  { index: 0, size: 3, type: 0x1406, stride: STRIDE, offset: 0 },
  // Diffuse UV
  { index: 1, size: 2, type: 0x1406, stride: STRIDE, offset: 3 * FLOAT_BYTES },
  // Lightmap UV
  { index: 2, size: 2, type: 0x1406, stride: STRIDE, offset: 5 * FLOAT_BYTES },
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

  const vertexCount = vertices.length / 3;
  if (texCoords.length / 2 !== vertexCount) {
    throw new Error('Texture coordinates count mismatch');
  }
  if (lightmapCoords.length / 2 !== vertexCount) {
    throw new Error('Lightmap coordinates count mismatch');
  }

  const interleaved = new Float32Array(vertexCount * 7);
  for (let i = 0; i < vertexCount; i++) {
    const v = i * 3;
    const t = i * 2;
    const o = i * 7;
    interleaved[o] = vertices[v];
    interleaved[o + 1] = vertices[v + 1];
    interleaved[o + 2] = vertices[v + 2];
    interleaved[o + 3] = texCoords[t];
    interleaved[o + 4] = texCoords[t + 1];
    interleaved[o + 5] = lightmapCoords[t];
    interleaved[o + 6] = lightmapCoords[t + 1];
  }
  return interleaved;
}

export function buildBspGeometry(
  gl: WebGL2RenderingContext,
  surfaces: readonly BspSurfaceInput[],
  options: BspBuildOptions = {}
): BspGeometryBuildResult {
  const resolved: Required<BspBuildOptions> = {
    atlasSize: options.atlasSize ?? 1024,
    lightmapPadding: options.lightmapPadding ?? 1,
  };

  const atlasBuilders: AtlasBuilder[] = [];
  const placements = new Map<number, LightmapPlacement>();

  surfaces.forEach((surface, index) => {
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

  const results: BspSurfaceGeometry[] = surfaces.map((surface, index) => {
    const placement = placements.get(index);
    const vertexData = buildVertexData(surface, placement);
    const indexData = ensureIndexArray(surface.indices, vertexData.length / 7);

    const vertexBuffer = new VertexBuffer(gl, gl.STATIC_DRAW, gl.ARRAY_BUFFER);
    vertexBuffer.upload(vertexData as unknown as BufferSource);

    const indexBuffer = new IndexBuffer(gl, gl.STATIC_DRAW);
    indexBuffer.upload(indexData as unknown as BufferSource);

    const vao = new VertexArray(gl);
    vao.configureAttributes(BSP_VERTEX_LAYOUT, vertexBuffer);

    return {
      vao,
      vertexBuffer,
      indexBuffer,
      indexCount: indexData.length,
      texture: surface.texture,
      surfaceFlags: surface.surfaceFlags ?? SURF_NONE,
      lightmap: placement,
      vertexData,
      indexData,
    };
  });

  return { surfaces: results, lightmaps };
}
