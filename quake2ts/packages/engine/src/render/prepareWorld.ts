/**
 * Turns a parsed BSP and the files it names into everything a renderer needs to draw the
 * world, with no GPU or DOM calls, so it runs in a worker, in Node tests, or in the browser,
 * and both the WebGL and the WebGPU backends upload the same data.
 *
 * Why it exists: world geometry used to be built only through `buildBspGeometry(gl, ...)`,
 * so WebGPU could not load a map without a WebGL context, and every caller (client,
 * explorer, tests) found and decoded textures in its own way.
 */
import type { BspMap } from '../assets/bsp.js';
import { parsePcx } from '../assets/pcx.js';
import { parseWal } from '../assets/wal.js';
import { walToRgba, type PreparedTexture } from '../assets/texture.js';
import { createBspSurfaces, packBspGeometry, type BspBuildOptions, type PackedBspGeometry } from './bsp.js';

/** Anything that can read a game file by its path inside the game directory (a VFS, a PAK, the explorer's library). */
export interface FileSource {
  readFile(path: string): Promise<Uint8Array>;
}

export interface PreparedWorld {
  readonly map: BspMap;
  readonly geometry: PackedBspGeometry;
  /** RGBA textures by the name the BSP uses (`e1u1/floor1_3`), mip levels included. */
  readonly textures: ReadonlyMap<string, PreparedTexture>;
  /** Texture names the map uses that the file source could not provide or decode. */
  readonly missingTextures: readonly string[];
  /** Light style values (0..n) at time 0: style 0 is normal light. */
  readonly lightStyles: readonly number[];
}

export interface PrepareWorldOptions extends BspBuildOptions {
  /** A 768-byte RGB palette; read from `pics/colormap.pcx` when not given. */
  readonly palette?: Uint8Array;
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** Reads the game palette from `pics/colormap.pcx`, as the original renderer does (Draw_GetPalette). */
export async function loadPalette(files: FileSource): Promise<Uint8Array> {
  const pcx = parsePcx(toArrayBuffer(await files.readFile('pics/colormap.pcx')));
  return pcx.palette;
}

/** Collects the texture names a map uses, including every frame of animated (`+0name`) chains. */
export function mapTextureNames(map: BspMap): string[] {
  const names = new Set<string>();
  for (const info of map.texInfo) {
    if (info?.texture) names.add(info.texture);
  }
  return [...names];
}

export async function prepareWorld(
  map: BspMap,
  files: FileSource,
  options: PrepareWorldOptions = {}
): Promise<PreparedWorld> {
  const palette = options.palette ?? (await loadPalette(files));

  const textures = new Map<string, PreparedTexture>();
  const missingTextures: string[] = [];
  await Promise.all(
    mapTextureNames(map).map(async (name) => {
      try {
        const bytes = await files.readFile(`textures/${name}.wal`);
        textures.set(name, walToRgba(parseWal(toArrayBuffer(bytes)), palette));
      } catch {
        missingTextures.push(name);
      }
    })
  );
  missingTextures.sort();

  const textureSizes = new Map([...textures].map(([name, t]) => [name, { width: t.width, height: t.height }]));
  const geometry = packBspGeometry(createBspSurfaces(map), map, { ...options, textureSizes });

  // Style 0 is "m" (normal) in every map; the rest animate and are set by the game.
  const lightStyles = new Array(256).fill(1);
  return { map, geometry, textures, missingTextures, lightStyles };
}
