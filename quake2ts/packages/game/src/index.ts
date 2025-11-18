import type { EngineExports, EngineImports } from '@quake2ts/engine';
import type { Vec3 } from '@quake2ts/shared';

export interface GameCreateOptions {
  gravity: Vec3;
}

export interface GameExports extends EngineExports {
  spawnWorld(): void;
}

export function createGame(engine: EngineImports, options: GameCreateOptions): GameExports {
  const gravity = options.gravity;

  return {
    init() {
      void engine.trace({ x: 0, y: 0, z: 0 }, gravity);
    },
    shutdown() {
      /* placeholder shutdown */
    },
    spawnWorld() {
      /* placeholder world spawn */
    },
  };
}
