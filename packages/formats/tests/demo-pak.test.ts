// Every loader against the real files in the committed demo pak (pak.pak), with expected
// values checked independently of these parsers (the BSP lump sizes and entity text read with
// Python's struct module; texture flags against q_shared.h).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { VirtualFileSystem } from 'strata-vfs';
import {
  PakArchive,
  parseBsp,
  parseEntLump,
  parseMd2,
  parsePcx,
  parseSprite,
  parseTga,
  parseWal,
  parseWav,
  pcxToRgba,
} from '../src/index.js';

const PAK_PATH = fileURLToPath(new URL('../../../pak.pak', import.meta.url));

let vfs: VirtualFileSystem;
let pak: PakArchive;

async function read(path: string): Promise<ArrayBuffer> {
  const bytes = await vfs.readFile(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

beforeAll(() => {
  const file = readFileSync(PAK_PATH);
  pak = PakArchive.fromArrayBuffer('pak.pak', file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  vfs = new VirtualFileSystem();
  vfs.mount(pak);
});

describe('the demo pak', () => {
  it('lists its 21 files and top-level folders', () => {
    expect(pak.listEntries()).toHaveLength(21);
    expect(vfs.list('').directories).toEqual(['demos', 'env', 'maps', 'models', 'pics', 'sound', 'sprites', 'textures']);
    expect(vfs.list('sprites').files.map((f) => f.path)).toContain('sprites/s_explod.sp2');
    expect(vfs.stat('MAPS\\DEMO1.BSP')?.size).toBe(1983276);
  });

  it('parses demo1.bsp', async () => {
    const map = parseBsp(await read('maps/demo1.bsp'));
    expect(map.header.version).toBe(38);
    expect(map.faces).toHaveLength(8120);
    expect(map.models).toHaveLength(24);
    expect(map.entities.entities).toHaveLength(500);
    expect(map.entities.worldspawn?.properties.message).toBe('Outer Base');
    expect(map.entities.getUniqueClassnames()).toContain('info_player_start');
  });

  it('parses the entity lump text on its own', async () => {
    const map = parseBsp(await read('maps/demo1.bsp'));
    const ents = parseEntLump(map.entities.raw);
    expect(ents).toHaveLength(500);
    expect(ents[0].classname).toBe('worldspawn');
  });

  it('parses a PCX picture and its palette', async () => {
    const image = parsePcx(await read('pics/colormap.pcx'));
    expect([image.width, image.height, image.bitsPerPixel]).toEqual([256, 320, 8]);
    expect(image.palette).toHaveLength(768);
    expect(pcxToRgba(image)).toHaveLength(256 * 320 * 4);
  });

  it('parses a WAL texture with its flags', async () => {
    const wal = parseWal(await read('textures/e1u1/clip.wal'));
    expect(wal.name).toBe('e1u1/clip');
    expect([wal.width, wal.height]).toEqual([32, 32]);
    expect(wal.mipmaps).toHaveLength(4);
    expect(wal.flags).toBe(0x80); // SURF_NODRAW
    expect(wal.contents).toBe(0x10000 | 0x20000); // CONTENTS_PLAYERCLIP | CONTENTS_MONSTERCLIP
  });

  it('parses an MD2 model', async () => {
    const model = parseMd2(await read('models/deadbods/dude/tris.md2'));
    expect(model.header.numFrames).toBe(6);
    expect(model.header.numVertices).toBe(209);
    expect(model.header.numTriangles).toBe(376);
    expect(model.skins.map((s) => s.name)).toEqual(['models/deadbods/dude/dead1.pcx']);
  });

  it('parses a 32-bit TGA sky face', async () => {
    const tga = parseTga(await read('env/sky1rt.tga'));
    expect([tga.width, tga.height]).toEqual([256, 256]);
  });

  it('parses an SP2 sprite and names its frames', async () => {
    const sprite = parseSprite(await read('sprites/s_explod.sp2'));
    expect(sprite.numFrames).toBe(6);
    expect(sprite.frames[0]).toMatchObject({ width: 56, height: 56, name: 'sprites/s_explod_0.pcx' });
    expect(vfs.hasFile(sprite.frames[5].name)).toBe(true);
  });

  it('parses an 8-bit mono WAV', async () => {
    const wav = parseWav(await read('sound/berserk/attack.wav'));
    expect([wav.sampleRate, wav.channels, wav.bitsPerSample]).toEqual([11025, 1, 8]);
    expect(wav.samples).toHaveLength(9663);
  });
});
