import { BinaryWriter, Vec3 } from '@quake2ts/shared';
import {
  BspData,
  BspLump,
  BspPlane,
  BspNode,
  BspLeaf,
  BspTexInfo,
  BspFace,
  BspModel,
  BspBrush,
  BspBrushSide,
  BspArea,
  BspAreaPortal,
  BspVisibility,
  BSP_MAGIC,
  BSP_VERSION
} from '../types/bsp.js';

const HEADER_LUMPS = 19;
const HEADER_SIZE = 4 + 4 + HEADER_LUMPS * 8; // magic + version + lump infos

export class BspWriter {
  static write(data: BspData): Uint8Array {
    // 1. Generate Lumps
    const lumps = new Map<BspLump, Uint8Array>();

    lumps.set(BspLump.Entities, new TextEncoder().encode(data.entities.raw));
    lumps.set(BspLump.Planes, BspWriter.encodePlanes(data.planes));
    lumps.set(BspLump.Vertices, BspWriter.encodeVertices(data.vertices));
    lumps.set(BspLump.Visibility, BspWriter.encodeVisibility(data.visibility));
    lumps.set(BspLump.Nodes, BspWriter.encodeNodes(data.nodes));
    lumps.set(BspLump.TexInfo, BspWriter.encodeTexInfo(data.texInfo));
    lumps.set(BspLump.Faces, BspWriter.encodeFaces(data.faces));
    lumps.set(BspLump.Lighting, data.lightMaps);

    // Leafs and lists are coupled
    const { leafBuffer, leafFacesBuffer, leafBrushesBuffer } = BspWriter.encodeLeafsAndLists(data.leafs, data.leafLists);
    lumps.set(BspLump.Leafs, leafBuffer);
    lumps.set(BspLump.LeafFaces, leafFacesBuffer);
    lumps.set(BspLump.LeafBrushes, leafBrushesBuffer);

    lumps.set(BspLump.Edges, BspWriter.encodeEdges(data.edges));
    lumps.set(BspLump.SurfEdges, new Uint8Array(data.surfEdges.buffer, data.surfEdges.byteOffset, data.surfEdges.byteLength));
    lumps.set(BspLump.Models, BspWriter.encodeModels(data.models));
    lumps.set(BspLump.Brushes, BspWriter.encodeBrushes(data.brushes));
    lumps.set(BspLump.BrushSides, BspWriter.encodeBrushSides(data.brushSides));
    lumps.set(BspLump.Areas, BspWriter.encodeAreas(data.areas));
    lumps.set(BspLump.AreaPortals, BspWriter.encodeAreaPortals(data.areaPortals));

    // Pop is unused/padding usually
    lumps.set(BspLump.Pop, new Uint8Array(0));

    // 2. Calculate Layout
    let cursor = HEADER_SIZE;
    const lumpInfos = new Map<BspLump, { offset: number; length: number }>();

    for (let i = 0; i < HEADER_LUMPS; i++) {
      const lumpData = lumps.get(i as BspLump) || new Uint8Array(0);

      const padding = (4 - (cursor % 4)) % 4;
      cursor += padding;

      lumpInfos.set(i as BspLump, { offset: cursor, length: lumpData.byteLength });
      cursor += lumpData.byteLength;
    }

    // 3. Write Header and Data
    const buffer = new Uint8Array(cursor);
    const writer = new BinaryWriter(buffer); // Use existing buffer via size? No BinaryWriter takes size or buffer.
    // BinaryWriter(buffer) treats it as fixed.

    // Magic
    writer.writeByte(BSP_MAGIC.charCodeAt(0));
    writer.writeByte(BSP_MAGIC.charCodeAt(1));
    writer.writeByte(BSP_MAGIC.charCodeAt(2));
    writer.writeByte(BSP_MAGIC.charCodeAt(3));

    // Version
    writer.writeLong(BSP_VERSION);

    // Lump Infos
    for (let i = 0; i < HEADER_LUMPS; i++) {
      const info = lumpInfos.get(i as BspLump)!;
      writer.writeLong(info.offset);
      writer.writeLong(info.length);
    }

    // Write Lump Data
    for (let i = 0; i < HEADER_LUMPS; i++) {
      const info = lumpInfos.get(i as BspLump)!;
      const data = lumps.get(i as BspLump)!;

      // Pad if needed (writer tracks offset)
      while (writer.getOffset() < info.offset) {
        writer.writeByte(0);
      }

      writer.writeBytes(data);
    }

    return buffer;
  }

  private static writeVec3(writer: BinaryWriter, v: Vec3) {
    writer.writeFloat(v.x);
    writer.writeFloat(v.y);
    writer.writeFloat(v.z);
  }

