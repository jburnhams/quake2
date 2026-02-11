import { describe, it, expect } from 'vitest';
import { BspWriter } from '../../../src/output/bspWriter.js';
import { serializeEntity, serializeEntities } from '../../../src/output/entityString.js';
import { BspData, BspLump, BSP_MAGIC, BSP_VERSION } from '../../../src/types/bsp.js';

describe('serializeEntities', () => {
  it('serializes a single entity', () => {
    const entity = {
      classname: 'worldspawn',
      properties: {
        message: 'Hello World',
        wad: 'textures.wad'
      }
    };
    const output = serializeEntity(entity);
    expect(output).toContain('"classname" "worldspawn"');
    expect(output).toContain('"message" "Hello World"');
    expect(output).toContain('"wad" "textures.wad"');
    expect(output).toMatch(/^\{\s*"classname" "worldspawn"/);
  });

  it('handles classname in properties', () => {
    const entity = {
      classname: 'info_player_start',
      properties: {
        classname: 'info_player_start', // Should be skipped
        origin: '0 0 0'
      }
    };
    const output = serializeEntity(entity);
    // Should appear once
    const matches = output.match(/"classname"/g);
    expect(matches).toHaveLength(1);
    expect(output).toContain('"origin" "0 0 0"');
  });

  it('serializes multiple entities', () => {
    const entities = [
      { classname: 'worldspawn', properties: {} },
      { classname: 'light', properties: { origin: '100 0 0' } }
    ];
    const output = serializeEntities(entities);
    expect(output).toContain('"classname" "worldspawn"');
    expect(output).toContain('"classname" "light"');
    expect(output.match(/\{/g)).toHaveLength(2);
  });
});

describe('BspWriter', () => {
  const mockBspData: BspData = {
    header: { version: BSP_VERSION, lumps: new Map() },
    entities: { raw: '{"classname" "worldspawn"}\n', entities: [], getUniqueClassnames: () => [] } as any,
    planes: [{ normal: { x: 0, y: 1, z: 0 }, dist: 100, type: 1 }],
    vertices: [{ x: 10, y: 20, z: 30 }],
    nodes: [{
      planeIndex: 0,
      children: [1, -2], // Node 1, Leaf 1
      mins: [-100, -100, -100],
      maxs: [100, 100, 100],
      firstFace: 0,
      numFaces: 1
    }],
    texInfo: [{
      s: { x: 1, y: 0, z: 0 },
      sOffset: 0,
      t: { x: 0, y: 1, z: 0 },
      tOffset: 0,
      flags: 0,
      value: 0,
      texture: 'base_wall',
      nextTexInfo: -1
    }],
    faces: [{
      planeIndex: 0,
      side: 0,
      firstEdge: 0,
      numEdges: 3,
      texInfo: 0,
      styles: [0, 0, 0, 0],
      lightOffset: -1
    }],
    lightMaps: new Uint8Array(0),
    lightMapInfo: [],
    leafs: [{
      contents: 0,
      cluster: -1,
      area: 0,
      mins: [-10, -10, -10],
      maxs: [10, 10, 10],
      firstLeafFace: 0, // Should be ignored/recalc
      numLeafFaces: 0,
      firstLeafBrush: 0,
      numLeafBrushes: 0
    }],
    leafLists: {
      leafFaces: [[0]], // Leaf 0 has face 0
      leafBrushes: [[0]] // Leaf 0 has brush 0
    },
    edges: [{ vertices: [0, 1] }],
    surfEdges: new Int32Array([0, 1, 2]),
    models: [{
      mins: { x: -100, y: -100, z: -100 },
      maxs: { x: 100, y: 100, z: 100 },
      origin: { x: 0, y: 0, z: 0 },
      headNode: 0,
      firstFace: 0,
      numFaces: 1
    }],
    brushes: [{
      firstSide: 0,
      numSides: 6,
      contents: 1
    }],
    brushSides: [{ planeIndex: 0, texInfo: 0 }],
    visibility: {
      numClusters: 1,
      clusters: [{ pvs: new Uint8Array([255]), phs: new Uint8Array([255]) }]
    },
    areas: [],
    areaPortals: []
  };

  it('writes a valid BSP header', () => {
    const buffer = BspWriter.write(mockBspData);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Magic
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(magic).toBe(BSP_MAGIC);

    // Version
    const version = view.getInt32(4, true);
    expect(version).toBe(BSP_VERSION);
  });

  it('writes correct lump offsets and lengths', () => {
    const buffer = BspWriter.write(mockBspData);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Check Entities Lump (Index 0)
    const entOffset = view.getInt32(8, true);
    const entLength = view.getInt32(12, true);

    expect(entLength).toBe(mockBspData.entities.raw.length);

    // Read entities
    const entStr = new TextDecoder().decode(buffer.slice(entOffset, entOffset + entLength));
    expect(entStr).toBe(mockBspData.entities.raw);
  });

  it('writes planes correctly', () => {
    const buffer = BspWriter.write(mockBspData);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Find Planes Lump (Index 1)
    const offset = view.getInt32(8 + 1 * 8, true);
    const length = view.getInt32(12 + 1 * 8, true);

    expect(length).toBe(20); // 1 plane * 20 bytes

    const pView = new DataView(buffer.buffer, buffer.byteOffset + offset, length);
    expect(pView.getFloat32(0, true)).toBe(0); // nx
    expect(pView.getFloat32(4, true)).toBe(1); // ny
    expect(pView.getFloat32(8, true)).toBe(0); // nz
    expect(pView.getFloat32(12, true)).toBe(100); // dist
    expect(pView.getInt32(16, true)).toBe(1); // type
  });

  it('compresses visibility data', () => {
    const dataWithVis = {
      ...mockBspData,
      visibility: {
        numClusters: 1,
        clusters: [{
          pvs: new Uint8Array([0, 0, 0, 5, 0]), // 3 zeros, then 5, then 1 zero
          phs: new Uint8Array([1])
        }]
      }
    };

    const buffer = BspWriter.write(dataWithVis);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const offset = view.getInt32(8 + BspLump.Visibility * 8, true);
    const length = view.getInt32(12 + BspLump.Visibility * 8, true);

    // Header: numClusters (4) + offsets (8) = 12 bytes
    // Payload:
    // PVS: 0, 3, 5, 0, 1 (5 bytes)
    // PHS: 1 (1 byte)
    // Total should be around 18 bytes.

    const visView = new DataView(buffer.buffer, buffer.byteOffset + offset, length);
    const numClusters = visView.getInt32(0, true);
    expect(numClusters).toBe(1);

    const pvsOffset = visView.getInt32(4, true);

    // Read PVS payload
    // pvsOffset is relative to lump start (usually? Or absolute? Need to check reader logic)
    // The reader logic: absolutePvs = info.offset + pvsOffset
    // So pvsOffset is relative to lump start.

    // BspWriter implementation: writer.writeLong(currentOffset).
    // currentOffset starts at headerSize.
    // So yes, relative.

    // Let's verify payload bytes manually
    // We expect PVS at offset + pvsOffset
    const pvsData = buffer.slice(offset + pvsOffset, offset + pvsOffset + 5);
    // 0, 3 (run of 3 zeros), 5, 0, 1 (run of 1 zero)
    expect(pvsData[0]).toBe(0);
    expect(pvsData[1]).toBe(3);
    expect(pvsData[2]).toBe(5);
    expect(pvsData[3]).toBe(0);
    expect(pvsData[4]).toBe(1);
  });
});
