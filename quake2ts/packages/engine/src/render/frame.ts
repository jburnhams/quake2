import type { BspMap } from '../assets/bsp.js';
import { applySurfaceState, BspSurfacePipeline } from './bspPipeline.js';
import { gatherVisibleFaces, type VisibleFace } from './bspTraversal.js';
import { extractFrustumPlanes } from './culling.js';
import { Camera } from './camera.js';
import type { BspSurfaceGeometry, LightmapAtlas } from './bsp.js';
import { Texture2D } from './resources.js';
import { IRenderer, FrameRenderOptions } from './interface.js';
import type { MaterialManager } from './materials.js';
import {
  computeSkyScroll,
  removeViewTranslation,
  SkyboxPipeline,
  type SkyboxBindOptions,
} from './skybox.js';
import { mat4 } from 'gl-matrix';
import { SURF_SKY, SURF_TRANS33, SURF_TRANS66, SURF_WARP } from '@quake2ts/shared';
import { DLight } from './dlight.js';
import { PostProcessPipeline } from './postProcess.js';
import { BloomPipeline } from './bloom.js';

export { FrameRenderStats };

interface SkyRenderState {
  readonly scrollSpeeds?: readonly [number, number];
  readonly textureUnit?: number;
}

export interface ViewModelRenderState {
  readonly fov?: number;
  readonly depthRange?: readonly [number, number];
  readonly draw: (viewProjection: Float32Array) => void;
}

interface FrameRenderStats {
  batches: number;
  facesDrawn: number;
  drawCalls: number;
  skyDrawn: boolean;
  viewModelDrawn: boolean;
  fps: number;
  vertexCount: number;
}

export interface WorldRenderState {
  readonly map: BspMap;
  readonly surfaces: readonly BspSurfaceGeometry[];
  readonly lightmaps?: readonly LightmapAtlas[];
  readonly textures?: ReadonlyMap<string, Texture2D>;
  readonly materials?: MaterialManager;
  readonly lightStyles?: ReadonlyArray<number>;
}

export type RenderMode = 'textured' | 'wireframe' | 'solid' | 'solid-faceted';

export interface RenderModeConfig {
  readonly mode: RenderMode;
  readonly applyToAll: boolean; // if false, only applies to missing textures
  readonly color?: readonly [number, number, number, number]; // Global override color
  readonly generateRandomColor?: boolean; // If true, generates color from entity ID
}

// Internal renderer-specific options interface
export interface FrameRenderOptionsInternal extends FrameRenderOptions {
  readonly camera: Camera;
  readonly world?: WorldRenderState;
  readonly sky?: SkyRenderState;
  readonly viewModel?: ViewModelRenderState;
  readonly dlights?: readonly DLight[];
  readonly timeSeconds?: number;
  readonly deltaTime?: number;
  readonly clearColor?: readonly [number, number, number, number];
  readonly renderMode?: RenderModeConfig;
  readonly disableLightmaps?: boolean; // New option to toggle lightmaps
  readonly lightmapOnly?: boolean;
  readonly brightness?: number;
  readonly gamma?: number;
  readonly fullbright?: boolean;
  readonly ambient?: number;
  readonly lightStyleOverrides?: Map<number, string>; // Pattern overrides
  readonly waterTint?: readonly [number, number, number, number]; // New option for underwater tint
  readonly underwaterWarp?: boolean; // Enable underwater distortion
  readonly bloom?: boolean; // Enable bloom
  readonly bloomIntensity?: number; // Bloom intensity (default 0.5)
}

interface FrameRendererDependencies {
  readonly gatherVisibleFaces: typeof gatherVisibleFaces;
  readonly extractFrustumPlanes: typeof extractFrustumPlanes;
  readonly computeSkyScroll: typeof computeSkyScroll;
  readonly removeViewTranslation: typeof removeViewTranslation;
}

const DEFAULT_DEPS: FrameRendererDependencies = {
  gatherVisibleFaces,
  extractFrustumPlanes,
  computeSkyScroll,
  removeViewTranslation,
};

function renderSky(
  skyboxPipeline: SkyboxPipeline,
  camera: Camera,
  timeSeconds: number,
  options: SkyRenderState | undefined,
  deps: FrameRendererDependencies
): void {
  if (!options) {
    return;
  }

  const viewNoTranslation = deps.removeViewTranslation(camera.viewMatrix);
  const skyViewProjection = mat4.create();
  mat4.multiply(skyViewProjection, camera.projectionMatrix, viewNoTranslation);

  const scroll = deps.computeSkyScroll(timeSeconds, options.scrollSpeeds ?? [0.01, 0.02]);
  skyboxPipeline.bind({
    viewProjection: skyViewProjection as Float32Array,
    scroll,
    textureUnit: options.textureUnit ?? 0,
  } satisfies SkyboxBindOptions);
  skyboxPipeline.draw();

  // Ensure subsequent passes can write depth.
  skyboxPipeline.gl.depthMask(true);
}