  private static encodePlanes(planes: readonly BspPlane[]): Uint8Array {
    const writer = new BinaryWriter(planes.length * 20);
    for (const p of planes) {
      BspWriter.writeVec3(writer, p.normal);
      writer.writeFloat(p.dist);
      writer.writeLong(p.type);
    }
    return writer.getData();
  }

  private static encodeVertices(vertices: readonly Vec3[]): Uint8Array {
    const writer = new BinaryWriter(vertices.length * 12);
    for (const v of vertices) {
      BspWriter.writeVec3(writer, v);
    }
    return writer.getData();
  }

  private static encodeNodes(nodes: readonly BspNode[]): Uint8Array {
    const writer = new BinaryWriter(nodes.length * 28);
    for (const n of nodes) {
      writer.writeLong(n.planeIndex);
      writer.writeLong(n.children[0]);
      writer.writeLong(n.children[1]);
      writer.writeShort(n.mins[0]);
      writer.writeShort(n.mins[1]);
      writer.writeShort(n.mins[2]);
      writer.writeShort(n.maxs[0]);
      writer.writeShort(n.maxs[1]);
      writer.writeShort(n.maxs[2]);
      // unsigned short for face counts
      const view = new DataView(new ArrayBuffer(4));
      view.setUint16(0, n.firstFace, true);
      view.setUint16(2, n.numFaces, true);
      writer.writeBytes(new Uint8Array(view.buffer));
    }
    return writer.getData();
  }

  private static encodeTexInfo(texInfos: readonly BspTexInfo[]): Uint8Array {
    const writer = new BinaryWriter(texInfos.length * 76);
    for (const ti of texInfos) {
      BspWriter.writeVec3(writer, ti.s);
      writer.writeFloat(ti.sOffset);
      BspWriter.writeVec3(writer, ti.t);
      writer.writeFloat(ti.tOffset);
      writer.writeLong(ti.flags);
      writer.writeLong(ti.value);

      // Texture name (32 bytes)
      const nameBuf = new Uint8Array(32);
      const nameBytes = new TextEncoder().encode(ti.texture);
      nameBuf.set(nameBytes.slice(0, 31)); // Ensure null term if exactly 32
      writer.writeBytes(nameBuf);

      writer.writeLong(ti.nextTexInfo);
    }
    return writer.getData();
  }

  private static encodeFaces(faces: readonly BspFace[]): Uint8Array {
    const writer = new BinaryWriter(faces.length * 20);
    for (const f of faces) {
      // Uint16 plane index
      const pView = new DataView(new ArrayBuffer(2));
      pView.setUint16(0, f.planeIndex, true);
      writer.writeBytes(new Uint8Array(pView.buffer));

      writer.writeShort(f.side);
      writer.writeLong(f.firstEdge);
      writer.writeShort(f.numEdges);
      writer.writeShort(f.texInfo);

      // Styles (4 bytes)
      for (let i = 0; i < 4; i++) {
        writer.writeByte(f.styles[i]);
      }

      writer.writeLong(f.lightOffset);
    }
    return writer.getData();
  }

  private static encodeLeafsAndLists(
    leafs: readonly BspLeaf[],
    lists: { leafFaces: readonly number[][]; leafBrushes: readonly number[][] }
  ): { leafBuffer: Uint8Array; leafFacesBuffer: Uint8Array; leafBrushesBuffer: Uint8Array } {
    const leafWriter = new BinaryWriter(leafs.length * 28);

    // We need to flatten lists and update offsets
    const allFaces: number[] = [];
    const allBrushes: number[] = [];

    // Temporary storage for leaf data to write later
    const packedLeafs = leafs.map((leaf, i) => {
      const faces = lists.leafFaces[i] || [];
      const brushes = lists.leafBrushes[i] || [];

      const firstLeafFace = allFaces.length;
      allFaces.push(...faces);
      const numLeafFaces = faces.length;

      const firstLeafBrush = allBrushes.length;
      allBrushes.push(...brushes);
      const numLeafBrushes = brushes.length;

      return {
        ...leaf,
        firstLeafFace,
        numLeafFaces,
        firstLeafBrush,
        numLeafBrushes
      };
    });

    // Write Leafs
    for (const l of packedLeafs) {
      leafWriter.writeLong(l.contents);
      leafWriter.writeShort(l.cluster);
      leafWriter.writeShort(l.area);
      leafWriter.writeShort(l.mins[0]);
      leafWriter.writeShort(l.mins[1]);
      leafWriter.writeShort(l.mins[2]);
      leafWriter.writeShort(l.maxs[0]);
      leafWriter.writeShort(l.maxs[1]);
      leafWriter.writeShort(l.maxs[2]);

      const view = new DataView(new ArrayBuffer(8));
      view.setUint16(0, l.firstLeafFace, true);
      view.setUint16(2, l.numLeafFaces, true);
      view.setUint16(4, l.firstLeafBrush, true);
      view.setUint16(6, l.numLeafBrushes, true);
      leafWriter.writeBytes(new Uint8Array(view.buffer));
    }

    // Write Lists
    const faceWriter = new BinaryWriter(allFaces.length * 2);
    for (const f of allFaces) {
      const view = new DataView(new ArrayBuffer(2));
      view.setUint16(0, f, true);
      faceWriter.writeBytes(new Uint8Array(view.buffer));
    }

    const brushWriter = new BinaryWriter(allBrushes.length * 2);
    for (const b of allBrushes) {
      const view = new DataView(new ArrayBuffer(2));
      view.setUint16(0, b, true);
      brushWriter.writeBytes(new Uint8Array(view.buffer));
    }

    return {
      leafBuffer: leafWriter.getData(),
      leafFacesBuffer: faceWriter.getData(),
      leafBrushesBuffer: brushWriter.getData()
    };
  }

