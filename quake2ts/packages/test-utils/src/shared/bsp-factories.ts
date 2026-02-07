import { BspLump } from '@quake2ts/engine';
import { buildTestBsp, encodedVisForClusters } from '../engine/builders/bspBuilder.js';

export function getLumpInfo(buffer: ArrayBuffer, lump: BspLump): { offset: number; length: number } {
  const view = new DataView(buffer);
  return {
    offset: view.getInt32(8 + lump * 8, true),
    length: view.getInt32(12 + lump * 8, true),
  };
}

export function createTestBspBuffer(): ArrayBuffer {
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
