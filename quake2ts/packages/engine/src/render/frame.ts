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

function bindSurfaceTextures(
  geometry: BspSurfaceGeometry,
  world: WorldRenderState | undefined
): { diffuse?: number; lightmap?: number } {
  const diffuse = world?.textures?.get(geometry.texture);
  diffuse?.bind(0);

  const lightmapPlacement = geometry.lightmap;
  const lightmap =
    lightmapPlacement && world?.lightmaps?.[lightmapPlacement.atlasIndex]?.texture;
  lightmap?.bind(1);

  return { diffuse: 0, lightmap: lightmap ? 1 : undefined };
}

export interface FrameRenderer {
  renderFrame(options: FrameRenderOptions): void;
}

export const createFrameRenderer = (
  gl: WebGL2RenderingContext,
  bspPipeline: BspSurfacePipeline,
  skyboxPipeline: SkyboxPipeline,
  deps: FrameRendererDependencies = DEFAULT_DEPS
): FrameRenderer => {
  const renderFrame = (options: FrameRenderOptions) => {
    const { camera, world, sky, clearColor = [0, 0, 0, 1], timeSeconds = 0 } = options;
    const viewProjection = new Float32Array(camera.viewProjectionMatrix);

    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    renderSky(skyboxPipeline, camera, timeSeconds, sky, deps);

    if (world) {
      const frustum = deps.extractFrustumPlanes(Array.from(viewProjection));
      const cameraPosition = {
        x: camera.position[0] ?? 0,
        y: camera.position[1] ?? 0,
        z: camera.position[2] ?? 0,
      };
      const visibleFaces = deps.gatherVisibleFaces(world.map, cameraPosition, frustum);
      const sortedFaces = sortVisibleFaces(visibleFaces);

      for (const { faceIndex } of sortedFaces) {
        const geometry = world.surfaces[faceIndex];
        if (!geometry) {
          continue;
        }

        if ((geometry.surfaceFlags & SURF_SKY) !== 0) {
          continue;
        }

        const textures = bindSurfaceTextures(geometry, world);
        const state = bspPipeline.bind({
          modelViewProjection: viewProjection,
          styleIndices: world.map.faces[faceIndex]?.styles,
          styleValues: world.lightStyles,
          surfaceFlags: geometry.surfaceFlags,
          timeSeconds,
          diffuseSampler: textures.diffuse ?? 0,
          lightmapSampler: textures.lightmap,
        });

        applySurfaceState(gl, state);
        geometry.vao.bind();
        geometry.indexBuffer.bind();
        gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_SHORT, 0);
      }
    }
  };

  return {
    renderFrame,
  };
};
