import { BspBrush, BspBrushSide, BspFace, BspLeaf, BspLump, BspModel, BspNode, BspPlane, BspTexInfo, Vec3 } from '../../src/assets/bsp.js';

const HEADER_LUMPS = 19;
const HEADER_SIZE = 4 + 4 + HEADER_LUMPS * 8;

function allocBuffer(size: number): DataView {
  return new DataView(new ArrayBuffer(size));
}

function writeVec3(view: DataView, offset: number, vec: Vec3): void {
  view.setFloat32(offset, vec[0], true);
  view.setFloat32(offset + 4, vec[1], true);
  view.setFloat32(offset + 8, vec[2], true);
}

function encodePlanes(planes: BspPlane[]): Uint8Array {
  const view = allocBuffer(planes.length * 20);
  planes.forEach((plane, index) => {
    const base = index * 20;
    writeVec3(view, base, plane.normal);
    view.setFloat32(base + 12, plane.dist, true);
    view.setInt32(base + 16, plane.type, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeVertices(vertices: Vec3[]): Uint8Array {
  const view = allocBuffer(vertices.length * 12);
  vertices.forEach((vertex, index) => writeVec3(view, index * 12, vertex));
  return new Uint8Array(view.buffer);
}

function encodeNodes(nodes: BspNode[]): Uint8Array {
  const view = allocBuffer(nodes.length * 36);
  nodes.forEach((node, index) => {
    const base = index * 36;
    view.setInt32(base, node.planeIndex, true);
    view.setInt32(base + 4, node.children[0], true);
    view.setInt32(base + 8, node.children[1], true);
    view.setInt16(base + 12, node.mins[0], true);
    view.setInt16(base + 14, node.mins[1], true);
    view.setInt16(base + 16, node.mins[2], true);
    view.setInt16(base + 18, node.maxs[0], true);
    view.setInt16(base + 20, node.maxs[1], true);
    view.setInt16(base + 22, node.maxs[2], true);
    view.setUint16(base + 24, node.firstFace, true);
    view.setUint16(base + 26, node.numFaces, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeTexInfo(texInfos: BspTexInfo[]): Uint8Array {
  const view = allocBuffer(texInfos.length * 76);
  texInfos.forEach((tex, index) => {
    const base = index * 76;
    writeVec3(view, base, tex.s);
    view.setFloat32(base + 12, tex.sOffset, true);
    writeVec3(view, base + 16, tex.t);
    view.setFloat32(base + 28, tex.tOffset, true);
    view.setInt32(base + 32, tex.flags, true);
    view.setInt32(base + 36, tex.value, true);
    const textureBytes = new TextEncoder().encode(tex.texture);
    new Uint8Array(view.buffer).set(textureBytes.slice(0, 32), base + 40);
    view.setInt32(base + 72, tex.nextTexInfo, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeFaces(faces: BspFace[]): Uint8Array {
  const view = allocBuffer(faces.length * 20);
  faces.forEach((face, index) => {
    const base = index * 20;
    view.setUint16(base, face.planeIndex, true);
    view.setInt16(base + 2, face.side, true);
    view.setInt32(base + 4, face.firstEdge, true);
    view.setInt16(base + 8, face.numEdges, true);
    view.setInt16(base + 10, face.texInfo, true);
    face.styles.forEach((style, sIndex) => view.setUint8(base + 12 + sIndex, style));
    view.setInt32(base + 16, face.lightOffset, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeLeafs(leafs: BspLeaf[]): Uint8Array {
  const view = allocBuffer(leafs.length * 28);
  leafs.forEach((leaf, index) => {
    const base = index * 28;
    view.setInt32(base, leaf.contents, true);
    view.setInt16(base + 4, leaf.cluster, true);
    view.setInt16(base + 6, leaf.area, true);
    view.setInt16(base + 8, leaf.mins[0], true);
    view.setInt16(base + 10, leaf.mins[1], true);
    view.setInt16(base + 12, leaf.mins[2], true);
    view.setInt16(base + 14, leaf.maxs[0], true);
    view.setInt16(base + 16, leaf.maxs[1], true);
    view.setInt16(base + 18, leaf.maxs[2], true);
    view.setUint16(base + 20, leaf.firstLeafFace, true);
    view.setUint16(base + 22, leaf.numLeafFaces, true);
    view.setUint16(base + 24, leaf.firstLeafBrush, true);
    view.setUint16(base + 26, leaf.numLeafBrushes, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeEdges(edges: Array<[number, number]>): Uint8Array {
  const view = allocBuffer(edges.length * 4);
  edges.forEach((edge, index) => {
    const base = index * 4;
    view.setUint16(base, edge[0], true);
    view.setUint16(base + 2, edge[1], true);
  });
  return new Uint8Array(view.buffer);
}

function encodeModels(models: BspModel[]): Uint8Array {
  const view = allocBuffer(models.length * 64);
  models.forEach((model, index) => {
    const base = index * 64;
    writeVec3(view, base, model.mins);
    writeVec3(view, base + 12, model.maxs);
    writeVec3(view, base + 24, model.origin);
    view.setInt32(base + 36, model.headNode, true);
    view.setInt32(base + 40, model.firstFace, true);
    view.setInt32(base + 44, model.numFaces, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeBrushes(brushes: BspBrush[]): Uint8Array {
  const view = allocBuffer(brushes.length * 12);
  brushes.forEach((brush, index) => {
    const base = index * 12;
    view.setInt32(base, brush.firstSide, true);
    view.setInt32(base + 4, brush.numSides, true);
    view.setInt32(base + 8, brush.contents, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeBrushSides(sides: BspBrushSide[]): Uint8Array {
  const view = allocBuffer(sides.length * 8);
  sides.forEach((side, index) => {
    const base = index * 8;
    view.setUint16(base, side.planeIndex, true);
    view.setInt16(base + 2, side.texInfo, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeAreas(areas: { numAreaPortals: number; firstAreaPortal: number }[]): Uint8Array {
  const view = allocBuffer(areas.length * 8);
  areas.forEach((area, index) => {
    const base = index * 8;
    view.setInt32(base, area.numAreaPortals, true);
    view.setInt32(base + 4, area.firstAreaPortal, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeAreaPortals(portals: { portalNumber: number; otherArea: number }[]): Uint8Array {
  const view = allocBuffer(portals.length * 8);
  portals.forEach((portal, index) => {
    const base = index * 8;
    view.setInt32(base, portal.portalNumber, true);
    view.setInt32(base + 4, portal.otherArea, true);
  });
  return new Uint8Array(view.buffer);
}

function encodeVisibility(numClusters: number, pvsRows: Uint8Array[], phsRows?: Uint8Array[]): Uint8Array {
  const headerBytes = 4 + numClusters * 8;
  const header = allocBuffer(headerBytes);
  header.setInt32(0, numClusters, true);
  let cursor = headerBytes;
  const payloads: Uint8Array[] = [];

  for (let i = 0; i < numClusters; i += 1) {
    const pvs = pvsRows[i];
    const phs = phsRows?.[i] ?? pvs;
    const pvsOffset = cursor - 0;
    const phsOffset = cursor + pvs.byteLength - 0;
    payloads.push(pvs, phs);
    header.setInt32(4 + i * 8, pvsOffset, true);
    header.setInt32(8 + i * 8, phsOffset, true);
    cursor += pvs.byteLength + phs.byteLength;
  }

  const result = new Uint8Array(cursor);
  result.set(new Uint8Array(header.buffer), 0);
  let payloadCursor = headerBytes;
  for (const payload of payloads) {
    result.set(payload, payloadCursor);
    payloadCursor += payload.byteLength;
  }
  return result;
}

export interface BspFixtureOptions {
  readonly entities?: string;
  readonly planes?: BspPlane[];
  readonly vertices?: Vec3[];
  readonly nodes?: BspNode[];
  readonly texInfo?: BspTexInfo[];
  readonly faces?: BspFace[];
  readonly lighting?: Uint8Array;
  readonly leafs?: BspLeaf[];
  readonly leafFaces?: Uint16Array;
  readonly leafBrushes?: Uint16Array;
  readonly edges?: Array<[number, number]>;
  readonly surfEdges?: Int32Array;
  readonly models?: BspModel[];
  readonly brushes?: BspBrush[];
  readonly brushSides?: BspBrushSide[];
  readonly visibility?: Uint8Array;
  readonly areas?: Uint8Array;
  readonly areaPortals?: Uint8Array;
}

export function buildTestBsp(options: BspFixtureOptions): ArrayBuffer {
  const lumps: Record<number, Uint8Array> = {};
  lumps[BspLump.Entities] = new TextEncoder().encode(options.entities ?? '{"classname" "worldspawn"}\n');
  lumps[BspLump.Planes] = options.planes ? encodePlanes(options.planes) : new Uint8Array();
  lumps[BspLump.Vertices] = options.vertices ? encodeVertices(options.vertices) : new Uint8Array();
  lumps[BspLump.Visibility] = options.visibility ?? new Uint8Array();
  lumps[BspLump.Nodes] = options.nodes ? encodeNodes(options.nodes) : new Uint8Array();
  lumps[BspLump.TexInfo] = options.texInfo ? encodeTexInfo(options.texInfo) : new Uint8Array();
  lumps[BspLump.Faces] = options.faces ? encodeFaces(options.faces) : new Uint8Array();
  lumps[BspLump.Lighting] = options.lighting ?? new Uint8Array();
  lumps[BspLump.Leafs] = options.leafs ? encodeLeafs(options.leafs) : new Uint8Array();
  lumps[BspLump.LeafFaces] = options.leafFaces ? new Uint8Array(options.leafFaces.buffer) : new Uint8Array();
  lumps[BspLump.LeafBrushes] = options.leafBrushes ? new Uint8Array(options.leafBrushes.buffer) : new Uint8Array();
  lumps[BspLump.Edges] = options.edges ? encodeEdges(options.edges) : new Uint8Array();
  lumps[BspLump.SurfEdges] = options.surfEdges ? new Uint8Array(options.surfEdges.buffer) : new Uint8Array();
  lumps[BspLump.Models] = options.models ? encodeModels(options.models) : new Uint8Array();
  lumps[BspLump.Brushes] = options.brushes ? encodeBrushes(options.brushes) : new Uint8Array();
  lumps[BspLump.BrushSides] = options.brushSides ? encodeBrushSides(options.brushSides) : new Uint8Array();
  lumps[BspLump.Areas] = options.areas ?? new Uint8Array();
  lumps[BspLump.AreaPortals] = options.areaPortals ?? new Uint8Array();

  let cursor = HEADER_SIZE;
  const ordered: { info: { offset: number; length: number }; data: Uint8Array }[] = [];
  for (let i = 0; i < HEADER_LUMPS; i += 1) {
    const data = lumps[i] ?? new Uint8Array();
    const info = { offset: cursor, length: data.byteLength };
    ordered.push({ info, data });
    cursor += data.byteLength;
  }

  const buffer = new ArrayBuffer(cursor);
  const header = new DataView(buffer);
  header.setUint8(0, 0x49); // I
  header.setUint8(1, 0x42); // B
  header.setUint8(2, 0x53); // S
  header.setUint8(3, 0x50); // P
  header.setInt32(4, 38, true);

  ordered.forEach((entry, index) => {
    header.setInt32(8 + index * 8, entry.info.offset, true);
    header.setInt32(12 + index * 8, entry.info.length, true);
  });

  const body = new Uint8Array(buffer);
  ordered.forEach((entry) => body.set(entry.data, entry.info.offset));
  return buffer;
}

export function runLengthVisRow(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

export function encodedVisForClusters(numClusters: number, rows: number[][]): Uint8Array {
  const rowBytes = Math.ceil(numClusters / 8);
  const encodedRows = rows.map((row) => new Uint8Array(row));
  return encodeVisibility(numClusters, encodedRows);
}
