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
import { DLight, MAX_DLIGHTS } from './dlight.js';
import { RenderModeConfig, RenderMode } from './frame.js';
import { BspSurfaceGeometry } from './bsp.js';
import { IndexBuffer } from './resources.js';
import { generateWireframeIndices } from './geometry.js';

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
  readonly texScroll?: readonly [number, number];
  readonly alpha?: number;
  readonly warp?: boolean;
  readonly dlights?: readonly DLight[];
  readonly renderMode?: RenderModeConfig;
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
out vec3 v_position;

vec2 applyScroll(vec2 uv, vec2 scroll) {
  return uv + scroll;
}

void main() {
  v_texCoord = applyScroll(a_texCoord, u_texScroll);
  v_lightmapCoord = applyScroll(a_lightmapCoord, u_lightmapScroll);
  v_position = a_position;
  gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
}`;

export const BSP_SURFACE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

struct DLight {
  vec3 position;
  vec3 color;
  float intensity;
};

const int MAX_DLIGHTS = ${MAX_DLIGHTS};

in vec2 v_texCoord;
in vec2 v_lightmapCoord;
in vec3 v_position;

uniform sampler2D u_diffuseMap;
uniform sampler2D u_lightmapAtlas;
uniform vec4 u_lightStyleFactors;
uniform float u_alpha;
uniform bool u_applyLightmap;
uniform bool u_warp;
uniform float u_time;

uniform int u_renderMode; // 0: Textured, 1: Solid, 2: Solid Faceted
uniform vec4 u_solidColor;

uniform int u_numDlights;
uniform DLight u_dlights[MAX_DLIGHTS];

out vec4 o_color;

vec2 warpCoords(vec2 uv) {
  if (!u_warp) {
    return uv;
  }
  float s = uv.x + sin(uv.y * 0.125 + u_time) * 0.125;
  float t = uv.y + sin(uv.x * 0.125 + u_time) * 0.125;
  return vec2(s, t);
}

void main() {
  vec4 finalColor;

  if (u_renderMode == 0) {
      // TEXTURED MODE
      vec2 warpedTex = warpCoords(v_texCoord);
      vec4 base = texture(u_diffuseMap, warpedTex);

      vec3 totalLight = vec3(1.0);

      if (u_applyLightmap) {
        vec3 light = texture(u_lightmapAtlas, warpCoords(v_lightmapCoord)).rgb;
        float styleScale = dot(u_lightStyleFactors, vec4(1.0));
        totalLight = light * styleScale;

        // Add dynamic lights
        for (int i = 0; i < MAX_DLIGHTS; i++) {
          if (i >= u_numDlights) break;
          DLight dlight = u_dlights[i];

          float dist = distance(v_position, dlight.position);
          if (dist < dlight.intensity) {
             float intensity = (dlight.intensity - dist) / dlight.intensity;
             totalLight += dlight.color * intensity;
          }
        }
      }

      base.rgb *= totalLight;
      finalColor = vec4(base.rgb, base.a * u_alpha);
  } else {
      // SOLID / WIREFRAME / FACETED
      vec3 color = u_solidColor.rgb;
      if (u_renderMode == 2) {
          // FACETED: simple lighting based on face normal
          vec3 fdx = dFdx(v_position);
          vec3 fdy = dFdy(v_position);
          vec3 faceNormal = normalize(cross(fdx, fdy));

          // Simple directional light from "camera" or fixed
          vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
          float diff = max(dot(faceNormal, lightDir), 0.2); // Ambient 0.2
          color *= diff;
      }
      finalColor = vec4(color, u_solidColor.a * u_alpha);
  }

  o_color = finalColor;
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

// Extend BspSurfaceGeometry to include wireframe index buffer
declare module './bsp.js' {
    interface BspSurfaceGeometry {
        wireframeIndexBuffer?: IndexBuffer;
        wireframeIndexCount?: number;
    }
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
  private readonly uniformTime: WebGLUniformLocation | null;

  private readonly uniformRenderMode: WebGLUniformLocation | null;
  private readonly uniformSolidColor: WebGLUniformLocation | null;

  private readonly uniformNumDlights: WebGLUniformLocation | null;
  private readonly uniformDlights: { pos: WebGLUniformLocation | null, color: WebGLUniformLocation | null, intensity: WebGLUniformLocation | null }[] = [];


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
    this.uniformTime = this.program.getUniformLocation('u_time');

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
  }

  bind(options: BspSurfaceBindOptions): SurfaceRenderState {
    const {
      modelViewProjection,
      styleIndices = DEFAULT_STYLE_INDICES,
      styleValues = [],
      diffuseSampler = 0,
      lightmapSampler,
      surfaceFlags = SURF_NONE,
      timeSeconds = 0,
      texScroll,
      alpha,
      warp,
      dlights = [],
      renderMode
    } = options;

    const state = deriveSurfaceRenderState(surfaceFlags, timeSeconds);
    const styles = resolveLightStyles(styleIndices, styleValues);

    const finalScrollX = texScroll ? texScroll[0] : state.flowOffset[0];
    const finalScrollY = texScroll ? texScroll[1] : state.flowOffset[1];
    const finalAlpha = alpha !== undefined ? alpha : state.alpha;
    const finalWarp = warp !== undefined ? warp : state.warp;

    this.program.use();
    this.gl.uniformMatrix4fv(this.uniformMvp, false, modelViewProjection);
    this.gl.uniform2f(this.uniformTexScroll, finalScrollX, finalScrollY);
    this.gl.uniform2f(this.uniformLmScroll, state.flowOffset[0], state.flowOffset[1]);
    this.gl.uniform4fv(this.uniformLightStyles, styles);
    this.gl.uniform1f(this.uniformAlpha, finalAlpha);
    const applyLightmap = !state.sky && lightmapSampler !== undefined;
    this.gl.uniform1i(this.uniformApplyLightmap, applyLightmap ? 1 : 0);
    this.gl.uniform1i(this.uniformWarp, finalWarp ? 1 : 0);
    this.gl.uniform1f(this.uniformTime, timeSeconds);
    this.gl.uniform1i(this.uniformDiffuse, diffuseSampler);
    this.gl.uniform1i(this.uniformLightmap, lightmapSampler ?? 0);

    // Render Mode Logic
    let modeInt = 0; // Textured
    let color = [1, 1, 1, 1];

    if (renderMode) {
      if (renderMode.mode === 'solid' || renderMode.mode === 'wireframe') {
          modeInt = 1; // Solid
      } else if (renderMode.mode === 'solid-faceted') {
          modeInt = 2; // Faceted
      }

      if (renderMode.color) {
          color = [...renderMode.color];
      } else if (renderMode.generateRandomColor) {
         // Generate based on something? For map surfaces, we don't have a unique ID passed here easily yet.
         // Maybe just white default if not specified.
         color = [1, 1, 1, 1];
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

    return state;
  }

  draw(geometry: BspSurfaceGeometry, renderMode?: RenderModeConfig): void {
      geometry.vao.bind();

      if (renderMode && renderMode.mode === 'wireframe') {
          // Lazy init wireframe buffer
          if (!geometry.wireframeIndexBuffer) {
              // We need to cast back to mutable because we are augmenting the object at runtime
              const mutableGeometry = geometry as any;
              mutableGeometry.wireframeIndexBuffer = new IndexBuffer(this.gl, this.gl.STATIC_DRAW);
              const wireIndices = generateWireframeIndices(geometry.indexData);
              mutableGeometry.wireframeIndexBuffer.upload(wireIndices as unknown as BufferSource);
              mutableGeometry.wireframeIndexCount = wireIndices.length;
          }

          geometry.wireframeIndexBuffer!.bind();
          this.gl.drawElements(this.gl.LINES, geometry.wireframeIndexCount!, this.gl.UNSIGNED_SHORT, 0);
      } else {
          geometry.indexBuffer.bind();
          this.gl.drawElements(this.gl.TRIANGLES, geometry.indexCount, this.gl.UNSIGNED_SHORT, 0);
      }
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
