import type { BspMap } from '../assets/bsp.js';
import { applySurfaceState, BspSurfacePipeline } from './bspPipeline.js';
import { gatherVisibleFaces, type VisibleFace } from './bspTraversal.js';
import { extractFrustumPlanes } from './culling.js';
import { Camera } from './camera.js';
import type { BspSurfaceGeometry, LightmapAtlas } from './bsp.js';
import type { Texture2D } from './resources.js';
import type { MaterialManager } from './materials.js';
import {
  computeSkyScroll,
  removeViewTranslation,
  SkyboxPipeline,
  type SkyboxBindOptions,
} from './skybox.js';
import { mat4 } from 'gl-matrix';
import { SURF_SKY } from '@quake2ts/shared';
import { DLight } from './dlight.js';

export { FrameRenderStats, FrameRenderOptions };

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

interface FrameRenderOptions {
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

function sortVisibleFaces(faces: readonly VisibleFace[]): VisibleFace[] {
  return [...faces].sort((a, b) => b.sortKey - a.sortKey);
}

interface TextureBindingCache {
  diffuse?: Texture2D;
  lightmap?: Texture2D;
}

interface ResolvedSurfaceTextures {
  diffuse?: Texture2D;
  lightmap?: Texture2D;
}

interface BatchKey {
  diffuse?: Texture2D;
  lightmap?: Texture2D;
  surfaceFlags: number;
  styleKey: string;
}

function resolveSurfaceTextures(geometry: BspSurfaceGeometry, world: WorldRenderState | undefined): ResolvedSurfaceTextures {
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

  return { diffuse, lightmap };
}

function bindSurfaceTextures(
  geometry: BspSurfaceGeometry,
  world: WorldRenderState | undefined,
  cache: TextureBindingCache,
  resolved: ResolvedSurfaceTextures
): { diffuse?: number; lightmap?: number } {
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

  return { diffuse: 0, lightmap: lightmap ? 1 : undefined };
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

export const createFrameRenderer = (
  gl: WebGL2RenderingContext,
  bspPipeline: BspSurfacePipeline,
  skyboxPipeline: SkyboxPipeline,
  deps: FrameRendererDependencies = DEFAULT_DEPS
): FrameRenderer => {
  let lastFrameTime = 0;

  const renderFrame = (options: FrameRenderOptions): FrameRenderStats => {
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

    const { camera, world, sky, clearColor = [0, 0, 0, 1], timeSeconds = 0, viewModel, dlights, renderMode, disableLightmaps } = options;
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
      const sortedFaces = sortVisibleFaces(visibleFaces);

      let lastBatchKey: BatchKey | undefined;
      let cachedState: ReturnType<BspSurfacePipeline['bind']> | undefined;
      const cache: TextureBindingCache = {};

      for (const { faceIndex } of sortedFaces) {
        const geometry = world.surfaces[faceIndex];
        if (!geometry) {
          continue;
        }

        if ((geometry.surfaceFlags & SURF_SKY) !== 0) {
          continue;
        }

        const faceStyles = world.map.faces[faceIndex]?.styles;
        const material = world.materials?.getMaterial(geometry.texture);
        const resolvedTextures = resolveSurfaceTextures(geometry, world);

        // Determine effective render mode for this surface
        let activeRenderMode: RenderModeConfig | undefined = renderMode;
        if (renderMode && !renderMode.applyToAll && resolvedTextures.diffuse) {
          // If fallback mode is active but texture exists, use textured mode (disable override)
          activeRenderMode = undefined;
        } else if (renderMode && !renderMode.applyToAll && !resolvedTextures.diffuse) {
           // If fallback mode is active and texture is missing, enforce the override
           activeRenderMode = renderMode;
        }

        // Apply lightmap disable override
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

          // Note: we pass resolvedTextures manually constructed to respect disableLightmaps
          const effectiveTextures = { ...resolvedTextures, lightmap: effectiveLightmap };
          const textures = bindSurfaceTextures(geometry, world, cache, effectiveTextures);

          const texScroll = material ? material.scrollOffset : undefined;
          const warp = material ? material.warp : undefined;

          cachedState = bspPipeline.bind({
            modelViewProjection: viewProjection,
            styleIndices: faceStyles,
            styleValues: world.lightStyles,
            surfaceFlags: geometry.surfaceFlags,
            timeSeconds,
            diffuseSampler: textures.diffuse ?? 0,
            lightmapSampler: textures.lightmap,
            texScroll,
            warp,
            dlights,
            renderMode: activeRenderMode
          });
          applySurfaceState(gl, cachedState);
          lastBatchKey = batchKey;
        } else {
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
    }

    if (renderViewModel(gl, camera, viewModel, deps.removeViewTranslation)) {
      stats.viewModelDrawn = true;
    }

    return stats;
  };

  return {
    renderFrame,
  };
};
