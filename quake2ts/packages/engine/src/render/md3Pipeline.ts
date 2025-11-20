import { Mat4, Vec3, mat4FromBasis, normalizeVec3, transformPointMat4 } from '@quake2ts/shared';
import { Md3Model, Md3Surface } from '../assets/md3.js';
import { IndexBuffer, VertexArray, VertexBuffer } from './resources.js';
import { ShaderProgram } from './shaderProgram.js';

export interface Md3DrawVertex {
  readonly vertexIndex: number;
  readonly texCoord: readonly [number, number];
}

export interface Md3SurfaceGeometry {
  readonly vertices: readonly Md3DrawVertex[];
  readonly indices: Uint16Array;
}

export interface Md3FrameBlend {
  readonly currentFrame: number;
  readonly nextFrame: number;
  readonly lerp: number;
}

export interface Md3DynamicLight {
  readonly origin: Vec3;
  readonly color: readonly [number, number, number];
  readonly radius: number;
}

export interface Md3LightingOptions {
  readonly ambient?: readonly [number, number, number];
  readonly directional?: { direction: Vec3; color: readonly [number, number, number] };
  readonly dynamicLights?: readonly Md3DynamicLight[];
  readonly modelMatrix?: Mat4;
}

export interface Md3SurfaceMaterial {
  readonly diffuseSampler?: number;
  readonly tint?: readonly [number, number, number, number];
}

export interface Md3TagTransform {
  readonly origin: Vec3;
  readonly axis: readonly [Vec3, Vec3, Vec3];
  readonly matrix: Mat4;
}

const DEFAULT_AMBIENT: readonly [number, number, number] = [0.2, 0.2, 0.2];
const DEFAULT_DIRECTION: Vec3 = { x: 0, y: 0, z: 1 };
const DEFAULT_DIRECTION_COLOR: readonly [number, number, number] = [0.8, 0.8, 0.8];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function buildMd3SurfaceGeometry(surface: Md3Surface): Md3SurfaceGeometry {
  const vertices: Md3DrawVertex[] = [];
  const indices: number[] = [];

  for (const tri of surface.triangles) {
    const base = vertices.length;
    const [a, b, c] = tri.indices;
    const texA = surface.texCoords[a];
    const texB = surface.texCoords[b];
    const texC = surface.texCoords[c];

    if (!texA || !texB || !texC) {
      throw new Error(`Missing texCoord for triangle in surface ${surface.name}`);
    }

    vertices.push(
      { vertexIndex: a, texCoord: [texA.s, 1 - texA.t] },
      { vertexIndex: b, texCoord: [texB.s, 1 - texB.t] },
      { vertexIndex: c, texCoord: [texC.s, 1 - texC.t] }
    );

    indices.push(base, base + 1, base + 2);
  }

  return { vertices, indices: new Uint16Array(indices) };
}

function evaluateLighting(normal: Vec3, position: Vec3, lighting?: Md3LightingOptions): readonly [number, number, number] {
  const ambient = lighting?.ambient ?? DEFAULT_AMBIENT;
  const directional = lighting?.directional ?? { direction: DEFAULT_DIRECTION, color: DEFAULT_DIRECTION_COLOR };

  const n = normalizeVec3(normal);
  const l = normalizeVec3(directional.direction);
  const ndotl = clamp01(n.x * l.x + n.y * l.y + n.z * l.z);

  let r = ambient[0] + directional.color[0] * ndotl;
  let g = ambient[1] + directional.color[1] * ndotl;
  let b = ambient[2] + directional.color[2] * ndotl;

  if (lighting?.dynamicLights) {
    const worldPos = lighting.modelMatrix ? transformPointMat4(lighting.modelMatrix, position) : position;
    for (const light of lighting.dynamicLights) {
      const dx = worldPos.x - light.origin.x;
      const dy = worldPos.y - light.origin.y;
      const dz = worldPos.z - light.origin.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const radiusSq = light.radius * light.radius;
      if (distSq < radiusSq && radiusSq > 0) {
        const attenuation = 1 - Math.sqrt(distSq) / light.radius;
        const amount = clamp01(attenuation * ndotl);
        r += light.color[0] * amount;
        g += light.color[1] * amount;
        b += light.color[2] * amount;
      }
    }
  }

  return [clamp01(r), clamp01(g), clamp01(b)];
}

