// BSP loader for Quake II (version 38)
// Parses lumps, decompresses visibility (PVS), and exposes derived structures for rendering and collision.

import { VirtualFileSystem } from './vfs.js';

const BSP_MAGIC = 'IBSP';
const BSP_VERSION = 38;
const HEADER_LUMPS = 19;
const HEADER_SIZE = 4 + 4 + HEADER_LUMPS * 8; // magic + version + lump infos

export type Vec3 = [number, number, number];

export interface BspLumpInfo {
  readonly offset: number;
  readonly length: number;
}

export interface BspHeader {
  readonly version: number;
  readonly lumps: ReadonlyMap<BspLump, BspLumpInfo>;
}

export interface BspEntities {
  readonly raw: string;
  readonly entities: BspEntity[];
  readonly worldspawn: BspEntity | undefined;
  /**
   * Returns a sorted array of unique entity classnames present in the map.
   */
  getUniqueClassnames(): string[];
}

export interface BspEntity {
  readonly classname?: string;
  readonly properties: Record<string, string>;
}

export interface BspPlane {
  readonly normal: Vec3;
  readonly dist: number;
  readonly type: number;
}

export interface BspNode {
  readonly planeIndex: number;
  readonly children: [number, number];
  readonly mins: [number, number, number];
  readonly maxs: [number, number, number];
  readonly firstFace: number;
  readonly numFaces: number;
}

export interface BspLeaf {
  readonly contents: number;
  readonly cluster: number;
  readonly area: number;
  readonly mins: [number, number, number];
  readonly maxs: [number, number, number];
  readonly firstLeafFace: number;
  readonly numLeafFaces: number;
  readonly firstLeafBrush: number;
  readonly numLeafBrushes: number;
}

export interface BspTexInfo {
  readonly s: Vec3;
  readonly sOffset: number;
  readonly t: Vec3;
  readonly tOffset: number;
  readonly flags: number;
  readonly value: number;
  readonly texture: string;
  readonly nextTexInfo: number;
}

export interface BspFace {
  readonly planeIndex: number;
  readonly side: number;
  readonly firstEdge: number;
  readonly numEdges: number;
  readonly texInfo: number;
  readonly styles: [number, number, number, number];
  readonly lightOffset: number;
}

export interface BspEdge {
  readonly vertices: [number, number];
}

export interface BspModel {
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly origin: Vec3;
  readonly headNode: number;
  readonly firstFace: number;
  readonly numFaces: number;
}

export interface BspBrush {
  readonly firstSide: number;
  readonly numSides: number;
  readonly contents: number;
}

export interface BspBrushSide {
  readonly planeIndex: number;
  readonly texInfo: number;
}

export interface BspArea {
  readonly numAreaPortals: number;
  readonly firstAreaPortal: number;
}

export interface BspAreaPortal {
  readonly portalNumber: number;
  readonly otherArea: number;
}

export interface BspVisibilityCluster {
  readonly pvs: Uint8Array;
  readonly phs: Uint8Array;
}

export interface BspVisibility {
  readonly numClusters: number;
  readonly clusters: readonly BspVisibilityCluster[];
}

export interface BspLightmapInfo {
  readonly offset: number;
  readonly length: number;
}

export interface BspLeafLists {
  readonly leafFaces: readonly number[][];
  readonly leafBrushes: readonly number[][];
}

export interface BspMap {
  readonly header: BspHeader;
  readonly entities: BspEntities;
  readonly planes: readonly BspPlane[];
  readonly vertices: readonly Vec3[];
  readonly nodes: readonly BspNode[];
  readonly texInfo: readonly BspTexInfo[];
  readonly faces: readonly BspFace[];
  readonly lightMaps: Uint8Array;
  readonly lightMapInfo: readonly (BspLightmapInfo | undefined)[];
  readonly leafs: readonly BspLeaf[];
  readonly leafLists: BspLeafLists;
  readonly edges: readonly BspEdge[];
  readonly surfEdges: Int32Array;
  readonly models: readonly BspModel[];
  readonly brushes: readonly BspBrush[];
  readonly brushSides: readonly BspBrushSide[];
  readonly visibility: BspVisibility | undefined;

