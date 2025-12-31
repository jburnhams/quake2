import { describe, expect, it } from 'vitest';
import {
  BspLoader,
  BspLump,
  BspParseError,
  type BspFace,
  createFaceLightmap,
  parseBsp,
  parseWorldspawnSettings,
} from '../../src/assets/bsp.js';
import { PakArchive } from '../../src/assets/pak.js';
import { VirtualFileSystem } from '../../src/assets/vfs.js';
import { buildPak } from '@quake2ts/test-utils'; // pakBuilder.js';
import { buildTestBsp, encodedVisForClusters } from '@quake2ts/test-utils'; // bspBuilder.js';

function getLumpInfo(buffer: ArrayBuffer, lump: BspLump): { offset: number; length: number } {
  const view = new DataView(buffer);
  return {
    offset: view.getInt32(8 + lump * 8, true),
    length: view.getInt32(12 + lump * 8, true),
  };
}

function sampleBspBuffer(): ArrayBuffer {
  return buildTestBsp({
    entities:
      '{\n"classname" "worldspawn"\n"sky" "unit1"\n"_ambient" "15"\n}\n{\n"classname" "light"\n"origin" "0 0 0"\n}\n',
    planes: [{ normal: [1, 0, 0], dist: 64, type: 0 }],
    vertices: [
      [0, 0, 0],
      [64, 0, 0],
      [0, 64, 0],
    ],
    nodes: [
      { planeIndex: 0, children: [1, -1], mins: [-64, -64, -64], maxs: [64, 64, 64], firstFace: 0, numFaces: 1 },
    ],
    texInfo: [
      {
        s: [1, 0, 0],
        sOffset: 0,
        t: [0, 1, 0],
        tOffset: 0,
        flags: 1,
        value: 0,
        texture: 'E1/STONE',
        nextTexInfo: -1,
      },
    ],
    faces: [
      {
        planeIndex: 0,
        side: 0,
        firstEdge: 0,
        numEdges: 3,
        texInfo: 0,
        styles: [0, 1, 2, 3],
        lightOffset: 0,
      },
    ],
    lighting: new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17]),
    leafs: [
      {
        contents: 1,
        cluster: 0,
        area: 0,
        mins: [-64, -64, -64],
        maxs: [64, 64, 64],
        firstLeafFace: 0,
        numLeafFaces: 1,
        firstLeafBrush: 0,
        numLeafBrushes: 1,
      },
    ],
    leafFaces: new Uint16Array([0]),
    leafBrushes: new Uint16Array([0]),
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
    surfEdges: new Int32Array([0, 1, 2]),
    models: [
      { mins: [-64, -64, -64], maxs: [64, 64, 64], origin: [0, 0, 0], headNode: 0, firstFace: 0, numFaces: 1 },
    ],
    brushes: [{ firstSide: 0, numSides: 1, contents: 1 }],
    brushSides: [{ planeIndex: 0, texInfo: 0 }],
    visibility: encodedVisForClusters(1, [[0xff]]),
  });
}

