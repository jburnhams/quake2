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
  // The cube vertices (a_position) are in GL space (-1 to 1, standard OpenGL cube).
  // The viewProjection matrix expects Quake-space input (it contains Quake-to-GL transform).
  // So we must transform GL -> Quake before applying the view matrix.
  //
  // GL-to-Quake mapping (inverse of Quake-to-GL):
  // GL -Z -> Quake +X (forward)
  // GL -X -> Quake +Y (left)
  // GL +Y -> Quake +Z (up)
  // So: (gl.x, gl.y, gl.z) -> (-gl.z, -gl.x, gl.y)
  vec3 quakePos = vec3(-a_position.z, -a_position.x, a_position.y);
  vec4 pos = u_viewProjectionNoTranslation * vec4(quakePos, 1.0);
  // Force z = w to render at far plane, avoiding clipping issues
  // for triangles that intersect the camera plane
  gl_Position = pos.xyww;

  // For cubemap sampling, use the original GL-space position since
  // WebGL cubemap targets (POSITIVE_X, etc.) are in GL conventions.
  vec3 dir = a_position;

  // Apply scroll offset for animated skies
  dir.xy += u_scroll;
  v_direction = dir;
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
    // Enable depth testing with LEQUAL - skybox renders at z=1.0 (far plane)
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
    this.gl.depthMask(false);
    // Disable face culling - we're inside the cube looking out
    this.gl.disable(this.gl.CULL_FACE);
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
