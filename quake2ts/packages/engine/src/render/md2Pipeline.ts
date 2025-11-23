import { Vec3 } from '@quake2ts/shared';
import { Md2Model } from '../assets/md2.js';
import { IndexBuffer, VertexArray, VertexBuffer } from './resources.js';
import { ShaderProgram } from './shaderProgram.js';

export interface Md2DrawVertex {
  readonly vertexIndex: number;
  readonly texCoord: readonly [number, number];
}

export interface Md2Geometry {
  readonly vertices: readonly Md2DrawVertex[];
  readonly indices: Uint16Array;
}

export interface Md2FrameBlend {
  readonly currentFrame: number;
  readonly nextFrame: number;
  readonly lerp: number;
}

export interface Md2BindOptions {
  readonly modelViewProjection: Float32List;
  readonly lightDirection?: readonly [number, number, number];
  readonly ambientLight?: number;
  readonly tint?: readonly [number, number, number, number];
  readonly diffuseSampler?: number;
}

export const MD2_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_texCoord;

uniform mat4 u_modelViewProjection;
uniform vec3 u_lightDir;
uniform float u_ambient;

out vec2 v_texCoord;
out float v_light;

void main() {
  vec3 normal = normalize(a_normal);
  float dot = max(dot(normal, normalize(u_lightDir)), 0.0);
  v_light = min(1.0, u_ambient + dot);
  v_texCoord = a_texCoord;
  gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
}`;

export const MD2_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
in float v_light;

uniform sampler2D u_diffuseMap;
uniform vec4 u_tint;

out vec4 o_color;

void main() {
  vec4 albedo = texture(u_diffuseMap, v_texCoord) * u_tint;
  o_color = vec4(albedo.rgb * v_light, albedo.a);
}`;

