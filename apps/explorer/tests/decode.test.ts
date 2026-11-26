// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { Library } from '../src/library/library';
import { PALETTE_PATH, decode, hexRows, indexedToRgba, kindOf } from '../src/preview/decode';
import { flagNames } from '../src/files/FileDetails';
import { demoPak } from './setup';

let library: Library;
const palette = async () => (await import('@quake2ts/formats')).parsePcx(await library.read(PALETTE_PATH)).palette;
const open = async (path: string) => decode(path, await library.read(path), palette);

beforeAll(() => {
  library = new Library();
  library.mount('pak.pak', demoPak.buffer.slice(demoPak.byteOffset, demoPak.byteOffset + demoPak.byteLength) as ArrayBuffer);
});

describe('decode', () => {
  it('names each kind by extension', () => {
    expect(kindOf('maps/demo1.BSP')).toBe('map');
    expect(kindOf('sprites/s_explod.sp2')).toBe('sprite');
    expect(kindOf('demos/demo1.dm2')).toBe('binary');
  });

  it('draws a WAL texture through the colormap palette', async () => {
    const d = await open('textures/e1u1/clip.wal');
    if (d.kind !== 'image') throw new Error(d.kind);
    expect(d.picture).toMatchObject({ format: 'WAL', width: 32, height: 32 });
    expect(d.picture.rgba).toHaveLength(32 * 32 * 4);
    expect(flagNames(d.flags!, [[0x80, 'No draw']])).toBe('No draw');
  });

  it('reads a map, its textures sorted and without repeats', async () => {
    const d = await open('maps/demo1.bsp');
    if (d.kind !== 'map') throw new Error(d.kind);
    expect(d.map.entities.entities).toHaveLength(500);
    expect(d.textures).toHaveLength(113);
    expect([...d.textures].sort()).toEqual(d.textures);
  });

  it('groups an MD2 model\'s frames into animations', async () => {
    const d = await open('models/deadbods/dude/tris.md2');
    if (d.kind !== 'md2') throw new Error(d.kind);
    expect(d.animations.reduce((n, a) => n + a.lastFrame - a.firstFrame + 1, 0)).toBe(6);
  });

  it('keeps a WAV file\'s bytes to play', async () => {
    const d = await open('sound/berserk/attack.wav');
    if (d.kind !== 'audio') throw new Error(d.kind);
    expect(d.wav.sampleRate).toBe(11025);
    expect(d.bytes.byteLength).toBe(9707);
  });

  it('shows a demo file as bytes', async () => {
    const d = await open('demos/demo1.dm2');
    if (d.kind !== 'binary') throw new Error(d.kind);
    expect(hexRows(d.bytes)).toHaveLength(32);
  });

  it('maps palette indices, with one index clear when asked', () => {
    const palette = new Uint8Array(768);
    palette.set([10, 20, 30], 3);
    expect([...indexedToRgba(new Uint8Array([1, 2]), palette, 2)]).toEqual([10, 20, 30, 255, 0, 0, 0, 0]);
    expect([...indexedToRgba(new Uint8Array([7]), null)]).toEqual([7, 7, 7, 255]);
  });
});
