import { Vec3 } from '@quake2ts/shared';
import { VirtualFileSystem } from './vfs.js';

const MD3_IDENT = 860898377; // 'IDP3'
const MD3_VERSION = 15;

export interface Md3Header {
  readonly ident: number;
  readonly version: number;
  readonly name: string;
  readonly flags: number;
  readonly numFrames: number;
  readonly numTags: number;
  readonly numSurfaces: number;
  readonly numSkins: number;
  readonly ofsFrames: number;
  readonly ofsTags: number;
  readonly ofsSurfaces: number;
  readonly ofsEnd: number;
}

export interface Md3Frame {
  readonly minBounds: Vec3;
  readonly maxBounds: Vec3;
  readonly localOrigin: Vec3;
  readonly radius: number;
  readonly name: string;
}

export interface Md3Tag {
  readonly name: string;
  readonly origin: Vec3;
  readonly axis: readonly [Vec3, Vec3, Vec3];
}

export interface Md3Triangle {
  readonly indices: readonly [number, number, number];
}

export interface Md3Shader {
  readonly name: string;
  readonly shaderIndex: number;
}

export interface Md3TexCoord {
  readonly s: number;
  readonly t: number;
}

export interface Md3Vertex {
  readonly position: Vec3;
  readonly normal: Vec3;
  readonly latLng: number;
}

export interface Md3Surface {
  readonly name: string;
  readonly flags: number;
  readonly numFrames: number;
  readonly shaders: readonly Md3Shader[];
  readonly triangles: readonly Md3Triangle[];
  readonly texCoords: readonly Md3TexCoord[];
  readonly vertices: readonly (readonly Md3Vertex[])[];
}

export interface Md3Model {
  readonly header: Md3Header;
  readonly frames: readonly Md3Frame[];
  readonly tags: readonly Md3Tag[][];
  readonly surfaces: readonly Md3Surface[];
}

export class Md3ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Md3ParseError';
  }
}

function readString(view: DataView, offset: number, length: number): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
  const decoded = new TextDecoder('utf-8').decode(bytes);
  return decoded.replace(/\0.*$/, '').trim();
}

function decodeLatLngNormal(latLng: number): Vec3 {
  const lat = ((latLng >> 8) & 0xff) * (2 * Math.PI / 255);
  const lng = (latLng & 0xff) * (2 * Math.PI / 255);
  const sinLng = Math.sin(lng);
  return {
    x: Math.cos(lat) * sinLng,
    y: Math.sin(lat) * sinLng,
    z: Math.cos(lng),
  };
}

function validateOffset(name: string, offset: number, size: number, bufferLength: number): void {
  if (offset < 0 || offset + size > bufferLength) {
    throw new Md3ParseError(`${name} exceeds buffer bounds`);
  }
}

function parseHeader(view: DataView): Md3Header {
  const ident = view.getInt32(0, true);
  if (ident !== MD3_IDENT) {
    throw new Md3ParseError(`Invalid MD3 ident: ${ident}`);
  }
  const version = view.getInt32(4, true);
  if (version !== MD3_VERSION) {
    throw new Md3ParseError(`Unsupported MD3 version: ${version}`);
  }

  const name = readString(view, 8, 64);
  const flags = view.getInt32(72, true);
  const numFrames = view.getInt32(76, true);
  const numTags = view.getInt32(80, true);
  const numSurfaces = view.getInt32(84, true);
  const numSkins = view.getInt32(88, true);
  const ofsFrames = view.getInt32(92, true);
  const ofsTags = view.getInt32(96, true);
  const ofsSurfaces = view.getInt32(100, true);
  const ofsEnd = view.getInt32(104, true);

  if (numFrames <= 0 || numSurfaces < 0 || numTags < 0) {
    throw new Md3ParseError('Invalid MD3 counts');
  }

  return {
    ident,
    version,
    name,
    flags,
    numFrames,
    numTags,
    numSurfaces,
    numSkins,
    ofsFrames,
    ofsTags,
    ofsSurfaces,
    ofsEnd,
  };
}

function parseFrames(view: DataView, header: Md3Header): Md3Frame[] {
  const frames: Md3Frame[] = [];
  const frameSize = 56;
  validateOffset('Frames', header.ofsFrames, header.numFrames * frameSize, view.byteLength);

  for (let i = 0; i < header.numFrames; i += 1) {
    const base = header.ofsFrames + i * frameSize;
    frames.push({
      minBounds: {
        x: view.getFloat32(base, true),
        y: view.getFloat32(base + 4, true),
        z: view.getFloat32(base + 8, true),
      },
      maxBounds: {
        x: view.getFloat32(base + 12, true),
        y: view.getFloat32(base + 16, true),
        z: view.getFloat32(base + 20, true),
      },
      localOrigin: {
        x: view.getFloat32(base + 24, true),
        y: view.getFloat32(base + 28, true),
        z: view.getFloat32(base + 32, true),
      },
      radius: view.getFloat32(base + 36, true),
      name: readString(view, base + 40, 16),
    });
  }

  return frames;
}

