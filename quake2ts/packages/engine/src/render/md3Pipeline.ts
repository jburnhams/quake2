import { Mat4, Vec3, mat4FromBasis, normalizeVec3, transformPointMat4 } from '@quake2ts/shared';
import { Md3Model, Md3Surface } from '../assets/md3.js';
import { IndexBuffer, VertexArray, VertexBuffer } from './resources.js';
import { ShaderProgram } from './shaderProgram.js';
import { RenderModeConfig } from './frame.js';
import { generateWireframeIndices } from './geometry.js';
import { CameraState } from './types/camera.js';
import { WebGLMatrixBuilder } from './matrix/webgl.js';
import { buildMatrices } from './matrix/builders.js';
import { mat4 } from 'gl-matrix';

export interface Md3DrawVertex {
  readonly vertexIndex: number;
  readonly texCoord: readonly [number, number];
}

export interface Md3SurfaceGeometry {
  readonly vertices: readonly Md3DrawVertex[];
  readonly indices: Uint16Array;
}

export interface Md3FrameBlend {
  readonly frame0: number;
  readonly frame1: number;
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
  readonly renderMode?: RenderModeConfig;
  readonly brightness?: number;
  readonly gamma?: number;
  readonly fullbright?: boolean;
  readonly globalAmbient?: number;
}

export interface Md3BindOptions {
  readonly cameraState: CameraState; // Required for native coordinate system rendering
  readonly modelViewProjection?: Float32List; // Optional override, prefer CameraState
  readonly modelMatrix?: Float32List; // For transforming the model
  readonly tint?: readonly [number, number, number, number];
  readonly diffuseSampler?: number;
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
        // Compute dot product with direction to this specific dynamic light
        const dist = Math.sqrt(distSq);
        const lightDotN = dist > 0 ? clamp01(-(dx * n.x + dy * n.y + dz * n.z) / dist) : 0;
        const amount = clamp01(attenuation * lightDotN);
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
  const frameA = surface.vertices[blend.frame0];
  const frameB = surface.vertices[blend.frame1];

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

