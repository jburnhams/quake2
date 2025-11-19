import { Vec3 } from '@quake2ts/shared';

interface Md3SurfaceSpec {
  readonly name: string;
  readonly triangles: readonly [number, number, number][];
  readonly texCoords: readonly { s: number; t: number }[];
  readonly vertices: readonly (readonly { position: Vec3; latLng: number }[])[];
  readonly shaders?: readonly { name: string; index: number }[];
}

interface Md3BuildOptions {
  readonly name?: string;
  readonly frames: readonly { min: Vec3; max: Vec3; origin: Vec3; radius: number; name: string }[];
  readonly tags?: readonly { name: string; origin: Vec3; axis: readonly [Vec3, Vec3, Vec3] }[];
  readonly surfaces: readonly Md3SurfaceSpec[];
}

const HEADER_SIZE = 108;
const FRAME_SIZE = 56;
const TAG_SIZE = 112;
const SURFACE_HEADER_SIZE = 108;

function writeString(target: DataView, offset: number, text: string, length: number): void {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  const bytes = new Uint8Array(target.buffer, target.byteOffset + offset, length);
  bytes.fill(0);
  bytes.set(encoded.subarray(0, length));
}

function buildSurface(buffer: ArrayBuffer, offset: number, surface: Md3SurfaceSpec, numFrames: number): number {
  const view = new DataView(buffer);
  writeString(view, offset + 4, surface.name, 64);
  view.setInt32(offset, 0x33504449, true);
  view.setInt32(offset + 72, numFrames, true);
  view.setInt32(offset + 76, surface.shaders?.length ?? 0, true);
  view.setInt32(offset + 80, surface.vertices[0]?.length ?? 0, true);
  view.setInt32(offset + 84, surface.triangles.length, true);

  let cursor = SURFACE_HEADER_SIZE;
  view.setInt32(offset + 88, cursor, true);
  for (const tri of surface.triangles) {
    view.setInt32(offset + cursor, tri[0], true);
    view.setInt32(offset + cursor + 4, tri[1], true);
    view.setInt32(offset + cursor + 8, tri[2], true);
    cursor += 12;
  }

  view.setInt32(offset + 92, cursor, true);
  for (const shader of surface.shaders ?? []) {
    writeString(view, offset + cursor, shader.name, 64);
    view.setInt32(offset + cursor + 64, shader.index, true);
    cursor += 68;
  }

  view.setInt32(offset + 96, cursor, true);
  for (const tex of surface.texCoords) {
    view.setFloat32(offset + cursor, tex.s, true);
    view.setFloat32(offset + cursor + 4, tex.t, true);
    cursor += 8;
  }

  view.setInt32(offset + 100, cursor, true);
  for (const frame of surface.vertices) {
    for (const vertex of frame) {
      view.setInt16(offset + cursor, Math.round(vertex.position.x * 64), true);
      view.setInt16(offset + cursor + 2, Math.round(vertex.position.y * 64), true);
      view.setInt16(offset + cursor + 4, Math.round(vertex.position.z * 64), true);
      view.setUint16(offset + cursor + 6, vertex.latLng, true);
      cursor += 8;
    }
  }

  view.setInt32(offset + 104, cursor, true);
  return cursor;
}

export function buildMd3(options: Md3BuildOptions): ArrayBuffer {
  const numFrames = options.frames.length;
  const numTags = options.tags?.length ?? 0;
  const numSurfaces = options.surfaces.length;

  let size = HEADER_SIZE;
  size += numFrames * FRAME_SIZE;
  size += numFrames * numTags * TAG_SIZE;

  for (const surface of options.surfaces) {
    const verts = surface.vertices[0]?.length ?? 0;
    const triangles = surface.triangles.length;
    const shaders = surface.shaders?.length ?? 0;
    const texCoordBytes = surface.texCoords.length * 8;
    const surfaceSize = SURFACE_HEADER_SIZE + triangles * 12 + shaders * 68 + texCoordBytes + verts * 8 * numFrames;
    size += surfaceSize;
  }

  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  writeString(view, 8, options.name ?? 'builder', 64);
  view.setInt32(0, 0x33504449, true);
  view.setInt32(4, 15, true);
  view.setInt32(72, 0, true);
  view.setInt32(76, numFrames, true);
  view.setInt32(80, numTags, true);
  view.setInt32(84, numSurfaces, true);
  view.setInt32(88, 0, true);

  let offset = HEADER_SIZE;
  view.setInt32(92, offset, true);
  for (const frame of options.frames) {
    view.setFloat32(offset, frame.min.x, true);
    view.setFloat32(offset + 4, frame.min.y, true);
    view.setFloat32(offset + 8, frame.min.z, true);
    view.setFloat32(offset + 12, frame.max.x, true);
    view.setFloat32(offset + 16, frame.max.y, true);
    view.setFloat32(offset + 20, frame.max.z, true);
    view.setFloat32(offset + 24, frame.origin.x, true);
    view.setFloat32(offset + 28, frame.origin.y, true);
    view.setFloat32(offset + 32, frame.origin.z, true);
    view.setFloat32(offset + 36, frame.radius, true);
    writeString(view, offset + 40, frame.name, 16);
    offset += FRAME_SIZE;
  }

  view.setInt32(96, offset, true);
  for (let frame = 0; frame < numFrames; frame += 1) {
    for (const tag of options.tags ?? []) {
      writeString(view, offset, tag.name, 64);
      view.setFloat32(offset + 64, tag.origin.x, true);
      view.setFloat32(offset + 68, tag.origin.y, true);
      view.setFloat32(offset + 72, tag.origin.z, true);
      for (let axis = 0; axis < 3; axis += 1) {
        const v = tag.axis[axis];
        view.setFloat32(offset + 76 + axis * 12, v.x, true);
        view.setFloat32(offset + 80 + axis * 12, v.y, true);
        view.setFloat32(offset + 84 + axis * 12, v.z, true);
      }
      offset += TAG_SIZE;
    }
  }

  view.setInt32(100, offset, true);
  for (let i = 0; i < options.surfaces.length; i += 1) {
    const written = buildSurface(buffer, offset, options.surfaces[i]!, numFrames);
    offset += written;
  }

  view.setInt32(104, offset, true);
  return buffer;
}