  private static encodeEdges(edges: readonly { vertices: [number, number] }[]): Uint8Array {
    const writer = new BinaryWriter(edges.length * 4);
    for (const e of edges) {
      const view = new DataView(new ArrayBuffer(4));
      view.setUint16(0, e.vertices[0], true);
      view.setUint16(2, e.vertices[1], true);
      writer.writeBytes(new Uint8Array(view.buffer));
    }
    return writer.getData();
  }

  private static encodeModels(models: readonly BspModel[]): Uint8Array {
    const writer = new BinaryWriter(models.length * 48);
    for (const m of models) {
      BspWriter.writeVec3(writer, m.mins);
      BspWriter.writeVec3(writer, m.maxs);
      BspWriter.writeVec3(writer, m.origin);
      writer.writeLong(m.headNode);
      writer.writeLong(m.firstFace);
      writer.writeLong(m.numFaces);
    }
    return writer.getData();
  }

  private static encodeBrushes(brushes: readonly BspBrush[]): Uint8Array {
    const writer = new BinaryWriter(brushes.length * 12);
    for (const b of brushes) {
      writer.writeLong(b.firstSide);
      writer.writeLong(b.numSides);
      writer.writeLong(b.contents);
    }
    return writer.getData();
  }

  private static encodeBrushSides(sides: readonly BspBrushSide[]): Uint8Array {
    const writer = new BinaryWriter(sides.length * 4);
    for (const s of sides) {
      const view = new DataView(new ArrayBuffer(4));
      view.setUint16(0, s.planeIndex, true);
      view.setInt16(2, s.texInfo, true);
      writer.writeBytes(new Uint8Array(view.buffer));
    }
    return writer.getData();
  }

  private static encodeAreas(areas: readonly BspArea[]): Uint8Array {
    const writer = new BinaryWriter(areas.length * 8);
    for (const a of areas) {
      writer.writeLong(a.numAreaPortals);
      writer.writeLong(a.firstAreaPortal);
    }
    return writer.getData();
  }

  private static encodeAreaPortals(portals: readonly BspAreaPortal[]): Uint8Array {
    const writer = new BinaryWriter(portals.length * 8);
    for (const p of portals) {
      writer.writeLong(p.portalNumber);
      writer.writeLong(p.otherArea);
    }
    return writer.getData();
  }

  private static encodeVisibility(vis: BspVisibility | undefined): Uint8Array {
    if (!vis || vis.numClusters === 0) return new Uint8Array(0);

    const headerSize = 4 + vis.numClusters * 8;

    const payloads: Uint8Array[] = [];

    for (const cluster of vis.clusters) {
      payloads.push(BspWriter.compressVisRow(cluster.pvs));
      payloads.push(BspWriter.compressVisRow(cluster.phs));
    }

    const totalPayloadSize = payloads.reduce((sum, p) => sum + p.byteLength, 0);
    const writer = new BinaryWriter(headerSize + totalPayloadSize);

    writer.writeLong(vis.numClusters);

    let currentOffset = headerSize;
    for (let i = 0; i < vis.numClusters; i++) {
      const pvs = payloads[i * 2];
      const phs = payloads[i * 2 + 1];

      writer.writeLong(currentOffset);
      currentOffset += pvs.byteLength;

      writer.writeLong(currentOffset);
      currentOffset += phs.byteLength;
    }

    for (const p of payloads) {
      writer.writeBytes(p);
    }

    return writer.getData();
  }

  private static compressVisRow(data: Uint8Array): Uint8Array {
    const output = new BinaryWriter(data.byteLength * 2);

    let i = 0;
    while (i < data.length) {
      if (data[i] !== 0) {
        output.writeByte(data[i]);
        i++;
      } else {
        let run = 0;
        // Count zeros
        while (i < data.length && data[i] === 0 && run < 255) {
          run++;
          i++;
        }
        output.writeByte(0);
        output.writeByte(run);
      }
    }

    return output.getData();
  }
}