  /**
   * Finds the closest brush-based entity that intersects with the given ray.
   * @param ray An object defining the origin and direction of the ray.
   * @returns An object containing the intersected entity, its model, and the
   *          distance from the ray's origin, or null if no intersection occurs.
   */
  pickEntity(ray: { origin: Vec3; direction: Vec3 }): {
    entity: BspEntity;
    model: BspModel;
    distance: number;
  } | null;
}

export enum BspLump {
  Entities = 0,
  Planes = 1,
  Vertices = 2,
  Visibility = 3,
  Nodes = 4,
  TexInfo = 5,
  Faces = 6,
  Lighting = 7,
  Leafs = 8,
  LeafFaces = 9,
  LeafBrushes = 10,
  Edges = 11,
  SurfEdges = 12,
  Models = 13,
  Brushes = 14,
  BrushSides = 15,
  Pop = 16,
  Areas = 17,
  AreaPortals = 18,
}

export class BspParseError extends Error {}

export class BspLoader {
  constructor(private readonly vfs: VirtualFileSystem) {}

  async load(path: string): Promise<BspMap> {
    const buffer = await this.vfs.readFile(path);
    const copy = new Uint8Array(buffer.byteLength);
    copy.set(buffer);
    return parseBsp(copy.buffer);
  }
}

export function parseBsp(buffer: ArrayBuffer): BspMap {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new BspParseError('BSP too small to contain header');
  }

  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== BSP_MAGIC) {
    throw new BspParseError(`Invalid BSP magic ${magic}`);
  }
  const version = view.getInt32(4, true);
  if (version !== BSP_VERSION) {
    throw new BspParseError(`Unsupported BSP version ${version}`);
  }

  const lumps = new Map<BspLump, BspLumpInfo>();
  for (let i = 0; i < HEADER_LUMPS; i += 1) {
    const offset = view.getInt32(8 + i * 8, true);
    const length = view.getInt32(12 + i * 8, true);
    if (offset < 0 || length < 0 || offset + length > buffer.byteLength) {
      throw new BspParseError(`Invalid lump bounds for index ${i}`);
    }
    lumps.set(i as BspLump, { offset, length });
  }

  const header: BspHeader = { version, lumps };
  const entities = parseEntities(buffer, lumps.get(BspLump.Entities)!);
  const planes = parsePlanes(buffer, lumps.get(BspLump.Planes)!);
  const vertices = parseVertices(buffer, lumps.get(BspLump.Vertices)!);
  const nodes = parseNodes(buffer, lumps.get(BspLump.Nodes)!);
  const texInfo = parseTexInfo(buffer, lumps.get(BspLump.TexInfo)!);
  const faces = parseFaces(buffer, lumps.get(BspLump.Faces)!);
  const lightMaps = new Uint8Array(buffer, lumps.get(BspLump.Lighting)!.offset, lumps.get(BspLump.Lighting)!.length);
  const lightMapInfo = buildLightMapInfo(faces, lumps.get(BspLump.Lighting)!);
  const leafs = parseLeafs(buffer, lumps.get(BspLump.Leafs)!);
  const edges = parseEdges(buffer, lumps.get(BspLump.Edges)!);
  const surfEdges = parseSurfEdges(buffer, lumps.get(BspLump.SurfEdges)!);
  const models = parseModels(buffer, lumps.get(BspLump.Models)!);
  const brushes = parseBrushes(buffer, lumps.get(BspLump.Brushes)!);
  const brushSides = parseBrushSides(buffer, lumps.get(BspLump.BrushSides)!);
  const leafLists = parseLeafLists(buffer, lumps.get(BspLump.LeafFaces)!, lumps.get(BspLump.LeafBrushes)!, leafs);
  const visibility = parseVisibility(buffer, lumps.get(BspLump.Visibility)!);

  const map: BspMap = {
    header,
    entities,
    planes,
    vertices,
    nodes,
    texInfo,
    faces,
    lightMaps,
    lightMapInfo,
    leafs,
    leafLists,
    edges,
    surfEdges,
    models,
    brushes,
    brushSides,
    visibility,
    pickEntity(ray) {
      let closest: { entity: BspEntity; model: BspModel; distance: number } | null = null;
      let minDistance = Infinity;

      for (const entity of entities.entities) {
        const modelKey = entity.properties['model'];
        if (!modelKey || !modelKey.startsWith('*')) {
          continue;
        }

        const modelIndex = parseInt(modelKey.substring(1), 10);
        if (isNaN(modelIndex) || modelIndex < 0 || modelIndex >= models.length) {
          continue;
        }

        const model = models[modelIndex];
        const dist = intersectRayAabb(ray.origin, ray.direction, model.mins, model.maxs);

        if (dist !== null && dist < minDistance) {
          minDistance = dist;
          closest = { entity, model, distance: dist };
        }
      }

      return closest;
    },
  };

  return map;
}

