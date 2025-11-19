import {
  SURF_FLOWING,
  SURF_NONE,
  SURF_SKY,
  SURF_TRANS33,
  SURF_TRANS66,
  SURF_WARP,
  type SurfaceFlag,
} from '@quake2ts/shared';
import { ShaderProgram } from './shaderProgram.js';

export interface SurfaceRenderState {
  readonly alpha: number;
  readonly blend: boolean;
  readonly depthWrite: boolean;
  readonly warp: boolean;
  readonly flowOffset: readonly [number, number];
  readonly sky: boolean;
}

export interface BspSurfaceBindOptions {
  readonly modelViewProjection: Float32List;
  readonly styleIndices?: readonly number[];
  readonly styleValues?: ReadonlyArray<number>;
  readonly diffuseSampler?: number;
  readonly lightmapSampler?: number;
  readonly surfaceFlags?: SurfaceFlag;
  readonly timeSeconds?: number;
}

export const BSP_SURFACE_VERTEX_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec2 a_texCoord;
layout(location = 2) in vec2 a_lightmapCoord;

uniform mat4 u_modelViewProjection;
uniform vec2 u_texScroll;
uniform vec2 u_lightmapScroll;

out vec2 v_texCoord;
out vec2 v_lightmapCoord;

vec2 applyScroll(vec2 uv, vec2 scroll) {
  return uv + scroll;
}

void main() {
  v_texCoord = applyScroll(a_texCoord, u_texScroll);
  v_lightmapCoord = applyScroll(a_lightmapCoord, u_lightmapScroll);
  gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
}`;

export const BSP_SURFACE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;
in vec2 v_lightmapCoord;

uniform sampler2D u_diffuseMap;
uniform sampler2D u_lightmapAtlas;
uniform vec4 u_lightStyleFactors;
uniform float u_alpha;
uniform bool u_applyLightmap;
uniform bool u_warp;

out vec4 o_color;

vec2 warpCoords(vec2 uv) {
  // Quake II warp applies a subtle sinusoidal offset; we mirror the rerelease scale.
  if (!u_warp) {
    return uv;
  }
  float s = sin(uv.y * 3.14159) * 0.02;
  float t = cos(uv.x * 3.14159) * 0.02;
  return uv + vec2(s, t);
}

void main() {
  vec2 warpedTex = warpCoords(v_texCoord);
  vec4 base = texture(u_diffuseMap, warpedTex);

  if (u_applyLightmap) {
    vec3 light = texture(u_lightmapAtlas, warpCoords(v_lightmapCoord)).rgb;
    float styleScale = dot(u_lightStyleFactors, vec4(1.0));
    base.rgb *= light * styleScale;
  }

  o_color = vec4(base.rgb, base.a * u_alpha);
}`;

const DEFAULT_STYLE_INDICES: readonly number[] = [0, 255, 255, 255];

export function resolveLightStyles(
  styleIndices: readonly number[] = DEFAULT_STYLE_INDICES,
  styleValues: ReadonlyArray<number> = []
): Float32Array {
  const factors = new Float32Array(4);
  for (let i = 0; i < 4; i += 1) {
    const styleIndex = styleIndices[i] ?? 255;
    if (styleIndex === 255) {
      factors[i] = 0;
      continue;
    }
    const value = styleValues[styleIndex];
    factors[i] = value !== undefined ? value : 1;
  }
  return factors;
}

function computeFlowOffset(timeSeconds: number): readonly [number, number] {
  const cycle = (timeSeconds * 0.25) % 1;
  // Match Quake II's negative scroll direction for flowing water/conveyors.
  return [-cycle, 0];
}

