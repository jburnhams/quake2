import { ShaderProgram } from './shaderProgram.js';
import { TextureCubeMap, VertexArray, VertexBuffer, type VertexAttributeLayout } from './resources.js';
import type { ReadonlyMat4 } from 'gl-matrix';

const SKYBOX_POSITIONS = new Float32Array([
  // Front
  -1, -1, 1,
  1, -1, 1,
  1, 1, 1,
  -1, -1, 1,
  1, 1, 1,
  -1, 1, 1,
  // Back
  -1, -1, -1,
  -1, 1, -1,
  1, 1, -1,
  -1, -1, -1,
  1, 1, -1,
  1, -1, -1,
  // Left
  -1, -1, -1,
  -1, -1, 1,
  -1, 1, 1,
  -1, -1, -1,
  -1, 1, 1,
  -1, 1, -1,
  // Right
  1, -1, -1,
  1, 1, -1,
  1, 1, 1,
  1, -1, -1,
  1, 1, 1,
  1, -1, 1,
  // Top
  -1, 1, -1,
  -1, 1, 1,
  1, 1, 1,
  -1, 1, -1,
  1, 1, 1,
  1, 1, -1,
  // Bottom
  -1, -1, -1,
  1, -1, -1,
  1, -1, 1,
  -1, -1, -1,
  1, -1, 1,
  -1, -1, 1,
]);

export const SKYBOX_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;

uniform mat4 u_viewProjectionNoTranslation;
uniform vec2 u_scroll;

out vec3 v_direction;

void main() {
  // Transform Quake-space position/direction to GL-space direction for cubemap sampling.
  // Quake Basis: X(Fwd), Y(Left), Z(Up)
  // GL Basis (Cubemap): -Z(Front), -X(Left), +Y(Top)
  // Mapping:
  // Quake X (1,0,0) -> GL -Z (0,0,-1)
  // Quake Y (0,1,0) -> GL -X (-1,0,0)
  // Quake Z (0,0,1) -> GL Y  (0,1,0)
  vec3 dir = vec3(-a_position.y, a_position.z, -a_position.x);

  // Normalize just in case, though a_position is on a cube surface.
  // Actually, for a cubemap lookup, normalization isn't strictly required by the hardware
  // (it grabs the vector direction), but good practice if we modify it.
  dir = normalize(dir);

  dir.xy += u_scroll;
  v_direction = dir;
  gl_Position = u_viewProjectionNoTranslation * vec4(a_position, 1.0);
}`;

export const SKYBOX_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_direction;
uniform samplerCube u_skybox;

out vec4 o_color;

void main() {
  o_color = texture(u_skybox, v_direction);
}`;

export interface SkyboxBindOptions {
  readonly viewProjection: Float32List;
  readonly scroll: readonly [number, number];
  readonly textureUnit?: number;
}

export class SkyboxPipeline {
  readonly gl: WebGL2RenderingContext;
  readonly program: ShaderProgram;
  readonly vao: VertexArray;
  readonly vbo: VertexBuffer;
  readonly cubemap: TextureCubeMap;

  private readonly uniformViewProj: WebGLUniformLocation | null;
  private readonly uniformScroll: WebGLUniformLocation | null;
  private readonly uniformSampler: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = ShaderProgram.create(
      gl,
      { vertex: SKYBOX_VERTEX_SHADER, fragment: SKYBOX_FRAGMENT_SHADER },
      { a_position: 0 }
    );

    this.vao = new VertexArray(gl);
    this.vbo = new VertexBuffer(gl, gl.STATIC_DRAW);
    this.vbo.upload(SKYBOX_POSITIONS, gl.STATIC_DRAW);

    const layout: VertexAttributeLayout[] = [{ index: 0, size: 3, type: gl.FLOAT, stride: 12, offset: 0 }];
    this.vao.configureAttributes(layout, this.vbo);

    this.uniformViewProj = this.program.getUniformLocation('u_viewProjectionNoTranslation');
    this.uniformScroll = this.program.getUniformLocation('u_scroll');
    this.uniformSampler = this.program.getUniformLocation('u_skybox');

    this.cubemap = new TextureCubeMap(gl);
    this.cubemap.setParameters({
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
  }

  get shaderSize(): number {
    return this.program.sourceSize;
  }

  bind(options: SkyboxBindOptions): void {
    const { viewProjection, scroll, textureUnit = 0 } = options;
    this.program.use();
    this.gl.depthMask(false);
    this.gl.uniformMatrix4fv(this.uniformViewProj, false, viewProjection);
    this.gl.uniform2f(this.uniformScroll, scroll[0], scroll[1]);
    this.gl.uniform1i(this.uniformSampler, textureUnit);
    this.cubemap.bind(textureUnit);
    this.vao.bind();
  }

  draw(): void {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, SKYBOX_POSITIONS.length / 3);
  }

  dispose(): void {
    this.vbo.dispose();
    this.vao.dispose();
    this.cubemap.dispose();
    this.program.dispose();
  }
}

export function removeViewTranslation(viewMatrix: ReadonlyMat4 | Float32Array): Float32Array {
  const noTranslation = new Float32Array(viewMatrix);
  noTranslation[12] = 0;
  noTranslation[13] = 0;
  noTranslation[14] = 0;
  return noTranslation;
}

export function computeSkyScroll(timeSeconds: number, scrollSpeeds: readonly [number, number] = [0.01, 0.02]): [number, number] {
  const [sx, sy] = scrollSpeeds;
  return [sx * timeSeconds, sy * timeSeconds];
}