function intersectRayAabb(origin: Vec3, direction: Vec3, mins: Vec3, maxs: Vec3): number | null {
  let tmin = 0;
  let tmax = Infinity;

  for (let i = 0; i < 3; i++) {
    if (Math.abs(direction[i]) < 1e-8) {
      if (origin[i] < mins[i] || origin[i] > maxs[i]) {
        return null;
      }
    } else {
      const invD = 1.0 / direction[i];
      let t0 = (mins[i] - origin[i]) * invD;
      let t1 = (maxs[i] - origin[i]) * invD;
      if (t0 > t1) {
        const temp = t0;
        t0 = t1;
        t1 = temp;
      }
      tmin = Math.max(tmin, t0);
      tmax = Math.min(tmax, t1);
      if (tmin > tmax) {
        return null;
      }
    }
  }

  return tmin;
}

function parseEntities(buffer: ArrayBuffer, info: BspLumpInfo): BspEntities {
  const raw = new TextDecoder().decode(new Uint8Array(buffer, info.offset, info.length));
  const entities = parseEntityString(raw);
  const worldspawn = entities.find((ent) => ent.classname === 'worldspawn');
  return {
    raw,
    entities,
    worldspawn,
    getUniqueClassnames() {
      const classnames = new Set<string>();
      for (const entity of entities) {
        if (entity.classname) {
          classnames.add(entity.classname);
        }
      }
      return Array.from(classnames).sort();
    },
  };
}

function parseEntityString(text: string): BspEntity[] {
  const entities: BspEntity[] = [];
  const tokenizer = /\{([^}]*)\}/gms;
  let match: RegExpExecArray | null;
  while ((match = tokenizer.exec(text)) !== null) {
    const entityText = match[1];
    const properties: Record<string, string> = {};
    const kvRegex = /"([^\"]*)"\s+"([^\"]*)"/g;
    let kv: RegExpExecArray | null;
    while ((kv = kvRegex.exec(entityText)) !== null) {
      properties[kv[1]] = kv[2];
    }
    entities.push({ classname: properties.classname, properties });
  }
  return entities;
}

function parsePlanes(buffer: ArrayBuffer, info: BspLumpInfo): BspPlane[] {
  const view = new DataView(buffer, info.offset, info.length);
  const count = info.length / 20;
  if (count % 1 !== 0) {
    throw new BspParseError('Plane lump has invalid length');
  }
  const planes: BspPlane[] = [];
  for (let i = 0; i < count; i += 1) {
    const normal: Vec3 = [view.getFloat32(i * 20, true), view.getFloat32(i * 20 + 4, true), view.getFloat32(i * 20 + 8, true)];
    const dist = view.getFloat32(i * 20 + 12, true);
    const type = view.getInt32(i * 20 + 16, true);
    planes.push({ normal, dist, type });
  }
  return planes;
}

function parseVertices(buffer: ArrayBuffer, info: BspLumpInfo): Vec3[] {
  const view = new DataView(buffer, info.offset, info.length);
  const count = info.length / 12;
  if (count % 1 !== 0) {
    throw new BspParseError('Vertex lump has invalid length');
  }
  const vertices: Vec3[] = [];
  for (let i = 0; i < count; i += 1) {
    vertices.push([
      view.getFloat32(i * 12, true),
      view.getFloat32(i * 12 + 4, true),
      view.getFloat32(i * 12 + 8, true),
    ]);
  }
  return vertices;
}