describe('BSP parsing', () => {
  it('parses BSP header and lumps into structured data', () => {
    const buffer = sampleBspBuffer();
    const bsp = parseBsp(buffer);

    expect(bsp.header.version).toBe(38);
    expect(bsp.planes[0].normal).toEqual([1, 0, 0]);
    expect(bsp.vertices[2]).toEqual([0, 64, 0]);
    expect(bsp.nodes[0].children).toEqual([1, -1]);
    expect(bsp.texInfo[0].texture).toBe('E1/STONE');
    expect(bsp.faces[0].styles).toEqual([0, 1, 2, 3]);
    expect(bsp.lightMaps.byteLength).toBe(8);
    expect(bsp.leafs[0].cluster).toBe(0);
    expect(bsp.edges).toHaveLength(3);
    expect(bsp.surfEdges).toHaveLength(3);
    expect(bsp.models[0].firstFace).toBe(0);
    expect(bsp.brushes[0].contents).toBe(1);
    expect(bsp.brushSides[0].planeIndex).toBe(0);
    expect(bsp.visibility?.clusters[0].pvs[0]).toBe(0xff);
  });

  it('produces leaf face and brush lists for traversal', () => {
    const bsp = parseBsp(sampleBspBuffer());
    expect(bsp.leafLists.leafFaces).toEqual([[0]]);
    expect(bsp.leafLists.leafBrushes).toEqual([[0]]);
  });

  it('extracts worldspawn settings and entities', () => {
    const bsp = parseBsp(sampleBspBuffer());
    expect(bsp.entities.entities).toHaveLength(2);
    expect(parseWorldspawnSettings(bsp.entities).sky).toBe('unit1');
    expect(parseWorldspawnSettings(bsp.entities)._ambient).toBe('15');
  });

  it('decompresses run-length encoded visibility like the rerelease', () => {
    const encodedVisibility = encodedVisForClusters(2, [
      [0, 1], // one zero byte
      [0xff],
    ]);
    const buffer = buildTestBsp({ visibility: encodedVisibility });
    const bsp = parseBsp(buffer);
    expect(Array.from(bsp.visibility?.clusters[0].pvs ?? [])).toEqual([0]);
    expect(Array.from(bsp.visibility?.clusters[1].pvs ?? [])).toEqual([0xff]);
  });

  it('returns lightmap slices for faces', () => {
    const bsp = parseBsp(sampleBspBuffer());
    const face = bsp.faces[0];
    const slice = createFaceLightmap(face, bsp.lightMaps, bsp.lightMapInfo[0]);
    expect(slice?.length).toBeGreaterThan(0);
    expect(slice?.[0]).toBe(10);
  });

  it('throws on invalid magic or version', () => {
    const buffer = sampleBspBuffer();
    const view = new DataView(buffer);
    view.setUint8(0, 0x00);
    expect(() => parseBsp(buffer)).toThrow(BspParseError);
    view.setUint8(0, 0x49);
    view.setInt32(4, 1, true);
    expect(() => parseBsp(buffer)).toThrow(BspParseError);
  });

  it('validates lump sizes to match rerelease safety checks', () => {
    const buffer = sampleBspBuffer();
    const view = new DataView(buffer);
    // Corrupt plane lump length to trigger safety
    view.setInt32(8 + 1 * 8 + 4, 1, true);
    expect(() => parseBsp(buffer)).toThrow(BspParseError);
  });

  it('rejects model lumps that are not 48-byte aligned', () => {
    const buffer = sampleBspBuffer();
    const view = new DataView(buffer);
    // Set the model lump length to a non-multiple of 48 bytes
    view.setInt32(8 + BspLump.Models * 8 + 4, 40, true);
    expect(() => parseBsp(buffer)).toThrow(BspParseError);
  });

  it('loads from VFS through BspLoader', async () => {
    const pakBuffer = buildPak([{ path: 'MAPS/TEST.BSP', data: new Uint8Array(sampleBspBuffer()) }]);
    const pak = PakArchive.fromArrayBuffer('base.pak', pakBuffer);
    const vfs = new VirtualFileSystem([pak]);
    const loader = new BspLoader(vfs);

    const bsp = await loader.load('maps/test.bsp');
    expect(bsp.faces).toHaveLength(1);
    expect(parseWorldspawnSettings(bsp.entities).sky).toBe('unit1');
  });

  it('rejects visibility offsets that leave the lump bounds', () => {
    const buffer = sampleBspBuffer();
    const view = new DataView(buffer);
    const vis = getLumpInfo(buffer, BspLump.Visibility);
    view.setInt32(vis.offset + 4, vis.length + 4, true);
    expect(() => parseBsp(buffer)).toThrow(BspParseError);
  });

  it('guards against leaf face/brush lists that overflow their lumps', () => {
    const buffer = sampleBspBuffer();
    const view = new DataView(buffer);
    const leafs = getLumpInfo(buffer, BspLump.Leafs);
    // numLeafFaces is stored at offset + 22
    view.setUint16(leafs.offset + 22, 5, true);
    expect(() => parseBsp(buffer)).toThrow(BspParseError);
  });

  it('slices face lightmaps using the reported lump length', () => {
    const lightMaps = new Uint8Array([1, 2, 3, 4, 5]);
    const face: BspFace = {
      planeIndex: 0,
      side: 0,
      firstEdge: 0,
      numEdges: 0,
      texInfo: 0,
      styles: [0, 0, 0, 0],
      lightOffset: 1,
    };
    const slice = createFaceLightmap(face, lightMaps, { offset: 1, length: 3 });
    expect(slice).toEqual(lightMaps.subarray(1, 4));
  });
});