export function buildMd3VertexData(
  surface: Md3Surface,
  geometry: Md3SurfaceGeometry,
  blend: Md3FrameBlend,
  lighting?: Md3LightingOptions
): Float32Array {
  const frameA = surface.vertices[blend.currentFrame];
  const frameB = surface.vertices[blend.nextFrame];

  if (!frameA || !frameB) {
    throw new Error('Requested MD3 frames are out of range');
  }

  const data = new Float32Array(geometry.vertices.length * 12);
  geometry.vertices.forEach((vertex, index) => {
    const vA = frameA[vertex.vertexIndex];
    const vB = frameB[vertex.vertexIndex];

    if (!vA || !vB) {
      throw new Error(`Vertex index ${vertex.vertexIndex} missing for frame`);
    }

    const position = lerpVec3(vA.position, vB.position, blend.lerp);
    const normal = normalizeVec3(lerpVec3(vA.normal, vB.normal, blend.lerp));
    const color = evaluateLighting(normal, position, lighting);

    const base = index * 12;
    data[base] = position.x;
    data[base + 1] = position.y;
    data[base + 2] = position.z;
    data[base + 3] = normal.x;
    data[base + 4] = normal.y;
    data[base + 5] = normal.z;
    data[base + 6] = vertex.texCoord[0];
    data[base + 7] = vertex.texCoord[1];
    data[base + 8] = color[0];
    data[base + 9] = color[1];
    data[base + 10] = color[2];
    data[base + 11] = 1;
  });

  return data;
}

export function interpolateMd3Tag(model: Md3Model, blend: Md3FrameBlend, tagName: string): Md3TagTransform | null {
  const firstFrameTags = model.tags[0];
  if (!firstFrameTags) {
    return null;
  }

  const tagIndex = firstFrameTags.findIndex((tag) => tag.name === tagName);
  if (tagIndex === -1) {
    return null;
  }

  const tagA = model.tags[blend.currentFrame]?.[tagIndex];
  const tagB = model.tags[blend.nextFrame]?.[tagIndex];
  if (!tagA || !tagB) {
    throw new Error(`Tag ${tagName} is missing for one of the interpolated frames`);
  }

  const origin = lerpVec3(tagA.origin, tagB.origin, blend.lerp);
  const axis0 = normalizeVec3(lerpVec3(tagA.axis[0], tagB.axis[0], blend.lerp));
  const axis1 = normalizeVec3(lerpVec3(tagA.axis[1], tagB.axis[1], blend.lerp));
  const axis2 = normalizeVec3(lerpVec3(tagA.axis[2], tagB.axis[2], blend.lerp));

  // Re-orthogonalize to match rerelease attachment stability expectations
  const corrected0 = axis0;
  const corrected1 = normalizeVec3({
    x: axis1.x - corrected0.x * (corrected0.x * axis1.x + corrected0.y * axis1.y + corrected0.z * axis1.z),
    y: axis1.y - corrected0.y * (corrected0.x * axis1.x + corrected0.y * axis1.y + corrected0.z * axis1.z),
    z: axis1.z - corrected0.z * (corrected0.x * axis1.x + corrected0.y * axis1.y + corrected0.z * axis1.z),
  });
  const corrected2 = normalizeVec3({
    x: corrected0.y * corrected1.z - corrected0.z * corrected1.y,
    y: corrected0.z * corrected1.x - corrected0.x * corrected1.z,
    z: corrected0.x * corrected1.y - corrected0.y * corrected1.x,
  });

  const axis: readonly [Vec3, Vec3, Vec3] = [corrected0, corrected1, corrected2];
  return { origin, axis, matrix: mat4FromBasis(origin, axis) };
}

export const MD3_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_texCoord;
layout(location = 3) in vec4 a_color;

uniform mat4 u_modelViewProjection;

out vec2 v_texCoord;
out vec4 v_color;

void main() {
  v_texCoord = a_texCoord;
  v_color = a_color;
  gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
}`;

export const MD3_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
in vec4 v_color;

uniform sampler2D u_diffuseMap;
uniform vec4 u_tint;

out vec4 o_color;

void main() {
  vec4 albedo = texture(u_diffuseMap, v_texCoord) * u_tint;
  o_color = vec4(albedo.rgb * v_color.rgb, albedo.a * v_color.a);
}`;

export class Md3SurfaceMesh {
  readonly gl: WebGL2RenderingContext;
  readonly geometry: Md3SurfaceGeometry;
  readonly vertexBuffer: VertexBuffer;
  readonly indexBuffer: IndexBuffer;
  readonly vertexArray: VertexArray;
  readonly indexCount: number;