function parseNodes(buffer: ArrayBuffer, info: BspLumpInfo): BspNode[] {
  const view = new DataView(buffer, info.offset, info.length);
  const entrySize = 28;
  const count = info.length / entrySize;
  if (count % 1 !== 0) {
    throw new BspParseError('Node lump has invalid length');
  }
  const nodes: BspNode[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * entrySize;
    const planeIndex = view.getInt32(base, true);
    const children: [number, number] = [view.getInt32(base + 4, true), view.getInt32(base + 8, true)];
    const mins: [number, number, number] = [view.getInt16(base + 12, true), view.getInt16(base + 14, true), view.getInt16(base + 16, true)];
    const maxs: [number, number, number] = [view.getInt16(base + 18, true), view.getInt16(base + 20, true), view.getInt16(base + 22, true)];
    const firstFace = view.getUint16(base + 24, true);
    const numFaces = view.getUint16(base + 26, true);
    nodes.push({ planeIndex, children, mins, maxs, firstFace, numFaces });
  }
  return nodes;
}

function parseTexInfo(buffer: ArrayBuffer, info: BspLumpInfo): BspTexInfo[] {
  const view = new DataView(buffer, info.offset, info.length);
  const entrySize = 76;
  const count = info.length / entrySize;
  if (count % 1 !== 0) {
    throw new BspParseError('TexInfo lump has invalid length');
  }
  const texInfos: BspTexInfo[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * entrySize;
    const s: Vec3 = [view.getFloat32(base, true), view.getFloat32(base + 4, true), view.getFloat32(base + 8, true)];
    const sOffset = view.getFloat32(base + 12, true);
    const t: Vec3 = [view.getFloat32(base + 16, true), view.getFloat32(base + 20, true), view.getFloat32(base + 24, true)];
    const tOffset = view.getFloat32(base + 28, true);
    const flags = view.getInt32(base + 32, true);
    const value = view.getInt32(base + 36, true);
    const textureBytes = new Uint8Array(buffer, info.offset + base + 40, 32);
    const texture = new TextDecoder('utf-8').decode(textureBytes).replace(/\0.*$/, '');
    const nextTexInfo = view.getInt32(base + 72, true);
    texInfos.push({ s, sOffset, t, tOffset, flags, value, texture, nextTexInfo });
  }
  return texInfos;
}

function parseFaces(buffer: ArrayBuffer, info: BspLumpInfo): BspFace[] {
  const view = new DataView(buffer, info.offset, info.length);
  const entrySize = 20;
  const count = info.length / entrySize;
  if (count % 1 !== 0) {
    throw new BspParseError('Face lump has invalid length');
  }
  const faces: BspFace[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * entrySize;
    const planeIndex = view.getUint16(base, true);
    const side = view.getInt16(base + 2, true);
    const firstEdge = view.getInt32(base + 4, true);
    const numEdges = view.getInt16(base + 8, true);
    const texInfo = view.getInt16(base + 10, true);
    const styles: [number, number, number, number] = [
      view.getUint8(base + 12),
      view.getUint8(base + 13),
      view.getUint8(base + 14),
      view.getUint8(base + 15),
    ];
    const lightOffset = view.getInt32(base + 16, true);
    faces.push({ planeIndex, side, firstEdge, numEdges, texInfo, styles, lightOffset });
  }
  return faces;
}

function parseLeafs(buffer: ArrayBuffer, info: BspLumpInfo): BspLeaf[] {
  const view = new DataView(buffer, info.offset, info.length);
  const entrySize = 28;
  const count = info.length / entrySize;
  if (count % 1 !== 0) {
    throw new BspParseError('Leaf lump has invalid length');
  }
  const leafs: BspLeaf[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * entrySize;
    const contents = view.getInt32(base, true);
    const cluster = view.getInt16(base + 4, true);
    const area = view.getInt16(base + 6, true);
    const mins: [number, number, number] = [view.getInt16(base + 8, true), view.getInt16(base + 10, true), view.getInt16(base + 12, true)];
    const maxs: [number, number, number] = [view.getInt16(base + 14, true), view.getInt16(base + 16, true), view.getInt16(base + 18, true)];
    const firstLeafFace = view.getUint16(base + 20, true);
    const numLeafFaces = view.getUint16(base + 22, true);
    const firstLeafBrush = view.getUint16(base + 24, true);
    const numLeafBrushes = view.getUint16(base + 26, true);
    leafs.push({ contents, cluster, area, mins, maxs, firstLeafFace, numLeafFaces, firstLeafBrush, numLeafBrushes });
  }
  return leafs;
}

