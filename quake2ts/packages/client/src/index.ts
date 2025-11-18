import type { EngineImports } from '@quake2ts/engine';
import type { Vec3 } from '@quake2ts/shared';

export interface ClientImports {
  readonly engine: EngineImports;
}

export interface PredictionState {
  readonly origin: Vec3;
  readonly velocity: Vec3;
}

export interface ClientExports {
  init(): void;
  predict(next: PredictionState): PredictionState;
}

export function createClient(imports: ClientImports): ClientExports {
  return {
    init() {
      void imports.engine.trace({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    },
    predict(next: PredictionState): PredictionState {
      const { origin, velocity } = next;
      return {
        origin: {
          x: origin.x + velocity.x,
          y: origin.y + velocity.y,
          z: origin.z + velocity.z,
        },
        velocity,
      };
    },
  };
}
