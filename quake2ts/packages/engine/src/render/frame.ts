import type { ParticleSystem } from './particleSystem.js';
import type { BspMap } from '../assets/bsp.js';
import { applySurfaceState, BspSurfacePipeline } from './bspPipeline.js';
import { gatherVisibleFaces } from './bspTraversal.js';
import { buildWorldDrawList, type BrushModelInstance, type WorldDraw, type WorldDrawSurface } from './worldDrawList.js';
import { extractFrustumPlanes } from './culling.js';
import { Camera } from './camera.js';
import { CameraState } from './types/camera.js';
import type { BspSurfaceGeometry, LightmapAtlas } from './bsp.js';
import { Texture2D } from './resources.js';
import type { MaterialManager } from './materials.js';
import {
  computeSkyScroll,
  removeViewTranslation,
  SkyboxPipeline,
  type SkyboxBindOptions,
} from './skybox.js';
import { mat4 } from 'gl-matrix';
import { SURF_WARP } from '@quake2ts/shared';
import { DLight } from './dlight.js';
import { PostProcessPipeline } from './postprocessing/pipeline.js';
import { BloomPipeline } from './bloom.js';

export type { FrameRenderStats, FrameRenderOptions };

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

/**
 * An uploaded world, as `uploadWorld` returns it. Generic over the backend's texture and surface
 * types; the defaults are WebGL's. `surfaces` is indexed by BSP face number.
 */
export interface WorldRenderState<TTexture = Texture2D, TSurface extends WorldDrawSurface = BspSurfaceGeometry> {
  readonly map: BspMap;
  readonly surfaces: readonly TSurface[];
  readonly lightmaps?: readonly (Omit<LightmapAtlas, 'texture'> & { readonly texture: TTexture })[];
  readonly textures?: ReadonlyMap<string, TTexture>;
  readonly materials?: MaterialManager;
  readonly lightStyles?: ReadonlyArray<number>;
}

/** `worldpos-debug` and `distance-debug` are drawn by the WebGPU backend only. */
export type RenderMode = 'textured' | 'wireframe' | 'solid' | 'solid-faceted' | 'worldpos-debug' | 'distance-debug';

export interface RenderModeConfig {
  readonly mode: RenderMode;
  readonly applyToAll: boolean; // if false, only applies to missing textures
  readonly color?: readonly [number, number, number, number]; // Global override color
  readonly generateRandomColor?: boolean; // If true, generates color from entity ID
}

interface FrameRenderOptions {
  readonly camera: Camera;
  readonly cameraState?: CameraState;
  readonly world?: WorldRenderState;
  readonly sky?: SkyRenderState;
  readonly viewModel?: ViewModelRenderState;
  readonly dlights?: readonly DLight[];
  readonly timeSeconds?: number;
  /** Seconds since the last frame: the particles drawn are moved on by it first. */
  readonly deltaTime?: number;
  /**
   * The particles to draw, when the caller owns them (a client's effects, a test with a seeded
   * generator); left out, the renderer's own `particleSystem`.
   */
  readonly particles?: ParticleSystem;
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
  readonly portalState?: ReadonlyArray<boolean>; // Portal visibility state
  /** Doors, lifts and other brush-model entities, each drawn at its entity's position. */
  readonly brushModels?: readonly BrushModelInstance[];

