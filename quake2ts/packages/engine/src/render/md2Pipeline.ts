import { Vec3 } from '@quake2ts/shared';
import { Md2Model } from '../assets/md2.js';
import { IndexBuffer, VertexArray, VertexBuffer } from './resources.js';
import { ShaderProgram } from './shaderProgram.js';
import { DLight, MAX_DLIGHTS } from './dlight.js';
import { generateWireframeIndices } from './geometry.js';
import { RenderModeConfig } from './frame.js';

export interface Md2DrawVertex {
  readonly vertexIndex: number;
  readonly texCoord: readonly [number, number];
}

export interface Md2Geometry {
  readonly vertices: readonly Md2DrawVertex[];
  readonly indices: Uint16Array;
}

export interface Md2FrameBlend {
  readonly frame0: number;
  readonly frame1: number;
  readonly lerp: number;
}

export interface Md2BindOptions {
  readonly modelViewProjection: Float32List;
  readonly lightDirection?: readonly [number, number, number];
  readonly ambientLight?: number;
  readonly tint?: readonly [number, number, number, number];
  readonly diffuseSampler?: number;
  readonly dlights?: readonly DLight[];
  readonly modelMatrix?: Float32List; // Needed for dlight world position calculation
  readonly renderMode?: RenderModeConfig;
  // Lighting controls
  readonly brightness?: number;
  readonly gamma?: number;
  readonly fullbright?: boolean;
  readonly ambient?: number;
}

export const MD2_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_texCoord;

struct DLight {
  vec3 position;
  vec3 color;
  float intensity;
};

const int MAX_DLIGHTS = ${MAX_DLIGHTS};

uniform mat4 u_modelViewProjection;
uniform mat4 u_modelMatrix;
uniform vec3 u_lightDir;
uniform float u_ambient;

uniform int u_numDlights;
uniform DLight u_dlights[MAX_DLIGHTS];

out vec2 v_texCoord;
out vec3 v_lightColor;
out vec3 v_position; // For faceted shading

