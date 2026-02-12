import {
  BspWriter,
  BspData,
  BspHeader,
  BspLump,
  BspPlane as TBspPlane,
  BspNode as TBspNode,
  BspLeaf as TBspLeaf,
  BspTexInfo as TBspTexInfo,
  BspFace as TBspFace,
  BspModel as TBspModel,
  BspBrush as TBspBrush,
  BspBrushSide as TBspBrushSide,
  BspEdge as TBspEdge,
  BspArea as TBspArea,
  BspAreaPortal as TBspAreaPortal,
  BSP_VERSION
} from '@quake2ts/bsp-tools';
import type { Vec3 } from '@quake2ts/shared';

// Local types matching what tests use (Arrays for vectors)
type ArrayVec3 = [number, number, number] | number[] | Vec3;

function toVec3(v: ArrayVec3): Vec3 {
  if (Array.isArray(v)) {
    return { x: v[0], y: v[1], z: v[2] };
  }
  // Assume it's already Vec3 object if not array, but check if it lacks x/y/z
  if (typeof (v as any).x === 'number') return v as Vec3;
  // Fallback for array-like objects
  return { x: (v as any)[0], y: (v as any)[1], z: (v as any)[2] };
}

// Re-export options interface but with looser types compatible with existing tests
export interface BspFixtureOptions {
  readonly entities?: string;
  readonly planes?: any[]; // BspPlane with ArrayVec3
  readonly vertices?: ArrayVec3[];
  readonly nodes?: any[];
  readonly texInfo?: any[];
  readonly faces?: any[];
  readonly lighting?: Uint8Array;
  readonly leafs?: any[];
  readonly leafFaces?: Uint16Array;
  readonly leafBrushes?: Uint16Array;
  readonly edges?: Array<[number, number]>;
  readonly surfEdges?: Int32Array;
  readonly models?: any[];
  readonly brushes?: any[];
  readonly brushSides?: any[];
  readonly visibility?: Uint8Array;
  readonly areas?: Uint8Array;
  readonly areaPortals?: Uint8Array;
}

/** @deprecated Use BspBuilder from @quake2ts/bsp-tools */
export function buildTestBsp(options: BspFixtureOptions): ArrayBuffer {
  // console.warn('buildTestBsp is deprecated, use BspBuilder from @quake2ts/bsp-tools');

  // Convert options to BspData

  const planes: TBspPlane[] = (options.planes || []).map(p => ({
    normal: toVec3(p.normal),
    dist: p.dist,
    type: p.type
  }));

  const vertices: Vec3[] = (options.vertices || []).map(toVec3);

  const nodes: TBspNode[] = (options.nodes || []).map(n => ({
    planeIndex: n.planeIndex,
    children: n.children,
    mins: n.mins, // assume [x,y,z] tuple
    maxs: n.maxs,
    firstFace: n.firstFace,
    numFaces: n.numFaces
  }));

  const texInfo: TBspTexInfo[] = (options.texInfo || []).map(t => ({
    s: toVec3(t.s),
    sOffset: t.sOffset,
    t: toVec3(t.t),
    tOffset: t.tOffset,
    flags: t.flags,
    value: t.value,
    texture: t.texture,
    nextTexInfo: t.nextTexInfo
  }));

  const faces: TBspFace[] = (options.faces || []).map(f => ({
    planeIndex: f.planeIndex,
    side: f.side,
    firstEdge: f.firstEdge,
    numEdges: f.numEdges,
    texInfo: f.texInfo,
    styles: f.styles,
    lightOffset: f.lightOffset
  }));

  // Reconstruct leaf lists
  const leafFacesList: number[][] = [];
  const leafBrushesList: number[][] = [];

  const leafs: TBspLeaf[] = (options.leafs || []).map(l => {
    // Extract faces
    const faces: number[] = [];
    if (options.leafFaces && l.numLeafFaces > 0) {
      for (let i = 0; i < l.numLeafFaces; i++) {
        faces.push(options.leafFaces[l.firstLeafFace + i]);
      }
    }
    leafFacesList.push(faces);

    // Extract brushes
    const brushes: number[] = [];
    if (options.leafBrushes && l.numLeafBrushes > 0) {
      for (let i = 0; i < l.numLeafBrushes; i++) {
        brushes.push(options.leafBrushes[l.firstLeafBrush + i]);
      }
    }
    leafBrushesList.push(brushes);

    return {
      contents: l.contents,
      cluster: l.cluster,
      area: l.area,
      mins: l.mins,
      maxs: l.maxs,
      firstLeafFace: 0, // Ignored by writer (recalculated)
      numLeafFaces: 0,
      firstLeafBrush: 0,
      numLeafBrushes: 0
    };
  });

  const models: TBspModel[] = (options.models || []).map(m => ({
    mins: toVec3(m.mins),
    maxs: toVec3(m.maxs),
    origin: toVec3(m.origin),
    headNode: m.headNode,
    firstFace: m.firstFace,
    numFaces: m.numFaces
  }));

  const brushes: TBspBrush[] = (options.brushes || []).map(b => ({
    firstSide: b.firstSide,
    numSides: b.numSides,
    contents: b.contents
  }));

  const brushSides: TBspBrushSide[] = (options.brushSides || []).map(s => ({
    planeIndex: s.planeIndex,
    texInfo: s.texInfo
  }));

  const edges: TBspEdge[] = (options.edges || []).map(e => ({
    vertices: e
  }));

  const rawLumps = new Map<number, Uint8Array>();
  if (options.visibility) {
    rawLumps.set(BspLump.Visibility, options.visibility);
  }
  if (options.areas) {
    rawLumps.set(BspLump.Areas, options.areas);
  }
  if (options.areaPortals) {
    rawLumps.set(BspLump.AreaPortals, options.areaPortals);
  }

  const bspData: BspData = {
    header: { version: BSP_VERSION, lumps: new Map() },
    entities: { raw: options.entities || '{"classname" "worldspawn"}\n' },
    planes,
    vertices,
    nodes,
    texInfo,
    faces,
    lightMaps: options.lighting || new Uint8Array(0),
    lightMapInfo: [],
    leafs,
    leafLists: { leafFaces: leafFacesList, leafBrushes: leafBrushesList },
    edges,
    surfEdges: options.surfEdges || new Int32Array(0),
    models,
    brushes,
    brushSides,
    visibility: undefined,
    areas: [],
    areaPortals: [],
    rawLumps
  };

  return BspWriter.write(bspData).buffer as ArrayBuffer;
}

export function runLengthVisRow(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

export function encodedVisForClusters(numClusters: number, rows: number[][]): Uint8Array {
  const encodedRows = rows.map((row) => new Uint8Array(row));

  const headerBytes = 4 + numClusters * 8;
  const header = new DataView(new ArrayBuffer(headerBytes));
  header.setInt32(0, numClusters, true);
  let cursor = headerBytes;
  const payloads: Uint8Array[] = [];

  for (let i = 0; i < numClusters; i += 1) {
    const pvs = encodedRows[i];
    const phs = pvs; // assume same
    const pvsOffset = cursor;
    const phsOffset = cursor + pvs.byteLength;
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