  // Injected matrices from adapter (internal use)
  readonly _viewMatrix?: mat4;
  readonly _projectionMatrix?: mat4;
  readonly _viewProjectionMatrix?: mat4;
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
  cameraState: CameraState,
  timeSeconds: number,
  options: SkyRenderState | undefined,
  deps: FrameRendererDependencies
): void {
  if (!options) {
    return;
  }

  const scroll = deps.computeSkyScroll(timeSeconds, options.scrollSpeeds ?? [0.01, 0.02]);

  skyboxPipeline.bind({
    cameraState,
    scroll,
    textureUnit: options.textureUnit ?? 0,
  } satisfies SkyboxBindOptions);

  skyboxPipeline.draw();

  // Ensure subsequent passes can write depth.
  skyboxPipeline.gl.depthMask(true);
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
  removeTranslation: typeof removeViewTranslation,
  injectedView?: mat4,
  injectedProjection?: mat4
): boolean {
  if (!viewModel) {
    return false;
  }

  let projection: mat4;
  let view: mat4;

  // Use injected matrices if available, otherwise fallback to Camera
  if (injectedProjection && injectedView) {
      // For viewmodel, we often change FOV (projection) or remove translation (view)
      // If injectedProjection is standard FOV, we might need to recalc if viewModel.fov is set.
      // But typically viewModel.fov overrides.
      // And we need view without translation.

      // If we rely on Camera methods, we are coupling.
      // For now, let's keep using Camera methods for projection if FOV is different,
      // but use injectedView (cleaned) for view.

      projection = viewModel.fov ? camera.getViewmodelProjectionMatrix(viewModel.fov) : injectedProjection;
      view = removeTranslation(injectedView);
  } else {
      projection = viewModel.fov ? camera.getViewmodelProjectionMatrix(viewModel.fov) : camera.projectionMatrix;
      view = removeTranslation(camera.viewMatrix);
  }

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
        bloomIntensity,
        portalState,
        _viewMatrix,
        _projectionMatrix,
        _viewProjectionMatrix
    } = options;

    const cameraState = options.cameraState ?? camera.toState();

    // Use injected matrix if available, otherwise fallback to camera
    const viewProjection = _viewProjectionMatrix
        ? new Float32Array(_viewProjectionMatrix)
        : new Float32Array(camera.viewProjectionMatrix);

    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    renderSky(skyboxPipeline, cameraState, timeSeconds, sky, deps);
    stats.skyDrawn = Boolean(sky);

    if (world) {
      const drawList = buildWorldDrawList(world, {
        cameraPosition: { x: camera.position[0] ?? 0, y: camera.position[1] ?? 0, z: camera.position[2] ?? 0 },
        viewProjection,
        timeSeconds,
        portalState,
        lightStyleOverrides,
        renderMode,
        disableLightmaps,
        hasTexture: (name) => Boolean(world.textures?.get(name)),
        brushModels: options.brushModels,
        gatherVisibleFaces: deps.gatherVisibleFaces,
        extractFrustumPlanes: deps.extractFrustumPlanes,
      });

      const runPass = (draws: readonly WorldDraw<BspSurfaceGeometry>[], refraction: Texture2D | undefined) => {
        const cache: TextureBindingCache = {};
        let state: ReturnType<BspSurfacePipeline['bind']> | undefined;
        for (const draw of draws) {
          const geometry = draw.surface;
          const textures: ResolvedSurfaceTextures = {
            diffuse: (world.materials?.getMaterial(geometry.texture)?.texture as Texture2D | null | undefined) ?? world.textures?.get(draw.texture),
            lightmap: draw.lightmapAtlas !== undefined ? world.lightmaps?.[draw.lightmapAtlas]?.texture : undefined,
            refraction,
          };
          if (draw.startsBatch) {
            cache.diffuse = undefined;
            cache.lightmap = undefined;
            cache.refraction = undefined;
            const units = bindSurfaceTextures(geometry, world, cache, textures);
            state = bspPipeline.bind({
              cameraState,
              modelViewProjection: _viewProjectionMatrix ? viewProjection : undefined,
              modelMatrix: draw.transform,
              styleIndices: draw.styleIndices,
              styleLayers: draw.styleLayers,
              styleValues: drawList.lightStyles,
              surfaceFlags: geometry.surfaceFlags,
              timeSeconds,
              diffuseSampler: units.diffuse ?? 0,
              lightmapSampler: units.lightmap,
              refractionSampler: units.refraction,
              texScroll: draw.texScroll,
              warp: draw.warp,
              dlights,
              renderMode: draw.renderMode,
              lightmapOnly,
              brightness,
              gamma,
              fullbright,
              ambient,
            });
          } else {
            bindSurfaceTextures(geometry, world, cache, textures);
          }
          if (state) applySurfaceState(gl, state);
          bspPipeline.draw(geometry, draw.renderMode);
          stats.facesDrawn += 1;
          stats.drawCalls += 1;
        }
      };

      runPass(drawList.opaque, undefined);

      // Water refracts what is behind it: copy the opaque result for the transparent pass.
      if (drawList.transparent.length > 0) {
        const width = gl.canvas.width;
        const height = gl.canvas.height;
        const rt = ensureCopyTexture(width, height);
        rt.bind(2);
        gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0);
      }
      runPass(drawList.transparent, copyTexture);

      stats.batches = drawList.batches;
      stats.vertexCount = drawList.vertexCount;
    }

    if (renderViewModel(gl, camera, viewModel, deps.removeViewTranslation, _viewMatrix, _projectionMatrix)) {
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