function parseEdges(buffer: ArrayBuffer, info: BspLumpInfo): BspEdge[] {
  const view = new DataView(buffer, info.offset, info.length);
  const entrySize = 4;
  const count = info.length / entrySize;
  if (count % 1 !== 0) {
    throw new BspParseError('Edge lump has invalid length');
  }
  const edges: BspEdge[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * entrySize;
    edges.push({ vertices: [view.getUint16(base, true), view.getUint16(base + 2, true)] });
  }
  return edges;
}

function parseSurfEdges(buffer: ArrayBuffer, info: BspLumpInfo): Int32Array {
  const count = info.length / 4;
  if (count % 1 !== 0) {
    throw new BspParseError('SurfEdge lump has invalid length');
  }
  const view = new DataView(buffer, info.offset, info.length);
  const edges = new Int32Array(count);
  for (let i = 0; i < count; i += 1) {
    edges[i] = view.getInt32(i * 4, true);
  }
  return edges;
}

function parseModels(buffer: ArrayBuffer, info: BspLumpInfo): BspModel[] {
  const view = new DataView(buffer, info.offset, info.length);
  const entrySize = 48;
  if (info.length % entrySize !== 0) {
    throw new BspParseError('Model lump has invalid length');
  }
  const count = info.length / entrySize;
  const models: BspModel[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * entrySize;
    const mins: Vec3 = [view.getFloat32(base, true), view.getFloat32(base + 4, true), view.getFloat32(base + 8, true)];
    const maxs: Vec3 = [view.getFloat32(base + 12, true), view.getFloat32(base + 16, true), view.getFloat32(base + 20, true)];
    const origin: Vec3 = [view.getFloat32(base + 24, true), view.getFloat32(base + 28, true), view.getFloat32(base + 32, true)];
    const headNode = view.getInt32(base + 36, true);
    const firstFace = view.getInt32(base + 40, true);
    const numFaces = view.getInt32(base + 44, true);
    models.push({ mins, maxs, origin, headNode, firstFace, numFaces });
  }
  return models;
}

function parseBrushes(buffer: ArrayBuffer, info: BspLumpInfo): BspBrush[] {
  const view = new DataView(buffer, info.offset, info.length);
  const entrySize = 12;
  const count = info.length / entrySize;
  if (count % 1 !== 0) {
    throw new BspParseError('Brush lump has invalid length');
  }
  const brushes: BspBrush[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * entrySize;
    brushes.push({
      firstSide: view.getInt32(base, true),
      numSides: view.getInt32(base + 4, true),
      contents: view.getInt32(base + 8, true),
    });
  }
  return brushes;
}

function parseBrushSides(buffer: ArrayBuffer, info: BspLumpInfo): BspBrushSide[] {
  const view = new DataView(buffer, info.offset, info.length);
  const entrySize = 4;
  const count = info.length / entrySize;
  if (count % 1 !== 0) {
    throw new BspParseError('Brush side lump has invalid length');
  }
  const sides: BspBrushSide[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * entrySize;
    sides.push({ planeIndex: view.getUint16(base, true), texInfo: view.getInt16(base + 2, true) });
  }
  return sides;
}

function parseLeafLists(
  buffer: ArrayBuffer,
  leafFacesInfo: BspLumpInfo,
  leafBrushesInfo: BspLumpInfo,
  leafs: readonly BspLeaf[],
): BspLeafLists {
  const leafFaces: number[][] = [];
  const leafBrushes: number[][] = [];

  const maxLeafFaceIndex = leafFacesInfo.length / 2;
  const maxLeafBrushIndex = leafBrushesInfo.length / 2;

  const faceView = new DataView(buffer, leafFacesInfo.offset, leafFacesInfo.length);
  const brushView = new DataView(buffer, leafBrushesInfo.offset, leafBrushesInfo.length);

  for (const leaf of leafs) {
    if (leaf.firstLeafFace + leaf.numLeafFaces > maxLeafFaceIndex) {
      throw new BspParseError('Leaf faces reference data past lump bounds');
    }
    if (leaf.firstLeafBrush + leaf.numLeafBrushes > maxLeafBrushIndex) {
      throw new BspParseError('Leaf brushes reference data past lump bounds');
    }
    const faces: number[] = [];
    for (let i = 0; i < leaf.numLeafFaces; i += 1) {
      faces.push(faceView.getUint16((leaf.firstLeafFace + i) * 2, true));
    }

    const brushes: number[] = [];
    for (let i = 0; i < leaf.numLeafBrushes; i += 1) {
      brushes.push(brushView.getUint16((leaf.firstLeafBrush + i) * 2, true));
    }

    leafFaces.push(faces);
    leafBrushes.push(brushes);
  }

  return { leafFaces, leafBrushes };
}

