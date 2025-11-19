import type {
  GameFrameResult,
  GameSimulation,
  FixedStepContext,
} from '@quake2ts/engine';
import type { Vec3 } from '@quake2ts/shared';

export interface GameCreateOptions {
  gravity: Vec3;
}

export interface GameStateSnapshot {
  readonly gravity: Vec3;
  readonly origin: Vec3;
  readonly velocity: Vec3;
}

export interface GameExports extends GameSimulation<GameStateSnapshot> {
  spawnWorld(): void;
}

export function createGame(engine: { trace(start: Vec3, end: Vec3): unknown }, options: GameCreateOptions): GameExports {
  const gravity = options.gravity;
  let timeMs = 0;
  let origin: Vec3 = { x: 0, y: 0, z: 0 };
  let velocity: Vec3 = { x: 0, y: 0, z: 0 };

  const snapshot = (frame: number): GameFrameResult<GameStateSnapshot> => ({
    frame,
    timeMs,
    state: {
      gravity,
      origin: { ...origin },
      velocity: { ...velocity },
    },
  });

  return {
    init(startTimeMs: number) {
      timeMs = startTimeMs;
      void engine.trace({ x: 0, y: 0, z: 0 }, gravity);
      return snapshot(0);
    },
    shutdown() {
      /* placeholder shutdown */
    },
    spawnWorld() {
      /* placeholder world spawn */
    },
    frame({ frame, deltaMs }: FixedStepContext) {
      const deltaSeconds = deltaMs / 1000;
      velocity = {
        x: velocity.x,
        y: velocity.y,
        z: velocity.z + gravity.z * deltaSeconds,
      };
      origin = {
        x: origin.x + velocity.x * deltaSeconds,
        y: origin.y + velocity.y * deltaSeconds,
        z: origin.z + velocity.z * deltaSeconds,
      };
      timeMs += deltaMs;
      return snapshot(frame);
    },
  };
}