function parseTags(view: DataView, header: Md3Header): Md3Tag[][] {
  const tags: Md3Tag[][] = [];
  const tagSize = 112;
  const totalSize = header.numFrames * header.numTags * tagSize;
  validateOffset('Tags', header.ofsTags, totalSize, view.byteLength);

  for (let frame = 0; frame < header.numFrames; frame += 1) {
    const frameTags: Md3Tag[] = [];
    for (let tagIndex = 0; tagIndex < header.numTags; tagIndex += 1) {
      const base = header.ofsTags + (frame * header.numTags + tagIndex) * tagSize;
      const originOffset = base + 64;
      const axisOffset = originOffset + 12;
      frameTags.push({
        name: readString(view, base, 64),
        origin: {
          x: view.getFloat32(originOffset, true),
          y: view.getFloat32(originOffset + 4, true),
          z: view.getFloat32(originOffset + 8, true),
        },
        axis: [
          {
            x: view.getFloat32(axisOffset, true),
            y: view.getFloat32(axisOffset + 4, true),
            z: view.getFloat32(axisOffset + 8, true),
          },
          {
            x: view.getFloat32(axisOffset + 12, true),
            y: view.getFloat32(axisOffset + 16, true),
            z: view.getFloat32(axisOffset + 20, true),
          },
          {
            x: view.getFloat32(axisOffset + 24, true),
            y: view.getFloat32(axisOffset + 28, true),
            z: view.getFloat32(axisOffset + 32, true),
          },
        ],
      });
    }
    tags.push(frameTags);
  }

  return tags;
}

function parseSurface(view: DataView, offset: number): { surface: Md3Surface; nextOffset: number } {
  const ident = view.getInt32(offset, true);
  if (ident !== MD3_IDENT) {
    throw new Md3ParseError(`Invalid surface ident at ${offset}: ${ident}`);
  }

  const name = readString(view, offset + 4, 64);
  const flags = view.getInt32(offset + 68, true);
  const numFrames = view.getInt32(offset + 72, true);
  const numShaders = view.getInt32(offset + 76, true);
  const numVerts = view.getInt32(offset + 80, true);
  const numTriangles = view.getInt32(offset + 84, true);
  const ofsTriangles = view.getInt32(offset + 88, true);
  const ofsShaders = view.getInt32(offset + 92, true);
  const ofsSt = view.getInt32(offset + 96, true);
  const ofsXyzNormals = view.getInt32(offset + 100, true);
  const ofsEnd = view.getInt32(offset + 104, true);

  if (numFrames <= 0 || numVerts <= 0 || numTriangles <= 0) {
    throw new Md3ParseError(`Invalid surface counts for ${name}`);
  }

  const surfaceSize = ofsEnd;
  validateOffset(`Surface ${name}`, offset, surfaceSize, view.byteLength);

  const triangles: Md3Triangle[] = [];
  const triangleStart = offset + ofsTriangles;
  for (let i = 0; i < numTriangles; i += 1) {
    const base = triangleStart + i * 12;
    triangles.push({
      indices: [view.getInt32(base, true), view.getInt32(base + 4, true), view.getInt32(base + 8, true)],
    });
  }

  const shaders: Md3Shader[] = [];
  const shaderStart = offset + ofsShaders;
  for (let i = 0; i < numShaders; i += 1) {
    const base = shaderStart + i * 68;
    shaders.push({ name: readString(view, base, 64), shaderIndex: view.getInt32(base + 64, true) });
  }

  const texCoords: Md3TexCoord[] = [];
  const stStart = offset + ofsSt;
  for (let i = 0; i < numVerts; i += 1) {
    const base = stStart + i * 8;
    texCoords.push({ s: view.getFloat32(base, true), t: view.getFloat32(base + 4, true) });
  }

  const vertices: Md3Vertex[][] = [];
  const xyzStart = offset + ofsXyzNormals;
  for (let frame = 0; frame < numFrames; frame += 1) {
    const frameVertices: Md3Vertex[] = [];
    for (let i = 0; i < numVerts; i += 1) {
      const base = xyzStart + (frame * numVerts + i) * 8;
      const x = view.getInt16(base, true) / 64;
      const y = view.getInt16(base + 2, true) / 64;
      const z = view.getInt16(base + 4, true) / 64;
      const latLng = view.getUint16(base + 6, true);
      frameVertices.push({ position: { x, y, z }, latLng, normal: decodeLatLngNormal(latLng) });
    }
    vertices.push(frameVertices);
  }

  return {
    surface: { name, flags, numFrames, shaders, triangles, texCoords, vertices },
    nextOffset: offset + ofsEnd,
  };
}

export function parseMd3(buffer: ArrayBufferLike): Md3Model {
  if (buffer.byteLength < 108) {
    throw new Md3ParseError('MD3 buffer too small for header');
  }

  const view = new DataView(buffer);
  const header = parseHeader(view);
  validateOffset('MD3 end', header.ofsEnd, 0, buffer.byteLength);

  const frames = parseFrames(view, header);
  const tags = parseTags(view, header);

  const surfaces: Md3Surface[] = [];
  let surfaceOffset = header.ofsSurfaces;
  for (let i = 0; i < header.numSurfaces; i += 1) {
    const { surface, nextOffset } = parseSurface(view, surfaceOffset);
    surfaces.push(surface);
    surfaceOffset = nextOffset;
  }

  if (surfaceOffset !== header.ofsEnd) {
    throw new Md3ParseError('Surface parsing did not reach ofsEnd');
  }

  return { header, frames, tags, surfaces };
}

export class Md3Loader {
  constructor(private readonly vfs: VirtualFileSystem) {}

  async load(path: string): Promise<Md3Model> {
    const data = await this.vfs.readFile(path);
    return parseMd3(data.slice().buffer);
  }
}
