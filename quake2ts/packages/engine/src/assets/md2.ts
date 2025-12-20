import { ANORMS as MD2_NORMALS } from '@quake2ts/shared';
import { Vec3 } from '@quake2ts/shared';
import { VirtualFileSystem } from './vfs.js';

const MD2_MAGIC = 844121161; // 'IDP2'
const MD2_VERSION = 8;
const HEADER_SIZE = 68;

export interface Md2Header {
  readonly ident: number;
  readonly version: number;
  readonly skinWidth: number;
  readonly skinHeight: number;
  readonly frameSize: number;
  readonly numSkins: number;
  readonly numVertices: number;
  readonly numTexCoords: number;
  readonly numTriangles: number;
  readonly numGlCommands: number;
  readonly numFrames: number;
  readonly offsetSkins: number;
  readonly offsetTexCoords: number;
  readonly offsetTriangles: number;
  readonly offsetFrames: number;
  readonly offsetGlCommands: number;
  readonly offsetEnd: number;
  readonly magic: number;
}

export interface Md2Skin {
  readonly name: string;
}

export interface Md2TexCoord {
  readonly s: number;
  readonly t: number;
}

export interface Md2Triangle {
  readonly vertexIndices: [number, number, number];
  readonly texCoordIndices: [number, number, number];
}

export interface Md2Vertex {
  readonly position: Vec3;
  readonly normalIndex: number;
  readonly normal: Vec3;
}

export interface Md2Frame {
  readonly name: string;
  readonly vertices: readonly Md2Vertex[];
  readonly minBounds: Vec3;
  readonly maxBounds: Vec3;
}

export interface Md2GlCommandVertex {
  readonly s: number;
  readonly t: number;
  readonly vertexIndex: number;
}

export interface Md2GlCommand {
  readonly mode: 'strip' | 'fan';
  readonly vertices: readonly Md2GlCommandVertex[];
}

export interface Md2Model {
  readonly header: Md2Header;
  readonly skins: readonly Md2Skin[];
  readonly texCoords: readonly Md2TexCoord[];
  readonly triangles: readonly Md2Triangle[];
  readonly frames: readonly Md2Frame[];
  readonly glCommands: readonly Md2GlCommand[];
  /**
   * Multiple LOD versions of model (high, medium, low poly)
   */
  readonly lods?: Md2Model[];
}

export interface Md2Animation {
  readonly name: string;
  readonly firstFrame: number;
  readonly lastFrame: number;
}

export class Md2ParseError extends Error {}

export class Md2Loader {
  private readonly cache = new Map<string, Md2Model>();

  constructor(private readonly vfs: VirtualFileSystem) {}

  async load(path: string): Promise<Md2Model> {
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }
    const bytes = await this.vfs.readFile(path);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const model = parseMd2(copy.buffer);
    this.cache.set(path, model);
    return model;
  }

  get(path: string): Md2Model | undefined {
    return this.cache.get(path);
  }
}

function readCString(view: DataView, offset: number, maxLength: number): string {
  const chars: number[] = [];
  for (let i = 0; i < maxLength; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    chars.push(code);
  }
  return String.fromCharCode(...chars);
}

function validateSection(buffer: ArrayBuffer, offset: number, length: number, label: string): void {
  if (length === 0) return;
  if (offset < HEADER_SIZE || offset + length > buffer.byteLength) {
    throw new Md2ParseError(`${label} section is out of bounds`);
  }
}