  const tagA = model.tags[blend.frame0]?.[tagIndex];
  const tagB = model.tags[blend.frame1]?.[tagIndex];
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
out vec3 v_position;

void main() {
  v_texCoord = a_texCoord;
  v_color = a_color;
  v_position = a_position; // Model space, assuming single mesh pass
  gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
}`;

export const MD3_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
in vec4 v_color;
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

      vec3 light = v_color.rgb;
      if (u_fullbright) {
          light = vec3(1.0);
      }
      light = max(light, vec3(u_globalAmbient));
      light *= u_brightness;

      vec3 rgb = albedo.rgb * light;

      if (u_gamma != 1.0) {
          rgb = pow(rgb, vec3(1.0 / u_gamma));
      }

      finalColor = vec4(rgb, albedo.a * v_color.a);
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

export class Md3SurfaceMesh {
  readonly gl: WebGL2RenderingContext;
  readonly geometry: Md3SurfaceGeometry;
  readonly vertexBuffer: VertexBuffer;
  readonly indexBuffer: IndexBuffer;
  readonly vertexArray: VertexArray;
  readonly indexCount: number;

  wireframeIndexBuffer?: IndexBuffer;
  wireframeIndexCount?: number;

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
    this.wireframeIndexBuffer?.dispose();
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
  private matrixBuilder = new WebGLMatrixBuilder();

  private readonly uniformMvp: WebGLUniformLocation | null;
  private readonly uniformTint: WebGLUniformLocation | null;
  private readonly uniformDiffuse: WebGLUniformLocation | null;

  private readonly uniformRenderMode: WebGLUniformLocation | null;
  private readonly uniformSolidColor: WebGLUniformLocation | null;

  // Lighting controls
  private readonly uniformBrightness: WebGLUniformLocation | null;
  private readonly uniformGamma: WebGLUniformLocation | null;
  private readonly uniformFullbright: WebGLUniformLocation | null;
  private readonly uniformGlobalAmbient: WebGLUniformLocation | null;

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

    this.uniformRenderMode = this.program.getUniformLocation('u_renderMode');
    this.uniformSolidColor = this.program.getUniformLocation('u_solidColor');

    this.uniformBrightness = this.program.getUniformLocation('u_brightness');
    this.uniformGamma = this.program.getUniformLocation('u_gamma');
    this.uniformFullbright = this.program.getUniformLocation('u_fullbright');
    this.uniformGlobalAmbient = this.program.getUniformLocation('u_globalAmbient');
  }

  get shaderSize(): number {
    return this.program.sourceSize;
  }

  bind(options: Md3BindOptions): void {
    const {
      cameraState,
      modelViewProjection: overrideMvp,
      modelMatrix,
      tint = [1, 1, 1, 1],
      diffuseSampler = 0
    } = options;

    // Build matrices from CameraState unless override provided
    let mvp: Float32List;
    if (overrideMvp) {
      mvp = overrideMvp;
    } else {
      const matrices = buildMatrices(this.matrixBuilder, cameraState);
      // If modelMatrix is provided, combine it: MVP = P * V * M
      if (modelMatrix) {
        const result = mat4.create();
        mat4.multiply(result, matrices.viewProjection as mat4, modelMatrix as mat4);
        mvp = result as Float32Array;
      } else {
        mvp = matrices.viewProjection as Float32Array;
      }
    }

    this.program.use();
    this.gl.uniformMatrix4fv(this.uniformMvp, false, mvp);
    this.gl.uniform4fv(this.uniformTint, new Float32Array(tint));
    this.gl.uniform1i(this.uniformDiffuse, diffuseSampler);

    // Default mode for simple bind
    this.gl.uniform1i(this.uniformRenderMode, 0);
    this.gl.uniform4f(this.uniformSolidColor, 1, 1, 1, 1);
  }

  drawSurface(mesh: Md3SurfaceMesh, material?: Md3SurfaceMaterial): void {
    const sampler = material?.diffuseSampler ?? 0;
    const tint = material?.tint ?? [1, 1, 1, 1];
    const renderMode = material?.renderMode;

    // Lighting controls from material (which propagates from pipeline bind if structure allows,
    // but here we are in draw call. We need access to the lighting state set in bind?
    // The problem is Md3Pipeline doesn't have a comprehensive 'bind' method that takes everything.
    // It has bind(mvp) and drawSurface(mesh, material).
    // The caller (renderer.ts) iterates surfaces and calls drawSurface.
    // So we should probably update drawSurface or bind to accept lighting params.
    // Or add a separate setLighting method.
    // For now, let's pass them via material if possible, or assume they were set globally.
    // But drawSurface sets uniforms...
    // Actually, bind() sets MVP and resets some state.
    // We should probably pass lighting to bind() or add setLightingState.
    // Let's modify bind() signature to be more comprehensive or add a separate method.
    // Since we are modifying Md3Pipeline class, let's update `bind` to take lighting options.

    // However, drawSurface also sets uniforms.
    // Wait, the uniforms I added (brightness etc) are on the program.
    // If I set them in `bind`, they persist until `use` is called again or another program is used.
    // Since drawSurface assumes program is used, it should be fine.

    const brightness = material?.brightness ?? 1.0;
    const gamma = material?.gamma ?? 1.0;
    const fullbright = material?.fullbright ?? false;
    const globalAmbient = material?.globalAmbient ?? 0.0;

    this.gl.uniform4fv(this.uniformTint, new Float32Array(tint));
    this.gl.uniform1i(this.uniformDiffuse, sampler);

    // Render Mode
    let modeInt = 0;
    let color = [1, 1, 1, 1];
    if (renderMode) {
        if (renderMode.mode === 'solid' || renderMode.mode === 'wireframe') modeInt = 1;
        else if (renderMode.mode === 'solid-faceted') modeInt = 2;

        if (renderMode.color) {
            color = [...renderMode.color];
        }
    }
    this.gl.uniform1i(this.uniformRenderMode, modeInt);
    this.gl.uniform4f(this.uniformSolidColor, color[0], color[1], color[2], color[3]);

    this.gl.uniform1f(this.uniformBrightness, brightness);
    this.gl.uniform1f(this.uniformGamma, gamma);
    this.gl.uniform1i(this.uniformFullbright, fullbright ? 1 : 0);
    this.gl.uniform1f(this.uniformGlobalAmbient, globalAmbient);

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