void main() {
  vec3 normal = normalize(a_normal);

  // Directional Light (simple Lambert)
  float dotL = max(dot(normal, normalize(u_lightDir)), 0.0);
  vec3 lightAcc = vec3(min(1.0, u_ambient + dotL)); // White light assumed for directional/ambient

  // Dynamic Lights
  vec4 worldPos = u_modelMatrix * vec4(a_position, 1.0);

  for (int i = 0; i < MAX_DLIGHTS; i++) {
      if (i >= u_numDlights) break;
      DLight dlight = u_dlights[i];

      float dist = distance(worldPos.xyz, dlight.position);
      if (dist < dlight.intensity) {
         float intensity = (dlight.intensity - dist) / dlight.intensity;
         lightAcc += dlight.color * intensity;
      }
  }

  v_lightColor = lightAcc;
  v_texCoord = a_texCoord;
  v_position = worldPos.xyz;
  gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
}`;

export const MD2_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
in vec3 v_lightColor;
in vec3 v_position;

uniform sampler2D u_diffuseMap;
uniform vec4 u_tint;

uniform int u_renderMode; // 0: Textured, 1: Solid, 2: Solid Faceted
uniform vec4 u_solidColor;

// Lighting controls
uniform float u_brightness;
uniform float u_gamma;
uniform bool u_fullbright;
uniform float u_globalAmbient;

out vec4 o_color;

void main() {
  vec4 finalColor;

  if (u_renderMode == 0) {
      vec4 albedo = texture(u_diffuseMap, v_texCoord) * u_tint;

      vec3 light = v_lightColor;

      if (u_fullbright) {
          light = vec3(1.0);
      }

      // Apply global ambient min
      light = max(light, vec3(u_globalAmbient));

      light *= u_brightness;

      vec3 rgb = albedo.rgb * light;

      if (u_gamma != 1.0) {
          rgb = pow(rgb, vec3(1.0 / u_gamma));
      }

      finalColor = vec4(rgb, albedo.a);
  } else {
      vec3 color = u_solidColor.rgb;
      if (u_renderMode == 2) {
           // FACETED
           vec3 fdx = dFdx(v_position);
           vec3 fdy = dFdy(v_position);
           vec3 faceNormal = normalize(cross(fdx, fdy));
           vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
           float diff = max(dot(faceNormal, lightDir), 0.2);
           color *= diff;
      }
      finalColor = vec4(color, u_solidColor.a * u_tint.a);
  }

  o_color = finalColor;
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
  const { frame0, frame1, lerp } = blend;
  const frameA = model.frames[frame0];
  const frameB = model.frames[frame1];

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

  wireframeIndexBuffer?: IndexBuffer;
  wireframeIndexCount?: number;

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
    this.wireframeIndexBuffer?.dispose();
  }
}

export class Md2Pipeline {
  readonly gl: WebGL2RenderingContext;
  readonly program: ShaderProgram;

  private readonly uniformMvp: WebGLUniformLocation | null;
  private readonly uniformModelMatrix: WebGLUniformLocation | null;
  private readonly uniformLightDir: WebGLUniformLocation | null;
  private readonly uniformAmbient: WebGLUniformLocation | null;
  private readonly uniformTint: WebGLUniformLocation | null;
  private readonly uniformDiffuse: WebGLUniformLocation | null;

  private readonly uniformRenderMode: WebGLUniformLocation | null;
  private readonly uniformSolidColor: WebGLUniformLocation | null;

  private readonly uniformNumDlights: WebGLUniformLocation | null;
  private readonly uniformDlights: { pos: WebGLUniformLocation | null, color: WebGLUniformLocation | null, intensity: WebGLUniformLocation | null }[] = [];

  // Lighting controls
  private readonly uniformBrightness: WebGLUniformLocation | null;
  private readonly uniformGamma: WebGLUniformLocation | null;
  private readonly uniformFullbright: WebGLUniformLocation | null;
  private readonly uniformGlobalAmbient: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = ShaderProgram.create(
      gl,
      { vertex: MD2_VERTEX_SHADER, fragment: MD2_FRAGMENT_SHADER },
      { a_position: 0, a_normal: 1, a_texCoord: 2 }
    );

    this.uniformMvp = this.program.getUniformLocation('u_modelViewProjection');
    this.uniformModelMatrix = this.program.getUniformLocation('u_modelMatrix');
    this.uniformLightDir = this.program.getUniformLocation('u_lightDir');
    this.uniformAmbient = this.program.getUniformLocation('u_ambient');
    this.uniformTint = this.program.getUniformLocation('u_tint');
    this.uniformDiffuse = this.program.getUniformLocation('u_diffuseMap');

    this.uniformRenderMode = this.program.getUniformLocation('u_renderMode');
    this.uniformSolidColor = this.program.getUniformLocation('u_solidColor');

    this.uniformNumDlights = this.program.getUniformLocation('u_numDlights');
    for (let i = 0; i < MAX_DLIGHTS; i++) {
      this.uniformDlights.push({
        pos: this.program.getUniformLocation(`u_dlights[${i}].position`),
        color: this.program.getUniformLocation(`u_dlights[${i}].color`),
        intensity: this.program.getUniformLocation(`u_dlights[${i}].intensity`),
      });
    }

    this.uniformBrightness = this.program.getUniformLocation('u_brightness');
    this.uniformGamma = this.program.getUniformLocation('u_gamma');
    this.uniformFullbright = this.program.getUniformLocation('u_fullbright');
    this.uniformGlobalAmbient = this.program.getUniformLocation('u_globalAmbient');
  }

  bind(options: Md2BindOptions): void {
    const {
        modelViewProjection,
        modelMatrix,
        lightDirection = [0, 0, 1],
        ambientLight = 0.2,
        tint = [1, 1, 1, 1],
        diffuseSampler = 0,
        dlights = [],
        renderMode,
        brightness = 1.0,
        gamma = 1.0,
        fullbright = false,
        ambient = 0.0
    } = options;
    const lightVec = new Float32Array(lightDirection);
    const tintVec = new Float32Array(tint);
    this.program.use();
    this.gl.uniformMatrix4fv(this.uniformMvp, false, modelViewProjection);
    if (modelMatrix) {
        this.gl.uniformMatrix4fv(this.uniformModelMatrix, false, modelMatrix);
    } else {
        this.gl.uniformMatrix4fv(this.uniformModelMatrix, false, new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]));
    }

    this.gl.uniform3fv(this.uniformLightDir, lightVec);
    this.gl.uniform1f(this.uniformAmbient, ambientLight);
    this.gl.uniform4fv(this.uniformTint, tintVec);
    this.gl.uniform1i(this.uniformDiffuse, diffuseSampler);

    // Render Mode
    let modeInt = 0;
    let color = [1, 1, 1, 1];
    if (renderMode) {
        if (renderMode.mode === 'solid' || renderMode.mode === 'wireframe') modeInt = 1;
        else if (renderMode.mode === 'solid-faceted') modeInt = 2;

        if (renderMode.color) {
            color = [...renderMode.color];
        } else if (renderMode.generateRandomColor) {
            // Will be handled by caller passing specific color, or white here
        }
    }
    this.gl.uniform1i(this.uniformRenderMode, modeInt);
    this.gl.uniform4f(this.uniformSolidColor, color[0], color[1], color[2], color[3]);


    // Bind Dlights
    const numDlights = Math.min(dlights.length, MAX_DLIGHTS);
    this.gl.uniform1i(this.uniformNumDlights, numDlights);
    for (let i = 0; i < numDlights; i++) {
        const light = dlights[i];
        this.gl.uniform3f(this.uniformDlights[i].pos, light.origin.x, light.origin.y, light.origin.z);
        this.gl.uniform3f(this.uniformDlights[i].color, light.color.x, light.color.y, light.color.z);
        this.gl.uniform1f(this.uniformDlights[i].intensity, light.intensity);
    }

    // Lighting controls
    this.gl.uniform1f(this.uniformBrightness, brightness);
    this.gl.uniform1f(this.uniformGamma, gamma);
    this.gl.uniform1i(this.uniformFullbright, fullbright ? 1 : 0);
    this.gl.uniform1f(this.uniformGlobalAmbient, ambient);
  }

  draw(mesh: Md2MeshBuffers, renderMode?: RenderModeConfig): void {
    mesh.vertexArray.bind();

    if (renderMode && renderMode.mode === 'wireframe') {
         if (!mesh.wireframeIndexBuffer) {
             mesh.wireframeIndexBuffer = new IndexBuffer(this.gl, this.gl.STATIC_DRAW);
             const wireIndices = generateWireframeIndices(mesh.geometry.indices);
             mesh.wireframeIndexBuffer.upload(wireIndices as unknown as BufferSource);
             mesh.wireframeIndexCount = wireIndices.length;
         }
         mesh.wireframeIndexBuffer.bind();
         this.gl.drawElements(this.gl.LINES, mesh.wireframeIndexCount!, this.gl.UNSIGNED_SHORT, 0);
    } else {
         mesh.indexBuffer.bind();
         this.gl.drawElements(this.gl.TRIANGLES, mesh.indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
  }

  dispose(): void {
    this.program.dispose();
  }
}
