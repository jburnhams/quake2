import { describe, expect, it } from 'vitest';
import { Vec3 } from '@quake2ts/shared';
import {
  Md2Loader,
  Md2ParseError,
  groupMd2Animations,
  parseMd2,
  type Md2Frame,
} from '@quake2ts/engine/assets/md2.js';
import { PakArchive } from '@quake2ts/engine/assets/pak.js';
import { VirtualFileSystem } from '@quake2ts/engine/assets/vfs.js';
import { buildMd2 } from '@quake2ts/test-utils'; // md2Builder.js';
import { buildPak } from '@quake2ts/test-utils'; // pakBuilder.js';

describe('MD2 loader', () => {
  const baseFrame = (name: string, z: number): Md2Frame => ({
    name,
    vertices: [
      { position: { x: 1, y: 2, z }, normalIndex: 0, normal: { x: 0, y: 0, z: 1 } },
      { position: { x: 2, y: 4, z }, normalIndex: 1, normal: { x: 0, y: 0, z: 1 } },
      { position: { x: 3, y: 6, z }, normalIndex: 2, normal: { x: 0, y: 0, z: 1 } },
    ],
  });

  const md2Buffer = buildMd2({
    skins: ['soldier'],
    texCoords: [
      { s: 0, t: 0 },
      { s: 16, t: 16 },
      { s: 32, t: 32 },
    ],
    triangles: [
      { vertexIndices: [0, 1, 2], texCoordIndices: [0, 1, 2] },
      { vertexIndices: [2, 1, 0], texCoordIndices: [2, 1, 0] },
    ],
    frames: [
      baseFrame('run01', 8),
      baseFrame('run02', 9),
    ].map((frame) => ({
      name: frame.name,
      vertices: frame.vertices.map((vertex) => ({
        position: vertex.position as Vec3,
        normalIndex: vertex.normalIndex,
      })),
    })),
    glCommands: [
      { mode: 'strip', vertices: [{ s: 0, t: 0, vertexIndex: 0 }, { s: 1, t: 1, vertexIndex: 1 }] },
      { mode: 'fan', vertices: [{ s: 0.5, t: 0.5, vertexIndex: 2 }] },
    ],
  });

  it('parses a valid MD2 buffer', () => {
    const model = parseMd2(md2Buffer);
    expect(model.header.ident).toBe(844121161);
    expect(model.skins[0]?.name).toBe('soldier');
    expect(model.texCoords).toHaveLength(3);
    expect(model.triangles).toHaveLength(2);
    expect(model.frames).toHaveLength(2);
    expect(model.frames[0]?.vertices[0]?.position).toMatchObject({ x: 1, y: 2, z: 8 });
    expect(model.glCommands).toHaveLength(2);
    expect(model.glCommands[0]?.mode).toBe('strip');
    expect(model.glCommands[1]?.vertices[0]?.vertexIndex).toBe(2);
  });

  it('validates header magic, version, and frame size', () => {
    const corrupted = new Uint8Array(md2Buffer.slice(0));
    const view = new DataView(corrupted.buffer);
    view.setInt32(0, 0, true);
    expect(() => parseMd2(corrupted.buffer)).toThrow(Md2ParseError);
    view.setInt32(0, 844121161, true);
    view.setInt32(4, 7, true);
    expect(() => parseMd2(corrupted.buffer)).toThrow(Md2ParseError);
    view.setInt32(4, 8, true);
    view.setInt32(16, 0, true);
    expect(() => parseMd2(corrupted.buffer)).toThrow(Md2ParseError);
  });

  it('rejects invalid offsets and triangle references', () => {
    const corrupted = new Uint8Array(md2Buffer.slice(0));
    const view = new DataView(corrupted.buffer);
    view.setInt32(44, 999999, true);
    expect(() => parseMd2(corrupted.buffer)).toThrow(Md2ParseError);

    const badTri = buildMd2({
      skins: ['base'],
      texCoords: [{ s: 0, t: 0 }],
      triangles: [{ vertexIndices: [0, 4, 2], texCoordIndices: [0, 2, 0] }],
      frames: [baseFrame('only', 1)].map((frame) => ({
        name: frame.name,
        vertices: frame.vertices.map((vertex) => ({ position: vertex.position as Vec3, normalIndex: vertex.normalIndex })),
      })),
    });
    expect(() => parseMd2(badTri)).toThrow(Md2ParseError);
  });

  it('validates normals and GL commands', () => {
    const badNormal = buildMd2({
      skins: ['base'],
      texCoords: [{ s: 0, t: 0 }],
      triangles: [{ vertexIndices: [0, 1, 2], texCoordIndices: [0, 0, 0] }],
      frames: [
        {
          name: 'bad',
          vertices: [
            { position: { x: 1, y: 1, z: 1 }, normalIndex: 0 },
            { position: { x: 2, y: 2, z: 2 }, normalIndex: 255 },
            { position: { x: 3, y: 3, z: 3 }, normalIndex: 1 },
          ],
        },
      ],
    });
    expect(() => parseMd2(badNormal)).toThrow(Md2ParseError);

    const glCorrupt = new Uint8Array(md2Buffer.slice(0));
    const glView = new DataView(glCorrupt.buffer);
    const glOffset = glView.getInt32(60, true);
    glView.setInt32(glOffset, 5, true); // strip with five vertices but only two entries
    expect(() => parseMd2(glCorrupt.buffer)).toThrow(Md2ParseError);
  });

  it('groups animations by frame prefixes', () => {
    const animations = groupMd2Animations([
      { name: 'run01', vertices: [] },
      { name: 'run02', vertices: [] },
      { name: 'attack1', vertices: [] },
      { name: 'attack2', vertices: [] },
      { name: 'die', vertices: [] },
    ]);

    expect(animations).toEqual([
      { name: 'run', firstFrame: 0, lastFrame: 1 },
      { name: 'attack', firstFrame: 2, lastFrame: 3 },
      { name: 'die', firstFrame: 4, lastFrame: 4 },
    ]);
  });

  it('loads from VFS through Md2Loader', async () => {
    const pakBuffer = buildPak([{ path: 'models/enforcer.md2', data: new Uint8Array(md2Buffer) }]);
    const pak = PakArchive.fromArrayBuffer('base.pak', pakBuffer);
    const vfs = new VirtualFileSystem([pak]);
    const loader = new Md2Loader(vfs);

    const model = await loader.load('models/ENFORCER.MD2');
    expect(model.skins[0]?.name).toBe('soldier');
    expect(model.frames[1]?.vertices[2]?.position.z).toBe(9);
  });
});