function parseHeader(buffer: ArrayBuffer): Md2Header {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new Md2ParseError('MD2 buffer too small to contain header');
  }

  const view = new DataView(buffer);
  const ident = view.getInt32(0, true);
  const version = view.getInt32(4, true);

  if (ident !== MD2_MAGIC) {
    throw new Md2ParseError(`Invalid MD2 ident: ${ident}`);
  }
  if (version !== MD2_VERSION) {
    throw new Md2ParseError(`Unsupported MD2 version: ${version}`);
  }

  const header: Md2Header = {
    ident,
    version,
    skinWidth: view.getInt32(8, true),
    skinHeight: view.getInt32(12, true),
    frameSize: view.getInt32(16, true),
    numSkins: view.getInt32(20, true),
    numVertices: view.getInt32(24, true),
    numTexCoords: view.getInt32(28, true),
    numTriangles: view.getInt32(32, true),
    numGlCommands: view.getInt32(36, true),
    numFrames: view.getInt32(40, true),
    offsetSkins: view.getInt32(44, true),
    offsetTexCoords: view.getInt32(48, true),
    offsetTriangles: view.getInt32(52, true),
    offsetFrames: view.getInt32(56, true),
    offsetGlCommands: view.getInt32(60, true),
    offsetEnd: view.getInt32(64, true),
    magic: ident
  };

  const expectedFrameSize = 40 + header.numVertices * 4;
  if (header.frameSize !== expectedFrameSize) {
    throw new Md2ParseError(`Unexpected frame size ${header.frameSize}, expected ${expectedFrameSize}`);
  }

  if (header.offsetEnd > buffer.byteLength) {
    throw new Md2ParseError('MD2 offset_end exceeds buffer length');
  }

  return header;
}

function parseSkins(buffer: ArrayBuffer, header: Md2Header): Md2Skin[] {
  const size = header.numSkins * 64;
  validateSection(buffer, header.offsetSkins, size, 'skins');
  const view = new DataView(buffer, header.offsetSkins, size);
  const skins: Md2Skin[] = [];
  for (let i = 0; i < header.numSkins; i += 1) {
    skins.push({ name: readCString(view, i * 64, 64) });
  }
  return skins;
}

function parseTexCoords(buffer: ArrayBuffer, header: Md2Header): Md2TexCoord[] {
  const size = header.numTexCoords * 4;
  validateSection(buffer, header.offsetTexCoords, size, 'texcoords');
  const view = new DataView(buffer, header.offsetTexCoords, size);
  const texCoords: Md2TexCoord[] = [];
  for (let i = 0; i < header.numTexCoords; i += 1) {
    const base = i * 4;
    texCoords.push({ s: view.getInt16(base, true), t: view.getInt16(base + 2, true) });
  }
  return texCoords;
}

function parseTriangles(buffer: ArrayBuffer, header: Md2Header): Md2Triangle[] {
  const size = header.numTriangles * 12;
  validateSection(buffer, header.offsetTriangles, size, 'triangles');
  const view = new DataView(buffer, header.offsetTriangles, size);
  const triangles: Md2Triangle[] = [];

  for (let i = 0; i < header.numTriangles; i += 1) {
    const base = i * 12;
    const vertexIndices: [number, number, number] = [
      view.getUint16(base, true),
      view.getUint16(base + 2, true),
      view.getUint16(base + 4, true),
    ];
    const texCoordIndices: [number, number, number] = [
      view.getUint16(base + 6, true),
      view.getUint16(base + 8, true),
      view.getUint16(base + 10, true),
    ];

    if (vertexIndices.some((v) => v >= header.numVertices) || texCoordIndices.some((t) => t >= header.numTexCoords)) {
      throw new Md2ParseError('Triangle references out of range vertex or texcoord');
    }

    triangles.push({ vertexIndices, texCoordIndices });
  }

  return triangles;
}

