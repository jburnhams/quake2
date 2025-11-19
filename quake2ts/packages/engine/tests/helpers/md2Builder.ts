import { Vec3 } from '@quake2ts/shared';

export interface Md2FrameVertexInput {
  readonly position: Vec3;
  readonly normalIndex: number;
}

export interface Md2FrameInput {
  readonly name: string;
  readonly vertices: readonly Md2FrameVertexInput[];
  readonly scale?: Vec3;
  readonly translate?: Vec3;
}

export interface Md2GlCommandVertexInput {
  readonly s: number;
  readonly t: number;
  readonly vertexIndex: number;
}

export interface Md2GlCommandInput {
  readonly mode: 'strip' | 'fan';
  readonly vertices: readonly Md2GlCommandVertexInput[];
}

export interface Md2BuilderOptions {
  readonly skins?: readonly string[];
  readonly texCoords: readonly { s: number; t: number }[];
  readonly triangles: readonly { vertexIndices: [number, number, number]; texCoordIndices: [number, number, number] }[];
  readonly frames: readonly Md2FrameInput[];
  readonly glCommands?: readonly Md2GlCommandInput[];
  readonly skinWidth?: number;
  readonly skinHeight?: number;
}

function allocBuffer(size: number): DataView {
  return new DataView(new ArrayBuffer(size));
}

function writeCString(view: DataView, offset: number, text: string, max: number): void {
  const bytes = new TextEncoder().encode(text);
  const length = Math.min(bytes.length, max - 1);
  new Uint8Array(view.buffer, view.byteOffset + offset, length).set(bytes.slice(0, length));
  view.setUint8(offset + length, 0);
}

function encodeFrames(frames: readonly Md2FrameInput[], numVertices: number): Uint8Array {
  const frameSize = 40 + numVertices * 4;
  const view = allocBuffer(frames.length * frameSize);
  frames.forEach((frame, frameIndex) => {
    const base = frameIndex * frameSize;
    const scale: Vec3 = frame.scale ?? { x: 1, y: 1, z: 1 };
    const translate: Vec3 = frame.translate ?? { x: 0, y: 0, z: 0 };
    view.setFloat32(base, scale.x, true);
    view.setFloat32(base + 4, scale.y, true);
    view.setFloat32(base + 8, scale.z, true);
    view.setFloat32(base + 12, translate.x, true);
    view.setFloat32(base + 16, translate.y, true);
    view.setFloat32(base + 20, translate.z, true);
    writeCString(view, base + 24, frame.name, 16);

    frame.vertices.forEach((vertex, index) => {
      const offset = base + 40 + index * 4;
      view.setUint8(offset, Math.round((vertex.position.x - translate.x) / scale.x));
      view.setUint8(offset + 1, Math.round((vertex.position.y - translate.y) / scale.y));
      view.setUint8(offset + 2, Math.round((vertex.position.z - translate.z) / scale.z));
      view.setUint8(offset + 3, vertex.normalIndex);
    });
  });
  return new Uint8Array(view.buffer);
}

function encodeGlCommands(commands: readonly Md2GlCommandInput[] | undefined): { data: Uint8Array; count: number } {
  const bytes: number[] = [];
  (commands ?? []).forEach((command) => {
    const count = command.vertices.length * (command.mode === 'strip' ? 1 : -1);
    bytes.push(count);
    command.vertices.forEach((vertex) => {
      const floatView = new DataView(new ArrayBuffer(4));
      floatView.setFloat32(0, vertex.s, true);
      bytes.push(floatView.getInt32(0, true));
      floatView.setFloat32(0, vertex.t, true);
      bytes.push(floatView.getInt32(0, true));
      bytes.push(vertex.vertexIndex);
    });
  });
  bytes.push(0);

  const data = new Uint8Array(bytes.length * 4);
  const view = new DataView(data.buffer);
  bytes.forEach((value, index) => view.setInt32(index * 4, value, true));
  return { data, count: bytes.length };
}

export function buildMd2(options: Md2BuilderOptions): ArrayBuffer {
  const numVertices = options.frames[0]?.vertices.length ?? 0;
  const frameSize = 40 + numVertices * 4;
  const skins = options.skins ?? [];
  const { data: glData, count: glCount } = encodeGlCommands(options.glCommands);

  const headerSize = 68;
  const skinsSize = skins.length * 64;
  const texCoordSize = options.texCoords.length * 4;
  const triangleSize = options.triangles.length * 12;
  const frameBlockSize = options.frames.length * frameSize;
  const glSize = glData.length;

  const offsetSkins = headerSize;
  const offsetTexCoords = offsetSkins + skinsSize;
  const offsetTriangles = offsetTexCoords + texCoordSize;
  const offsetFrames = offsetTriangles + triangleSize;
  const offsetGlCommands = offsetFrames + frameBlockSize;
  const offsetEnd = offsetGlCommands + glSize;

  const view = allocBuffer(offsetEnd);
  view.setInt32(0, 844121161, true); // IDP2
  view.setInt32(4, 8, true);
  view.setInt32(8, options.skinWidth ?? 64, true);
  view.setInt32(12, options.skinHeight ?? 64, true);
  view.setInt32(16, frameSize, true);
  view.setInt32(20, skins.length, true);
  view.setInt32(24, numVertices, true);
  view.setInt32(28, options.texCoords.length, true);
  view.setInt32(32, options.triangles.length, true);
  view.setInt32(36, glCount, true);
  view.setInt32(40, options.frames.length, true);
  view.setInt32(44, offsetSkins, true);
  view.setInt32(48, offsetTexCoords, true);
  view.setInt32(52, offsetTriangles, true);
  view.setInt32(56, offsetFrames, true);
  view.setInt32(60, offsetGlCommands, true);
  view.setInt32(64, offsetEnd, true);

  skins.forEach((skin, index) => writeCString(view, offsetSkins + index * 64, skin, 64));

  options.texCoords.forEach((coord, index) => {
    const base = offsetTexCoords + index * 4;
    view.setInt16(base, coord.s, true);
    view.setInt16(base + 2, coord.t, true);
  });

  options.triangles.forEach((tri, index) => {
    const base = offsetTriangles + index * 12;
    view.setUint16(base, tri.vertexIndices[0], true);
    view.setUint16(base + 2, tri.vertexIndices[1], true);
    view.setUint16(base + 4, tri.vertexIndices[2], true);
    view.setUint16(base + 6, tri.texCoordIndices[0], true);
    view.setUint16(base + 8, tri.texCoordIndices[1], true);
    view.setUint16(base + 10, tri.texCoordIndices[2], true);
  });

  new Uint8Array(view.buffer, offsetFrames, frameBlockSize).set(encodeFrames(options.frames, numVertices));
  new Uint8Array(view.buffer, offsetGlCommands, glSize).set(glData);

  return view.buffer;
}