// Front-to-back sorting for opaque surfaces
function sortVisibleFacesFrontToBack(faces: readonly VisibleFace[]): VisibleFace[] {
  return [...faces].sort((a, b) => b.sortKey - a.sortKey);
}

// Back-to-front sorting for transparent surfaces
function sortVisibleFacesBackToFront(faces: readonly VisibleFace[]): VisibleFace[] {
  return [...faces].sort((a, b) => a.sortKey - b.sortKey);
}

interface TextureBindingCache {
  diffuse?: Texture2D;
  lightmap?: Texture2D;
  refraction?: Texture2D;
}

interface ResolvedSurfaceTextures {
  diffuse?: Texture2D;
  lightmap?: Texture2D;
  refraction?: Texture2D;
}

interface BatchKey {
  diffuse?: Texture2D;
  lightmap?: Texture2D;
  surfaceFlags: number;
  styleKey: string;
}

function resolveSurfaceTextures(
    geometry: BspSurfaceGeometry,
    world: WorldRenderState | undefined,
    refractionTexture?: Texture2D
): ResolvedSurfaceTextures {
  // Try to resolve the texture from the material system first (handling animations)
  const material = world?.materials?.getMaterial(geometry.texture);
  let diffuse: Texture2D | undefined;

  if (material) {
    const matTex = material.texture;
    if (matTex) {
      // Cast is safe because we updated Material to hold Texture2D objects
      diffuse = matTex as unknown as Texture2D;
    }
  }

  // Fallback to static texture lookup if material didn't provide one
  if (!diffuse) {
    diffuse = world?.textures?.get(geometry.texture);
  }

  const lightmapIndex = geometry.lightmap?.atlasIndex;
  const lightmap = lightmapIndex !== undefined ? world?.lightmaps?.[lightmapIndex]?.texture : undefined;

  return { diffuse, lightmap, refraction: refractionTexture };
}

function bindSurfaceTextures(
  geometry: BspSurfaceGeometry,
  world: WorldRenderState | undefined,
  cache: TextureBindingCache,
  resolved: ResolvedSurfaceTextures
): { diffuse?: number; lightmap?: number; refraction?: number } {
  const diffuse = resolved.diffuse;

  if (diffuse && cache.diffuse !== diffuse) {
    diffuse.bind(0);
    cache.diffuse = diffuse;
  }

  const lightmap = resolved.lightmap;
  if (lightmap && cache.lightmap !== lightmap) {
    lightmap.bind(1);
    cache.lightmap = lightmap;
  }
  if (!lightmap) {
    cache.lightmap = undefined;
  }

  const refraction = resolved.refraction;
  let refractionSampler: number | undefined;
  if (refraction && (geometry.surfaceFlags & SURF_WARP)) {
      if (cache.refraction !== refraction) {
          refraction.bind(2);
          cache.refraction = refraction;
      }
      refractionSampler = 2;
  } else {
      cache.refraction = undefined;
  }

  return { diffuse: 0, lightmap: lightmap ? 1 : undefined, refraction: refractionSampler };
}

export interface FrameRenderer {
  renderFrame(options: FrameRenderOptions): FrameRenderStats;
}

function renderViewModel(
  gl: WebGL2RenderingContext,
  camera: Camera,
  viewModel: ViewModelRenderState | undefined,
  removeTranslation: typeof removeViewTranslation
): boolean {
  if (!viewModel) {
    return false;
  }

  const projection = viewModel.fov ? camera.getViewmodelProjectionMatrix(viewModel.fov) : camera.projectionMatrix;
  const view = removeTranslation(camera.viewMatrix);
  const viewProjection = mat4.create();
  mat4.multiply(viewProjection, projection, view);

  if (viewModel.depthRange) {
    gl.depthRange(viewModel.depthRange[0], viewModel.depthRange[1]);
  }

  viewModel.draw(new Float32Array(viewProjection));

  if (viewModel.depthRange) {
    gl.depthRange(0, 1);
  }

  return true;
}

// Helper to evaluate light style pattern at a given time
function evaluateLightStyle(pattern: string, time: number): number {
    if (!pattern) return 1.0;
    const frame = Math.floor(time * 10) % pattern.length;
    const charCode = pattern.charCodeAt(frame);
    return (charCode - 97) / 12.0;
}


