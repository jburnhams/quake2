import { Vec3 } from '@quake2ts/shared';
import {
  EngineHost,
  type ClientRenderer,
  type EngineHostOptions,
  type GameFrameResult,
  type GameRenderSample,
  type GameSimulation,
} from './host.js';
import { ConfigStringRegistry } from './configstrings.js';
import { FixedTimestepLoop, type LoopCallbacks, type LoopOptions } from './loop.js';
import { EngineRuntime, createEngineRuntime } from './runtime.js';

import { PmoveTraceResult } from '@quake2ts/shared';

export interface TraceResult extends PmoveTraceResult {
  readonly start: Vec3;
  readonly end: Vec3;
  readonly hit?: Vec3;
}

export interface EngineImports {
  trace(start: Vec3, end: Vec3): TraceResult;
}

export interface EngineExports {
  init(): void;
  shutdown(): void;
  createMainLoop(callbacks: LoopCallbacks, options?: Partial<LoopOptions>): FixedTimestepLoop;
}

export function createEngine(imports: EngineImports): EngineExports {
  return {
    init() {
      void imports.trace({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    },
    shutdown() {
      /* no-op for bootstrap */
    },
    createMainLoop(callbacks: LoopCallbacks, options?: Partial<LoopOptions>): FixedTimestepLoop {
      return new FixedTimestepLoop(callbacks, options);
    },
  };
}

export { FixedTimestepLoop };
export { ConfigStringRegistry };
export { Cvar, CvarRegistry } from './cvars.js';
export type { FixedStepContext, LoopCallbacks, LoopOptions, RenderContext } from './loop.js';
export { PakArchive, PakParseError, calculatePakChecksum } from './assets/pak.js';
export { VirtualFileSystem } from './assets/vfs.js';
export {
  ingestPaks,
  PakIngestionError,
  type PakIngestionOptions,
  type PakIngestionProgress,
  type PakIngestionResult,
  type PakSource,
} from './assets/ingestion.js';
export { LruCache } from './assets/cache.js';
export { filesToPakSources, ingestPakFiles, wireDropTarget, wireFileInput } from './assets/browserIngestion.js';
export {
  Md2Loader,
  Md2ParseError,
  groupMd2Animations,
  parseMd2,
  type Md2Animation,
  type Md2Frame,
  type Md2GlCommand,
  type Md2Model,
} from './assets/md2.js';
export {
  Md3Loader,
  Md3ParseError,
  parseMd3,
  type Md3Frame,
  type Md3Model,
  type Md3Surface,
} from './assets/md3.js';
export {
  advanceAnimation,
  computeFrameBlend,
  createAnimationState,
  interpolateVec3,
  type AnimationSequence,
  type AnimationState,
  type FrameBlend,
} from './assets/animation.js';
export { parseWal, type WalTexture } from './assets/wal.js';
export { parsePcx, pcxToRgba, type PcxImage } from './assets/pcx.js';
export {
  parseWalTexture,
  preparePcxTexture,
  TextureCache,
  walToRgba,
  type PreparedTexture,
  type TextureLevel,
} from './assets/texture.js';
export { parseWav, type WavData } from './assets/wav.js';
export { decodeOgg, type OggAudio } from './assets/ogg.js';
export { AudioRegistry, AudioRegistryError, type DecodedAudio } from './assets/audio.js';
export { PakIndexStore, type StoredPakIndex } from './assets/pakIndexStore.js';
export {
  PakValidationError,
  PakValidator,
  RERELEASE_KNOWN_PAKS,
  type KnownPakChecksum,
  type PakValidationOutcome,
} from './assets/pakValidation.js';
export {
  AssetDependencyError,
  AssetDependencyTracker,
  AssetManager,
  type AssetManagerOptions,
} from './assets/manager.js';
export {
  ATTN_IDLE,
  ATTN_LOOP_NONE,
  ATTN_NONE,
  ATTN_NORM,
  ATTN_STATIC,
  MAX_SOUND_CHANNELS,
  SOUND_FULLVOLUME,
  SOUND_LOOP_ATTENUATE,
  SoundChannel,
  attenuationToDistanceMultiplier,
  calculateMaxAudibleDistance,
} from './audio/constants.js';
export {
  AudioContextController,
  createAudioGraph,
  type AudioBufferLike,
  type AudioContextLike,
  type AudioGraph,
  type AudioNodeLike,
  type GainNodeLike,
  type BiquadFilterNodeLike,
  type PannerNodeLike,
} from './audio/context.js';
export { SoundRegistry } from './audio/registry.js';
export { SoundPrecache, type SoundPrecacheOptions, type SoundPrecacheReport } from './audio/precache.js';
export { AudioSystem, type AudioSystemOptions, type SoundRequest } from './audio/system.js';
export { spatializeOrigin, type ListenerState, type SpatializationResult } from './audio/spatialization.js';
export { createInitialChannels, pickChannel, type ChannelState } from './audio/channels.js';
export { MusicSystem, type MusicSystemOptions, type MusicState, type AudioElementLike } from './audio/music.js';
export { AudioApi, type AudioApiOptions } from './audio/api.js';
export {
  EngineHost,
  type ClientRenderer,
  type EngineHostOptions,
  type GameFrameResult,
  type GameRenderSample,
  type GameSimulation,
};
export { EngineRuntime, createEngineRuntime };
export { createWebGLContext, type WebGLContextInitOptions, type WebGLContextState } from './render/context.js';
export { ShaderProgram, createProgramFromSources, type ShaderSources } from './render/shaderProgram.js';
export {
  Framebuffer,
  IndexBuffer,
  Texture2D,
  TextureCubeMap,
  VertexArray,
  VertexBuffer,
  type BufferUsage,
  type TextureParameters,
  type VertexAttributeLayout,
} from './render/resources.js';
export {
  BSP_VERTEX_LAYOUT,
  buildBspGeometry,
  type BspGeometryBuildResult,
  type BspLightmapData,
  type BspSurfaceGeometry,
  type BspSurfaceInput,
  type LightmapAtlas,
  type LightmapPlacement,
} from './render/bsp.js';
export { extractFrustumPlanes, boxIntersectsFrustum, type FrustumPlane } from './render/culling.js';
export { findLeafForPoint, gatherVisibleFaces, type VisibleFace } from './render/bspTraversal.js';
export {
  applySurfaceState,
  BspSurfacePipeline,
  BSP_SURFACE_FRAGMENT_SOURCE,
  BSP_SURFACE_VERTEX_SOURCE,
  deriveSurfaceRenderState,
  resolveLightStyles,
  type BspSurfaceBindOptions,
  type SurfaceRenderState,
} from './render/bspPipeline.js';
export {
  SKYBOX_FRAGMENT_SHADER,
  SKYBOX_VERTEX_SHADER,
  SkyboxPipeline,
  computeSkyScroll,
  removeViewTranslation,
} from './render/skybox.js';
export {
  MD2_FRAGMENT_SHADER,
  MD2_VERTEX_SHADER,
  Md2MeshBuffers,
  Md2Pipeline,
  buildMd2Geometry,
  buildMd2VertexData,
  type Md2BindOptions,
  type Md2FrameBlend,
  type Md2Geometry,
  type Md2DrawVertex,
} from './render/md2Pipeline.js';
export { createCamera, type Camera } from './render/camera.js';