function parseVisibility(buffer: ArrayBuffer, info: BspLumpInfo): BspVisibility | undefined {
  if (info.length === 0) {
    return undefined;
  }
  if (info.length < 4) {
    throw new BspParseError('Visibility lump too small');
  }
  const view = new DataView(buffer, info.offset, info.length);
  const numClusters = view.getInt32(0, true);
  const headerBytes = 4 + numClusters * 8;
  if (numClusters < 0 || headerBytes > info.length) {
    throw new BspParseError('Visibility lump truncated');
  }
  let cursor = 4;
  const clusters: BspVisibilityCluster[] = [];
  for (let i = 0; i < numClusters; i += 1) {
    const pvsOffset = view.getInt32(cursor, true);
    const phsOffset = view.getInt32(cursor + 4, true);
    cursor += 8;
    const absolutePvs = info.offset + pvsOffset;
    const absolutePhs = info.offset + phsOffset;
    const lumpEnd = info.offset + info.length;
    if (
      pvsOffset < 0 ||
      phsOffset < 0 ||
      absolutePvs >= lumpEnd ||
      absolutePhs >= lumpEnd
    ) {
      throw new BspParseError('Visibility offsets out of range');
    }
    clusters.push({
      pvs: decompressVis(buffer, absolutePvs, numClusters, info),
      phs: decompressVis(buffer, absolutePhs, numClusters, info),
    });
  }
  return { numClusters, clusters };
}

function decompressVis(buffer: ArrayBuffer, offset: number, numClusters: number, lump: BspLumpInfo): Uint8Array {
  const rowBytes = Math.ceil(numClusters / 8);
  const result = new Uint8Array(rowBytes);
  const src = new Uint8Array(buffer);
  let srcIndex = offset;
  let destIndex = 0;
  const maxOffset = lump.offset + lump.length;
  while (destIndex < rowBytes) {
    if (srcIndex >= maxOffset) {
      throw new BspParseError('Visibility data truncated');
    }
    const value = src[srcIndex++];
    if (value !== 0) {
      result[destIndex++] = value;
      continue;
    }
    if (srcIndex >= maxOffset) {
      throw new BspParseError('Visibility run exceeds lump bounds');
    }
    const runLength = src[srcIndex++];
    for (let i = 0; i < runLength && destIndex < rowBytes; i += 1) {
      result[destIndex++] = 0;
    }
  }
  return result;
}

function buildLightMapInfo(faces: readonly BspFace[], lightingLump: BspLumpInfo): (BspLightmapInfo | undefined)[] {
  return faces.map((face) => {
    if (face.lightOffset < 0) {
      return undefined;
    }
    return {
      offset: face.lightOffset,
      length: Math.max(0, lightingLump.length - face.lightOffset),
    };
  });
}

export function createFaceLightmap(
  face: BspFace,
  lightMaps: Uint8Array,
  info?: BspLightmapInfo,
): Uint8Array | undefined {
  if (face.lightOffset < 0 || face.lightOffset >= lightMaps.byteLength) {
    return undefined;
  }
  const available = lightMaps.byteLength - face.lightOffset;
  const length = Math.min(info?.length ?? available, available);
  if (length <= 0) {
    return undefined;
  }
  return lightMaps.subarray(face.lightOffset, face.lightOffset + length);
}

export function parseWorldspawnSettings(entities: BspEntities): Record<string, string> {
  return entities.worldspawn?.properties ?? {};
}