function normalizeVec3(v: Vec3): Vec3 {
  const lengthSq = v.x * v.x + v.y * v.y + v.z * v.z;
  if (lengthSq <= 0) {
    return { x: 0, y: 0, z: 1 };
  }
  const inv = 1 / Math.sqrt(lengthSq);
  return { x: v.x * inv, y: v.y * inv, z: v.z * inv };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function normalizeUv(s: number, t: number, header: Md2Model['header']): readonly [number, number] {
  return [s / header.skinWidth, 1 - t / header.skinHeight];
}

export function buildMd2Geometry(model: Md2Model): Md2Geometry {
  if (model.glCommands.length === 0) {
    const vertices: Md2DrawVertex[] = [];
    const indices: number[] = [];
    model.triangles.forEach((triangle) => {
      const baseIndex = vertices.length;
      for (let i = 0; i < 3; i += 1) {
        const vertexIndex = triangle.vertexIndices[i];
        const texCoordIndex = triangle.texCoordIndices[i];
        const texCoord = model.texCoords[texCoordIndex];
        vertices.push({
          vertexIndex,
          texCoord: normalizeUv(texCoord.s, texCoord.t, model.header),
        });
      }
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    });

    return { vertices, indices: new Uint16Array(indices) };
  }

  const vertices: Md2DrawVertex[] = [];
  const indices: number[] = [];

  for (const command of model.glCommands) {
    const start = vertices.length;
    vertices.push(
      ...command.vertices.map((vertex) => ({
        vertexIndex: vertex.vertexIndex,
        texCoord: [vertex.s, 1 - vertex.t] as const,
      }))
    );

    if (command.mode === 'strip') {
      for (let i = 0; i < command.vertices.length - 2; i += 1) {
        const even = i % 2 === 0;
        const a = start + i + (even ? 0 : 1);
        const b = start + i + (even ? 1 : 0);
        const c = start + i + 2;
        indices.push(a, b, c);
      }
    } else {
      for (let i = 1; i < command.vertices.length - 1; i += 1) {
        indices.push(start, start + i, start + i + 1);
      }
    }
  }

  return { vertices, indices: new Uint16Array(indices) };
}

export function buildMd2VertexData(
  model: Md2Model,
  geometry: Md2Geometry,
  blend: Md2FrameBlend
): Float32Array {
  const { currentFrame, nextFrame, lerp } = blend;
  const frameA = model.frames[currentFrame];
  const frameB = model.frames[nextFrame];

  if (!frameA || !frameB) {
    throw new Error('Requested MD2 frames are out of range');
  }

  const data = new Float32Array(geometry.vertices.length * 8);
  geometry.vertices.forEach((vertex, index) => {
    const vA = frameA.vertices[vertex.vertexIndex];
    const vB = frameB.vertices[vertex.vertexIndex];
    if (!vA || !vB) {
      throw new Error('MD2 vertex index out of range for frame');
    }

    const position = lerpVec3(vA.position, vB.position, lerp);
    const normal = normalizeVec3(lerpVec3(vA.normal, vB.normal, lerp));

    const base = index * 8;
    data[base] = position.x;
    data[base + 1] = position.y;
    data[base + 2] = position.z;
    data[base + 3] = normal.x;
    data[base + 4] = normal.y;
    data[base + 5] = normal.z;
    data[base + 6] = vertex.texCoord[0];
    data[base + 7] = vertex.texCoord[1];
  });

  return data;
}

export class Md2MeshBuffers {
  readonly gl: WebGL2RenderingContext;
  readonly geometry: Md2Geometry;
  readonly vertexBuffer: VertexBuffer;
  readonly indexBuffer: IndexBuffer;
  readonly vertexArray: VertexArray;
  readonly indexCount: number;

  constructor(gl: WebGL2RenderingContext, model: Md2Model, blend: Md2FrameBlend) {
    this.gl = gl;
    this.geometry = buildMd2Geometry(model);
    this.vertexBuffer = new VertexBuffer(gl, gl.STATIC_DRAW);
    this.indexBuffer = new IndexBuffer(gl, gl.STATIC_DRAW);
    this.vertexArray = new VertexArray(gl);
    this.indexCount = this.geometry.indices.length;

    this.vertexArray.configureAttributes(
      [
        { index: 0, size: 3, type: gl.FLOAT, stride: 32, offset: 0 },
        { index: 1, size: 3, type: gl.FLOAT, stride: 32, offset: 12 },
        { index: 2, size: 2, type: gl.FLOAT, stride: 32, offset: 24 },
      ],
      this.vertexBuffer
    );

    this.vertexArray.bind();
    this.indexBuffer.bind();
    this.indexBuffer.upload(this.geometry.indices as unknown as BufferSource, gl.STATIC_DRAW);
    this.update(model, blend);
  }

  update(model: Md2Model, blend: Md2FrameBlend): void {
    const data = buildMd2VertexData(model, this.geometry, blend);
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

export class Md2Pipeline {
  readonly gl: WebGL2RenderingContext;
  readonly program: ShaderProgram;

  private readonly uniformMvp: WebGLUniformLocation | null;
  private readonly uniformLightDir: WebGLUniformLocation | null;
  private readonly uniformAmbient: WebGLUniformLocation | null;
  private readonly uniformTint: WebGLUniformLocation | null;
  private readonly uniformDiffuse: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = ShaderProgram.create(
      gl,
      { vertex: MD2_VERTEX_SHADER, fragment: MD2_FRAGMENT_SHADER },
      { a_position: 0, a_normal: 1, a_texCoord: 2 }
    );

    this.uniformMvp = this.program.getUniformLocation('u_modelViewProjection');
    this.uniformLightDir = this.program.getUniformLocation('u_lightDir');
    this.uniformAmbient = this.program.getUniformLocation('u_ambient');
    this.uniformTint = this.program.getUniformLocation('u_tint');
    this.uniformDiffuse = this.program.getUniformLocation('u_diffuseMap');
  }

  bind(options: Md2BindOptions): void {
    const { modelViewProjection, lightDirection = [0, 0, 1], ambientLight = 0.2, tint = [1, 1, 1, 1], diffuseSampler = 0 } = options;
    const lightVec = new Float32Array(lightDirection);
    const tintVec = new Float32Array(tint);
    this.program.use();
    this.gl.uniformMatrix4fv(this.uniformMvp, false, modelViewProjection);
    this.gl.uniform3fv(this.uniformLightDir, lightVec);
    this.gl.uniform1f(this.uniformAmbient, ambientLight);
    this.gl.uniform4fv(this.uniformTint, tintVec);
    this.gl.uniform1i(this.uniformDiffuse, diffuseSampler);
  }

  draw(mesh: Md2MeshBuffers): void {
    mesh.bind();
    this.gl.drawElements(this.gl.TRIANGLES, mesh.indexCount, this.gl.UNSIGNED_SHORT, 0);
  }

  dispose(): void {
    this.program.dispose();
  }
}
