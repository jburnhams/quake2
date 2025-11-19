import { describe, expect, it } from 'vitest';
import { VirtualFileSystem } from '../src/assets/vfs.js';
import { PakArchive } from '../src/assets/pak.js';
import { buildPak } from './helpers/pakBuilder.js';
import { buildMd3 } from './helpers/md3Builder.js';
import { Md3Loader, Md3ParseError, parseMd3 } from '../src/assets/md3.js';

describe('MD3 loader', () => {
  const baseBuffer = buildMd3({
    frames: [
      {
        min: { x: -1, y: -1, z: -1 },
        max: { x: 1, y: 1, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        radius: 2,
        name: 'idle',
      },
    ],
    tags: [
      {
        name: 'tag_head',
        origin: { x: 1, y: 2, z: 3 },
        axis: [
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 0, z: 1 },
        ],
      },
    ],
    surfaces: [
      {
        name: 'body',
        triangles: [
          [0, 1, 2],
          [2, 1, 0],
        ],
        texCoords: [
          { s: 0, t: 0 },
          { s: 1, t: 0 },
          { s: 1, t: 1 },
        ],
        shaders: [{ name: 'skin', index: 0 }],
        vertices: [
          [
            { position: { x: 0, y: 0, z: 0 }, latLng: 0 },
            { position: { x: 1, y: 0, z: 0.5 }, latLng: 0x3f00 },
            { position: { x: 0, y: 1, z: 0.25 }, latLng: 0x7f00 },
          ],
        ],
      },
    ],
  });

  it('parses header, frames, tags, and surfaces', () => {
    const model = parseMd3(baseBuffer);
    expect(model.header.ident).toBe(0x33504449);
    expect(model.frames).toHaveLength(1);
    expect(model.tags[0]?.[0]?.name).toBe('tag_head');
    expect(model.surfaces[0]?.triangles).toHaveLength(2);
    expect(model.surfaces[0]?.texCoords[2]?.t).toBe(1);
    expect(model.surfaces[0]?.vertices[0]?.[1]?.position.z).toBeCloseTo(0.5);
    expect(model.surfaces[0]?.vertices[0]?.[2]?.normal.z).toBeCloseTo(Math.cos(0));
  });

  it('validates ident, version, and offsets', () => {
    const corrupted = new Uint8Array(baseBuffer.slice(0));
    const view = new DataView(corrupted.buffer);
    view.setInt32(0, 0, true);
    expect(() => parseMd3(corrupted.buffer)).toThrow(Md3ParseError);

    view.setInt32(0, 0x33504449, true);
    view.setInt32(4, 14, true);
    expect(() => parseMd3(corrupted.buffer)).toThrow(Md3ParseError);

    view.setInt32(4, 15, true);
    view.setInt32(104, 16, true);
    expect(() => parseMd3(corrupted.buffer)).toThrow(Md3ParseError);
  });

  it('loads through Md3Loader and VFS', async () => {
    const pakBuffer = buildPak([{ path: 'models/test.md3', data: new Uint8Array(baseBuffer) }]);
    const pak = PakArchive.fromArrayBuffer('base.pak', pakBuffer);
    const vfs = new VirtualFileSystem([pak]);
    const loader = new Md3Loader(vfs);

    const model = await loader.load('models/TEST.MD3');
    expect(model.surfaces[0]?.shaders[0]?.name).toBe('skin');
  });
});