  constructor(gl: WebGL2RenderingContext, surface: Md3Surface, blend: Md3FrameBlend, lighting?: Md3LightingOptions) {
    this.gl = gl;
    this.geometry = buildMd3SurfaceGeometry(surface);
    this.vertexBuffer = new VertexBuffer(gl, gl.STATIC_DRAW);
    this.indexBuffer = new IndexBuffer(gl, gl.STATIC_DRAW);
    this.vertexArray = new VertexArray(gl);
    this.indexCount = this.geometry.indices.length;

    this.vertexArray.configureAttributes(
      [
        { index: 0, size: 3, type: gl.FLOAT, stride: 48, offset: 0 },
        { index: 1, size: 3, type: gl.FLOAT, stride: 48, offset: 12 },
        { index: 2, size: 2, type: gl.FLOAT, stride: 48, offset: 24 },
        { index: 3, size: 4, type: gl.FLOAT, stride: 48, offset: 32 },
      ],
      this.vertexBuffer
    );

    this.vertexArray.bind();
    this.indexBuffer.bind();
    this.indexBuffer.upload(this.geometry.indices as unknown as BufferSource, gl.STATIC_DRAW);
    this.update(surface, blend, lighting);
  }

  update(surface: Md3Surface, blend: Md3FrameBlend, lighting?: Md3LightingOptions): void {
    const data = buildMd3VertexData(surface, this.geometry, blend, lighting);
    this.vertexBuffer.upload(data as unknown as BufferSource, this.gl.STATIC_DRAW);
  }

  bind(): void {
    this.vertexArray.bind();
    this.indexBuffer.bind();
  }

  dispose(): void {
    this.vertexBuffer.dispose();
    this.indexBuffer.dispose();
    this.vertexArray.dispose();
  }
}

export class Md3ModelMesh {
  readonly surfaces = new Map<string, Md3SurfaceMesh>();
  readonly gl: WebGL2RenderingContext;
  readonly model: Md3Model;
  blend: Md3FrameBlend;
  lighting?: Md3LightingOptions;

  constructor(gl: WebGL2RenderingContext, model: Md3Model, blend: Md3FrameBlend, lighting?: Md3LightingOptions) {
    this.gl = gl;
    this.model = model;
    this.blend = blend;
    this.lighting = lighting;

    model.surfaces.forEach((surface) => {
      this.surfaces.set(surface.name, new Md3SurfaceMesh(gl, surface, blend, lighting));
    });
  }

  update(blend: Md3FrameBlend, lighting?: Md3LightingOptions): void {
    this.blend = blend;
    this.lighting = lighting ?? this.lighting;
    for (const surface of this.model.surfaces) {
      const mesh = this.surfaces.get(surface.name);
      mesh?.update(surface, blend, this.lighting);
    }
  }

  dispose(): void {
    for (const mesh of this.surfaces.values()) {
      mesh.dispose();
    }
    this.surfaces.clear();
  }
}

export class Md3Pipeline {
  readonly gl: WebGL2RenderingContext;
  readonly program: ShaderProgram;

  private readonly uniformMvp: WebGLUniformLocation | null;
  private readonly uniformTint: WebGLUniformLocation | null;
  private readonly uniformDiffuse: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = ShaderProgram.create(
      gl,
      { vertex: MD3_VERTEX_SHADER, fragment: MD3_FRAGMENT_SHADER },
      { a_position: 0, a_normal: 1, a_texCoord: 2, a_color: 3 }
    );

    this.uniformMvp = this.program.getUniformLocation('u_modelViewProjection');
    this.uniformTint = this.program.getUniformLocation('u_tint');
    this.uniformDiffuse = this.program.getUniformLocation('u_diffuseMap');
  }

  bind(modelViewProjection: Float32List, tint: readonly [number, number, number, number] = [1, 1, 1, 1], sampler = 0): void {
    this.program.use();
    this.gl.uniformMatrix4fv(this.uniformMvp, false, modelViewProjection);
    this.gl.uniform4fv(this.uniformTint, new Float32Array(tint));
    this.gl.uniform1i(this.uniformDiffuse, sampler);
  }

  drawSurface(mesh: Md3SurfaceMesh, material?: Md3SurfaceMaterial): void {
    const sampler = material?.diffuseSampler ?? 0;
    const tint = material?.tint ?? [1, 1, 1, 1];
    this.gl.uniform4fv(this.uniformTint, new Float32Array(tint));
    this.gl.uniform1i(this.uniformDiffuse, sampler);
    mesh.bind();
    this.gl.drawElements(this.gl.TRIANGLES, mesh.indexCount, this.gl.UNSIGNED_SHORT, 0);
  }

  dispose(): void {
    this.program.dispose();
  }
}
