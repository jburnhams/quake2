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

export interface TraceResult {
  readonly start: Vec3;
  readonly end: Vec3;
  readonly fraction: number;
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
  EngineHost,
  type ClientRenderer,
  type EngineHostOptions,
  type GameFrameResult,
  type GameRenderSample,
  type GameSimulation,
};
export { EngineRuntime, createEngineRuntime };
