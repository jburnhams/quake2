import { Vec3 } from '@quake2ts/shared';

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
}

export function createEngine(imports: EngineImports): EngineExports {
  return {
    init() {
      void imports.trace({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    },
    shutdown() {
      /* no-op for bootstrap */
    },
  };
}