export const createFrameRenderer = (
  gl: WebGL2RenderingContext,
  bspPipeline: BspSurfacePipeline,
  skyboxPipeline: SkyboxPipeline,
  deps: FrameRendererDependencies = DEFAULT_DEPS
): FrameRenderer => {
  const postProcess = new PostProcessPipeline(gl);
  const bloomPipeline = new BloomPipeline(gl);
  let lastFrameTime = 0;

  // Texture State for copies (Refraction and PostProcess)
  let copyTexture: Texture2D | undefined;
  let copyTextureWidth = 0;
  let copyTextureHeight = 0;

  const ensureCopyTexture = (width: number, height: number): Texture2D => {
      if (!copyTexture || copyTextureWidth !== width || copyTextureHeight !== height) {
          copyTexture = new Texture2D(gl);
          copyTexture.upload(width, height, null); // Empty texture
          copyTexture.setParameters({
              minFilter: gl.LINEAR,
              magFilter: gl.LINEAR,
              wrapS: gl.CLAMP_TO_EDGE,
              wrapT: gl.CLAMP_TO_EDGE
          });
          copyTextureWidth = width;
          copyTextureHeight = height;
      }
      return copyTexture;
  };

  const renderFrame = (options: FrameRenderOptionsInternal): FrameRenderStats => {
    const now = performance.now();
    const fps = lastFrameTime > 0 ? 1000 / (now - lastFrameTime) : 0;
    lastFrameTime = now;

    const stats: FrameRenderStats = {
      batches: 0,
      facesDrawn: 0,
      drawCalls: 0,
      skyDrawn: false,
      viewModelDrawn: false,
      fps: Math.round(fps),
      vertexCount: 0,
    };

    const {
        camera,
        world,
        sky,
        clearColor = [0, 0, 0, 1],
        timeSeconds = 0,
        viewModel,
        dlights,
        renderMode,
        disableLightmaps,
        lightmapOnly,
        brightness,
        gamma,
        fullbright,
        ambient,
        lightStyleOverrides,
        waterTint,
        underwaterWarp,
        bloom,
        bloomIntensity
    } = options;
    const viewProjection = new Float32Array(camera.viewProjectionMatrix);

    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    renderSky(skyboxPipeline, camera, timeSeconds, sky, deps);
    stats.skyDrawn = Boolean(sky);

    if (world) {
      // Update material animations
      world.materials?.update(timeSeconds);

      const frustum = deps.extractFrustumPlanes(Array.from(viewProjection));
      const cameraPosition = {
        x: camera.position[0] ?? 0,
        y: camera.position[1] ?? 0,
        z: camera.position[2] ?? 0,
      };
      const visibleFaces = deps.gatherVisibleFaces(world.map, cameraPosition, frustum);

      // Split faces into Opaque and Transparent/Warping
      const opaqueFaces: VisibleFace[] = [];
      const transparentFaces: VisibleFace[] = [];

      for (const face of visibleFaces) {
          const geometry = world.surfaces[face.faceIndex];
          if (!geometry) continue;

          // Check if surface is transparent or warping (water, slime, lava)
          const isTransparent = (geometry.surfaceFlags & (SURF_TRANS33 | SURF_TRANS66 | SURF_WARP)) !== 0;

          if (isTransparent) {
              transparentFaces.push(face);
          } else {
              opaqueFaces.push(face);
          }
      }

      // 1. Render Opaque Faces
      const sortedOpaque = sortVisibleFacesFrontToBack(opaqueFaces);

      // Prepare effective light styles
      let effectiveLightStyles: ReadonlyArray<number> = world.lightStyles || [];
      if (lightStyleOverrides && lightStyleOverrides.size > 0) {
          const styles = [...(world.lightStyles || [])];
          for (const [index, pattern] of lightStyleOverrides) {
             while (styles.length <= index) styles.push(1.0);
             styles[index] = evaluateLightStyle(pattern, timeSeconds);
          }
          effectiveLightStyles = styles;
      }

      const drawSurfaceBatch = (faces: VisibleFace[], useRefraction: boolean) => {
           let lastBatchKey: BatchKey | undefined;
           let cachedState: ReturnType<BspSurfacePipeline['bind']> | undefined;
           const cache: TextureBindingCache = {};

           // Ensure refraction texture is bound if needed
           const currentRefractionTexture = useRefraction ? copyTexture : undefined;

           for (const { faceIndex } of faces) {
                const geometry = world.surfaces[faceIndex];
                if (!geometry) continue;
                if ((geometry.surfaceFlags & SURF_SKY) !== 0) continue;

                const faceStyles = world.map.faces[faceIndex]?.styles;
                const material = world.materials?.getMaterial(geometry.texture);
                const resolvedTextures = resolveSurfaceTextures(geometry, world, currentRefractionTexture);

                let activeRenderMode: RenderModeConfig | undefined = renderMode;
                if (renderMode && !renderMode.applyToAll && resolvedTextures.diffuse) {
                    activeRenderMode = undefined;
                } else if (renderMode && !renderMode.applyToAll && !resolvedTextures.diffuse) {
                   activeRenderMode = renderMode;
                }

                let effectiveLightmap = resolvedTextures.lightmap;
                if (disableLightmaps) {
                    effectiveLightmap = undefined;
                }

                const batchKey: BatchKey = {
                  diffuse: resolvedTextures.diffuse,
                  lightmap: effectiveLightmap,
                  surfaceFlags: geometry.surfaceFlags,
                  styleKey: faceStyles?.join(',') ?? '',
                };

                const isSameBatch =
                  lastBatchKey &&
                  lastBatchKey.diffuse === batchKey.diffuse &&
                  lastBatchKey.lightmap === batchKey.lightmap &&
                  lastBatchKey.surfaceFlags === batchKey.surfaceFlags &&
                  lastBatchKey.styleKey === batchKey.styleKey;

                if (!isSameBatch) {
                  stats.batches += 1;
                  cache.diffuse = undefined;
                  cache.lightmap = undefined;
                  cache.refraction = undefined;

                  const effectiveTextures = { ...resolvedTextures, lightmap: effectiveLightmap };
                  const textures = bindSurfaceTextures(geometry, world, cache, effectiveTextures);

                  const texScroll = material ? material.scrollOffset : undefined;
                  const warp = material ? material.warp : undefined;

                  cachedState = bspPipeline.bind({
                    modelViewProjection: viewProjection,
                    styleIndices: faceStyles,
                    styleValues: effectiveLightStyles,
                    surfaceFlags: geometry.surfaceFlags,
                    timeSeconds,
                    diffuseSampler: textures.diffuse ?? 0,
                    lightmapSampler: textures.lightmap,
                    refractionSampler: textures.refraction,
                    texScroll,
                    warp,
                    dlights,
                    renderMode: activeRenderMode,
                    lightmapOnly,
                    brightness,
                    gamma,
                    fullbright,
                    ambient
                  });
                  applySurfaceState(gl, cachedState);
                  lastBatchKey = batchKey;
                } else {
                  // Rebind textures if we are in the same batch (optimization mostly for non-cached changes)
                  // Actually resolveSurfaceTextures always returns new object, so bindSurfaceTextures check is useful
                  const effectiveTextures = { ...resolvedTextures, lightmap: effectiveLightmap };
                  bindSurfaceTextures(geometry, world, cache, effectiveTextures);
                  if (cachedState) {
                    applySurfaceState(gl, cachedState);
                  }
                }

                bspPipeline.draw(geometry, activeRenderMode);

                stats.facesDrawn += 1;
                stats.drawCalls += 1;
                stats.vertexCount += geometry.vertexCount;
           }
      };

      // Draw Opaque Pass
      drawSurfaceBatch(sortedOpaque, false);

      // 2. Capture Framebuffer for Refraction
      if (transparentFaces.length > 0) {
          const width = gl.canvas.width;
          const height = gl.canvas.height;
          const rt = ensureCopyTexture(width, height);
          rt.bind(2); // Bind to a unit to copy into
          gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0);
      }

      // 3. Render Transparent/Warping Faces
      const sortedTransparent = sortVisibleFacesBackToFront(transparentFaces);
      drawSurfaceBatch(sortedTransparent, true);
    }

    if (renderViewModel(gl, camera, viewModel, deps.removeViewTranslation)) {
      stats.viewModelDrawn = true;
    }

    // 4. Underwater Distortion Post-Process
    if (underwaterWarp) {
        const width = gl.canvas.width;
        const height = gl.canvas.height;
        const rt = ensureCopyTexture(width, height);

        // Copy current framebuffer to texture
        rt.bind(0);
        gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0);

        // Render full screen quad with distortion
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        postProcess.render(rt.texture, timeSeconds);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
    }

    // 5. Bloom Post-Process
    if (bloom) {
        const width = gl.canvas.width;
        const height = gl.canvas.height;
        bloomPipeline.resize(width, height);

        const rt = ensureCopyTexture(width, height);

        // Copy current framebuffer to texture (if underwaterWarp ran, we copy the warped result)
        // Note: ensureCopyTexture returns the same texture object, and copyTexImage2D overwrites it.
        // This is fine as long as pipelines don't hold onto it across calls in a way that matters here.

        rt.bind(0);
        gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0);

        // Render bloom
        bloomPipeline.render(rt, bloomIntensity ?? 0.5);
    }

    return stats;
  };

  return {
    renderFrame,
  };
};