export function deriveSurfaceRenderState(
  surfaceFlags: SurfaceFlag = SURF_NONE,
  timeSeconds = 0
): SurfaceRenderState {
  const flowing = (surfaceFlags & SURF_FLOWING) !== 0;
  const warp = (surfaceFlags & SURF_WARP) !== 0;
  const sky = (surfaceFlags & SURF_SKY) !== 0;
  const trans33 = (surfaceFlags & SURF_TRANS33) !== 0;
  const trans66 = (surfaceFlags & SURF_TRANS66) !== 0;

  const alpha = trans33 ? 0.33 : trans66 ? 0.66 : 1;
  const blend = trans33 || trans66;
  const depthWrite = !blend && !sky;
  const flowOffset: readonly [number, number] = flowing ? computeFlowOffset(timeSeconds) : [0, 0];

  return {
    alpha,
    blend,
    depthWrite,
    warp,
    flowOffset,
    sky,
  };
}

export class BspSurfacePipeline {
  readonly gl: WebGL2RenderingContext;
  readonly program: ShaderProgram;

  private readonly uniformMvp: WebGLUniformLocation | null;
  private readonly uniformTexScroll: WebGLUniformLocation | null;
  private readonly uniformLmScroll: WebGLUniformLocation | null;
  private readonly uniformLightStyles: WebGLUniformLocation | null;
  private readonly uniformAlpha: WebGLUniformLocation | null;
  private readonly uniformApplyLightmap: WebGLUniformLocation | null;
  private readonly uniformWarp: WebGLUniformLocation | null;
  private readonly uniformDiffuse: WebGLUniformLocation | null;
  private readonly uniformLightmap: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = ShaderProgram.create(
      gl,
      { vertex: BSP_SURFACE_VERTEX_SOURCE, fragment: BSP_SURFACE_FRAGMENT_SOURCE },
      { a_position: 0, a_texCoord: 1, a_lightmapCoord: 2 }
    );

    this.uniformMvp = this.program.getUniformLocation('u_modelViewProjection');
    this.uniformTexScroll = this.program.getUniformLocation('u_texScroll');
    this.uniformLmScroll = this.program.getUniformLocation('u_lightmapScroll');
    this.uniformLightStyles = this.program.getUniformLocation('u_lightStyleFactors');
    this.uniformAlpha = this.program.getUniformLocation('u_alpha');
    this.uniformApplyLightmap = this.program.getUniformLocation('u_applyLightmap');
    this.uniformWarp = this.program.getUniformLocation('u_warp');
    this.uniformDiffuse = this.program.getUniformLocation('u_diffuseMap');
    this.uniformLightmap = this.program.getUniformLocation('u_lightmapAtlas');
  }

  bind(options: BspSurfaceBindOptions): SurfaceRenderState {
    const {
      modelViewProjection,
      styleIndices = DEFAULT_STYLE_INDICES,
      styleValues = [],
      diffuseSampler = 0,
      lightmapSampler = 1,
      surfaceFlags = SURF_NONE,
      timeSeconds = 0,
    } = options;

    const state = deriveSurfaceRenderState(surfaceFlags, timeSeconds);
    const styles = resolveLightStyles(styleIndices, styleValues);

    this.program.use();
    this.gl.uniformMatrix4fv(this.uniformMvp, false, modelViewProjection);
    this.gl.uniform2f(this.uniformTexScroll, state.flowOffset[0], state.flowOffset[1]);
    this.gl.uniform2f(this.uniformLmScroll, state.flowOffset[0], state.flowOffset[1]);
    this.gl.uniform4fv(this.uniformLightStyles, styles);
    this.gl.uniform1f(this.uniformAlpha, state.alpha);
    this.gl.uniform1i(this.uniformApplyLightmap, state.sky ? 0 : 1);
    this.gl.uniform1i(this.uniformWarp, state.warp ? 1 : 0);
    this.gl.uniform1i(this.uniformDiffuse, diffuseSampler);
    this.gl.uniform1i(this.uniformLightmap, lightmapSampler);

    return state;
  }

  dispose(): void {
    this.program.dispose();
  }
}

export function applySurfaceState(gl: WebGL2RenderingContext, state: SurfaceRenderState): void {
  gl.depthMask(state.depthWrite);
  if (state.blend) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  } else {
    gl.disable(gl.BLEND);
  }
}