function parseFrames(buffer: ArrayBuffer, header: Md2Header): Md2Frame[] {
  const size = header.numFrames * header.frameSize;
  validateSection(buffer, header.offsetFrames, size, 'frames');
  const frames: Md2Frame[] = [];

  for (let i = 0; i < header.numFrames; i += 1) {
    const base = header.offsetFrames + i * header.frameSize;
    const view = new DataView(buffer, base, header.frameSize);
    const scale: Vec3 = { x: view.getFloat32(0, true), y: view.getFloat32(4, true), z: view.getFloat32(8, true) };
    const translate: Vec3 = {
      x: view.getFloat32(12, true),
      y: view.getFloat32(16, true),
      z: view.getFloat32(20, true),
    };
    const name = readCString(view, 24, 16);
    const vertices: Md2Vertex[] = [];

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let v = 0; v < header.numVertices; v += 1) {
      const offset = 40 + v * 4;
      const x = view.getUint8(offset) * scale.x + translate.x;
      const y = view.getUint8(offset + 1) * scale.y + translate.y;
      const z = view.getUint8(offset + 2) * scale.z + translate.z;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;

      const position: Vec3 = { x, y, z };
      const normalIndex = view.getUint8(offset + 3);
      const normalArr = MD2_NORMALS[normalIndex] as unknown as [number, number, number];
      if (!normalArr) {
        throw new Md2ParseError(`Invalid normal index ${normalIndex} in frame ${name}`);
      }
      const normal: Vec3 = { x: normalArr[0], y: normalArr[1], z: normalArr[2] };
      vertices.push({ position, normalIndex, normal });
    }

    frames.push({
      name,
      vertices,
      minBounds: { x: minX, y: minY, z: minZ },
      maxBounds: { x: maxX, y: maxY, z: maxZ },
    });
  }

  return frames;
}

function parseGlCommands(buffer: ArrayBuffer, header: Md2Header): Md2GlCommand[] {
  const size = header.numGlCommands * 4;
  validateSection(buffer, header.offsetGlCommands, size, 'gl commands');
  if (size === 0) {
    return [];
  }
  const view = new DataView(buffer, header.offsetGlCommands, size);
  const commands: Md2GlCommand[] = [];
  let cursor = 0;

  while (true) {
    if (cursor + 4 > size) {
      throw new Md2ParseError('GL command list ended unexpectedly');
    }
    const count = view.getInt32(cursor, true);
    cursor += 4;
    if (count === 0) break;
    const vertexCount = Math.abs(count);
    const vertices: Md2GlCommandVertex[] = [];
    const bytesNeeded = vertexCount * 12;
    if (cursor + bytesNeeded > size) {
      throw new Md2ParseError('GL command vertex block exceeds buffer');
    }
    for (let i = 0; i < vertexCount; i += 1) {
      const s = view.getFloat32(cursor, true);
      const t = view.getFloat32(cursor + 4, true);
      const vertexIndex = view.getInt32(cursor + 8, true);
      cursor += 12;
      if (vertexIndex < 0 || vertexIndex >= header.numVertices) {
        throw new Md2ParseError('GL command references invalid vertex index');
      }
      vertices.push({ s, t, vertexIndex });
    }
    commands.push({ mode: count > 0 ? 'strip' : 'fan', vertices });
  }

  if (cursor !== size) {
    throw new Md2ParseError('GL command list did not consume expected data');
  }

  return commands;
}

export function parseMd2(buffer: ArrayBuffer): Md2Model {
  const header = parseHeader(buffer);
  const skins = parseSkins(buffer, header);
  const texCoords = parseTexCoords(buffer, header);
  const triangles = parseTriangles(buffer, header);
  const frames = parseFrames(buffer, header);
  const glCommands = parseGlCommands(buffer, header);

  return { header, skins, texCoords, triangles, frames, glCommands };
}

export function groupMd2Animations(frames: readonly Md2Frame[]): Md2Animation[] {
  const animations: Md2Animation[] = [];
  let index = 0;
  while (index < frames.length) {
    const name = frames[index].name;
    const base = name.replace(/\d+$/, '') || name;
    let end = index;
    while (end + 1 < frames.length) {
      const nextBase = frames[end + 1].name.replace(/\d+$/, '') || frames[end + 1].name;
      if (nextBase !== base) break;
      end += 1;
    }
    animations.push({ name: base, firstFrame: index, lastFrame: end });
    index = end + 1;
  }
  return animations;
}
