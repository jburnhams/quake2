import type { BspMap } from '../assets/bsp.js';
import { applySurfaceState, BspSurfacePipeline } from './bspPipeline.js';
import { gatherVisibleFaces, type VisibleFace } from './bspTraversal.js';
import { extractFrustumPlanes } from './culling.js';
import { Camera } from './camera.js';
import type { BspSurfaceGeometry, LightmapAtlas } from './bsp.js';
import type { Texture2D } from './resources.js';
import {
  computeSkyScroll,
  removeViewTranslation,
  SkyboxPipeline,
  type SkyboxBindOptions,
} from './skybox.js';
import { mat4 } from 'gl-matrix';
import { SURF_SKY } from '@quake2ts/shared';

export interface SkyRenderState {
  readonly scrollSpeeds?: readonly [number, number];
  readonly textureUnit?: number;
}

export interface ViewModelRenderState {
  readonly fov?: number;
  readonly depthRange?: readonly [number, number];
  readonly draw: (viewProjection: Float32Array) => void;
}

export interface FrameRenderStats {
  batches: number;
  facesDrawn: number;
  drawCalls: number;
  skyDrawn: boolean;
  viewModelDrawn: boolean;
}

export interface WorldRenderState {
  readonly map: BspMap;
  readonly surfaces: readonly BspSurfaceGeometry[];
  readonly lightmaps?: readonly LightmapAtlas[];
  readonly textures?: ReadonlyMap<string, Texture2D>;
  readonly lightStyles?: ReadonlyArray<number>;
}

export interface FrameRenderOptions {
  readonly camera: Camera;
  readonly world?: WorldRenderState;
  readonly sky?: SkyRenderState;
  readonly viewModel?: ViewModelRenderState;
  readonly timeSeconds?: number;
  readonly clearColor?: readonly [number, number, number, number];
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
  const diffuse = world?.textures?.get(geometry.texture);
  const lightmapIndex = geometry.lightmap?.atlasIndex;
  const lightmap = lightmapIndex !== undefined ? world?.lightmaps?.[lightmapIndex]?.texture : undefined;
  return { diffuse, lightmap };
}

function bindSurfaceTextures(
  geometry: BspSurfaceGeometry,
  world: WorldRenderState | undefined,
  cache: TextureBindingCache,
  resolved?: ResolvedSurfaceTextures
): { diffuse?: number; lightmap?: number } {
  const diffuse = resolved?.diffuse ?? world?.textures?.get(geometry.texture);
  if (diffuse && cache.diffuse !== diffuse) {
    diffuse.bind(0);
    cache.diffuse = diffuse;
  }

  const lightmapPlacement = geometry.lightmap;
  const lightmap = resolved?.lightmap ?? (lightmapPlacement && world?.lightmaps?.[lightmapPlacement.atlasIndex]?.texture);
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
  const renderFrame = (options: FrameRenderOptions): FrameRenderStats => {
    const stats: FrameRenderStats = {
      batches: 0,
      facesDrawn: 0,
      drawCalls: 0,
      skyDrawn: false,
      viewModelDrawn: false,
    };

    const { camera, world, sky, clearColor = [0, 0, 0, 1], timeSeconds = 0, viewModel } = options;
    const viewProjection = new Float32Array(camera.viewProjectionMatrix);

    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    renderSky(skyboxPipeline, camera, timeSeconds, sky, deps);
    stats.skyDrawn = Boolean(sky);

    if (world) {
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
        const resolvedTextures = resolveSurfaceTextures(geometry, world);
        const batchKey: BatchKey = {
          diffuse: resolvedTextures.diffuse,
          lightmap: resolvedTextures.lightmap,
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

          const textures = bindSurfaceTextures(geometry, world, cache, resolvedTextures);
          cachedState = bspPipeline.bind({
            modelViewProjection: viewProjection,
            styleIndices: faceStyles,
            styleValues: world.lightStyles,
            surfaceFlags: geometry.surfaceFlags,
            timeSeconds,
            diffuseSampler: textures.diffuse ?? 0,
            lightmapSampler: textures.lightmap,
          });
          applySurfaceState(gl, cachedState);
          lastBatchKey = batchKey;
        } else {
          bindSurfaceTextures(geometry, world, cache, resolvedTextures);
          if (cachedState) {
            applySurfaceState(gl, cachedState);
          }
        }

        geometry.vao.bind();
        geometry.indexBuffer.bind();
        gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_SHORT, 0);
        stats.facesDrawn += 1;
        stats.drawCalls += 1;
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
