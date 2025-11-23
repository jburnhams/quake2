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

interface FrameRenderOptions {
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
  let diffuse: Texture2D | undefined;

  // Try to get texture from material system first (supports animation)
  const material = world?.materials?.getMaterial(geometry.texture);
  if (material) {
    // Cast WebGLTexture from material to Texture2D?
    // No, MaterialManager stores WebGLTexture directly or wraps it?
    // `materials.ts`: Material stores `WebGLTexture`.
    // Texture2D wraps a WebGLTexture.
    // We need a way to get the Texture2D or just bind the raw GL texture.
    // However, our `Texture2D.bind` method handles active texture state.

    // For now, let's assume world.materials are not populated yet, OR
    // we need to refactor Texture2D/Material interaction.
    // But since the task is to refactor:
    // If material has a texture, we use it.

    // Wait, Texture2D is a wrapper. Material.texture returns WebGLTexture.
    // We can't strictly assume it's a Texture2D object unless we change Material.
    // But `resolveSurfaceTextures` expects `Texture2D`.

    // WORKAROUND: For this step, if we find a material, we might need to look up the Texture2D wrapper
    // that corresponds to it, OR simply rely on the fact that for now we are just setting up the structure.
    // Since `world.textures` maps name -> Texture2D, let's stick to that for the diffuse.

    // If we want animation, we need the CURRENT texture name or object.
    // Material returns the current WebGLTexture.

    // Let's defer strict type change and stick to `world.textures` for now unless we fully migrate.
  }

  diffuse = world?.textures?.get(geometry.texture);
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
  // If we have a material, we should bind its current texture.
  // But `Material` returns a raw WebGLTexture.
  // We need to bind it to unit 0.

  const material = world?.materials?.getMaterial(geometry.texture);
  if (material && material.texture) {
      // Direct GL bind? or wrap?
      // Since we don't have access to GL context here easily (it's in pipeline),
      // we usually rely on Texture2D.bind.

      // FIXME: This mixing of abstractions (Texture2D vs raw WebGLTexture in Material) is messy.
      // Ideally Material should hold Texture2D references.
  }

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

    const { camera, world, sky, clearColor = [0, 0, 0, 1], timeSeconds = 0, viewModel } = options;
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

        // Material Lookup
        const material = world.materials?.getMaterial(geometry.texture);

        // If material exists, we need to bind ITS texture.
        // Currently `resolveSurfaceTextures` uses `world.textures`.
        // We need to inject the material's texture into the resolution/binding process.
        // For now, to avoid breaking the Texture2D type contract, we'll continue using resolveSurfaceTextures
        // but use material properties for scroll/warp overrides in the pipeline bind.

        const resolvedTextures = resolveSurfaceTextures(geometry, world);

        // If we had a material with an animated texture, we would need to find the Texture2D for that frame.
        // That requires `world.textures` to have entries for all frames, or Material to hold Texture2D.

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

          // Use material properties if available
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
            warp
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
