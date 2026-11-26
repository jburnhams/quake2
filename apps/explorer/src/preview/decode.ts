// Turns a file's bytes into what its preview draws. Pure and synchronous apart from the reads, so
// it is tested in Node against the demo PAK (tests/decode.test.ts) without a browser.
import {
  groupMd2Animations,
  parseBsp,
  parseMd2,
  parseMd3,
  parsePcx,
  parseSprite,
  parseTga,
  parseWal,
  parseWav,
  pcxToRgba,
  type BspMap,
  type Md2Animation,
  type Md2Model,
  type Md3Model,
  type SpriteModel,
  type WavData,
} from '@quake2ts/formats';

export type FileKind = 'image' | 'map' | 'md2' | 'md3' | 'sprite' | 'audio' | 'text' | 'binary';

const KINDS: Record<string, FileKind> = {
  pcx: 'image',
  wal: 'image',
  tga: 'image',
  bsp: 'map',
  md2: 'md2',
  md3: 'md3',
  sp2: 'sprite',
  wav: 'audio',
  cfg: 'text',
  txt: 'text',
  ent: 'text',
  lst: 'text',
  shader: 'text',
  def: 'text',
};

export function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
}

export function kindOf(path: string): FileKind {
  return KINDS[extensionOf(path)] ?? 'binary';
}

/** The words for a kind, as the inspector shows them under the file's name. */
export const KIND_NAMES: Record<FileKind, string> = {
  image: 'Picture',
  map: 'Map',
  md2: 'Model (MD2)',
  md3: 'Model (MD3)',
  sprite: 'Sprite',
  audio: 'Sound',
  text: 'Text',
  binary: 'Data',
};

export type Picture = { format: 'PCX' | 'WAL' | 'TGA'; width: number; height: number; rgba: Uint8Array; name?: string };

export type Decoded =
  | { kind: 'image'; picture: Picture; flags?: number; contents?: number }
  | { kind: 'map'; map: BspMap; textures: string[] }
  | { kind: 'md2'; model: Md2Model; animations: Md2Animation[] }
  | { kind: 'md3'; model: Md3Model }
  | { kind: 'sprite'; sprite: SpriteModel }
  | { kind: 'audio'; wav: WavData; bytes: Uint8Array }
  | { kind: 'text'; text: string }
  | { kind: 'binary'; bytes: Uint8Array };

/** Quake 2's 256-colour palette lives in pics/colormap.pcx; WAL textures are indices into it. */
export const PALETTE_PATH = 'pics/colormap.pcx';

/** Palette indices to RGBA; `transparent` names the index drawn clear (none by default, as for WAL textures). */
export function indexedToRgba(pixels: Uint8Array, palette: Uint8Array | null, transparent = -1): Uint8Array {
  const out = new Uint8Array(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    const index = pixels[i];
    const o = i * 4;
    if (palette) {
      out[o] = palette[index * 3];
      out[o + 1] = palette[index * 3 + 1];
      out[o + 2] = palette[index * 3 + 2];
    } else {
      out[o] = out[o + 1] = out[o + 2] = index;
    }
    out[o + 3] = index === transparent ? 0 : 255;
  }
  return out;
}

/**
 * Decodes one file. `palette` is read only for WAL textures, and may answer null when the open PAKs
 * have no colormap (the texture is then drawn in greys).
 */
export async function decode(path: string, buffer: ArrayBuffer, palette: () => Promise<Uint8Array | null>): Promise<Decoded> {
  const ext = extensionOf(path);
  switch (kindOf(path)) {
    case 'image': {
      if (ext === 'pcx') {
        const pcx = parsePcx(buffer);
        return { kind: 'image', picture: { format: 'PCX', width: pcx.width, height: pcx.height, rgba: pcxToRgba(pcx) } };
      }
      if (ext === 'tga') {
        const tga = parseTga(buffer);
        return { kind: 'image', picture: { format: 'TGA', width: tga.width, height: tga.height, rgba: tga.pixels } };
      }
      const wal = parseWal(buffer);
      const top = wal.mipmaps[0];
      return {
        kind: 'image',
        picture: { format: 'WAL', width: wal.width, height: wal.height, rgba: indexedToRgba(top.data, await palette()), name: wal.name },
        flags: wal.flags,
        contents: wal.contents,
      };
    }
    case 'map': {
      const map = parseBsp(buffer);
      const textures = [...new Set(map.texInfo.map((t) => t.texture))].sort();
      return { kind: 'map', map, textures };
    }
    case 'md2': {
      const model = parseMd2(buffer);
      return { kind: 'md2', model, animations: groupMd2Animations(model.frames) };
    }
    case 'md3':
      return { kind: 'md3', model: parseMd3(buffer) };
    case 'sprite':
      return { kind: 'sprite', sprite: parseSprite(buffer) };
    case 'audio':
      return { kind: 'audio', wav: parseWav(buffer), bytes: new Uint8Array(buffer) };
    case 'text':
      return { kind: 'text', text: new TextDecoder('latin1').decode(buffer) };
    default:
      return { kind: 'binary', bytes: new Uint8Array(buffer) };
  }
}

/** Rows of a hex dump: offset, sixteen bytes, and their printable characters. */
export function hexRows(bytes: Uint8Array, limit = 512): { offset: string; hex: string; text: string }[] {
  const rows = [];
  const end = Math.min(bytes.length, limit);
  for (let start = 0; start < end; start += 16) {
    const slice = bytes.subarray(start, Math.min(start + 16, end));
    rows.push({
      offset: start.toString(16).padStart(8, '0'),
      hex: [...slice].map((b) => b.toString(16).padStart(2, '0')).join(' '),
      text: [...slice].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join(''),
    });
  }
  return rows;
}
