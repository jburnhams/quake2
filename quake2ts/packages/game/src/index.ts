import type {
  GameFrameResult,
  GameSimulation,
  FixedStepContext,
} from '@quake2ts/engine';
import type { Vec3 } from '@quake2ts/shared';
import { GameFrameLoop } from './loop.js';
import { LevelClock, type LevelFrameState } from './level.js';

const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 } as const;

export interface GameCreateOptions {
  gravity: Vec3;
}

export interface GameStateSnapshot {
  readonly gravity: Vec3;
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly level: LevelFrameState;
}

export interface GameExports extends GameSimulation<GameStateSnapshot> {
  spawnWorld(): void;
}

export function createGame(
  engine: { trace(start: Vec3, end: Vec3): unknown },
  options: GameCreateOptions,
): GameExports {
  const gravity = options.gravity;
  const levelClock = new LevelClock();
  const frameLoop = new GameFrameLoop();
  frameLoop.addStage('prep', (context) => {
    levelClock.tick(context);
  });
  frameLoop.addStage('simulate', ({ deltaSeconds }) => {
    velocity = {
      x: velocity.x + gravity.x * deltaSeconds,
      y: velocity.y + gravity.y * deltaSeconds,
      z: velocity.z + gravity.z * deltaSeconds,
    };

    origin = {
      x: origin.x + velocity.x * deltaSeconds,
      y: origin.y + velocity.y * deltaSeconds,
      z: origin.z + velocity.z * deltaSeconds,
    };
  });

  let origin: Vec3 = { ...ZERO_VEC3 };
  let velocity: Vec3 = { ...ZERO_VEC3 };

  const snapshot = (frame: number): GameFrameResult<GameStateSnapshot> => ({
    frame,
    timeMs: frameLoop.time,
    state: {
      gravity: { ...gravity },
      origin: { ...origin },
      velocity: { ...velocity },
      level: { ...levelClock.current },
    },
  });

  const resetState = (startTimeMs: number) => {
    frameLoop.reset(startTimeMs);
    levelClock.start(startTimeMs);
    origin = { ...ZERO_VEC3 };
    velocity = { ...ZERO_VEC3 };
  };

  return {
    init(startTimeMs: number) {
      resetState(startTimeMs);
      void engine.trace({ x: 0, y: 0, z: 0 }, gravity);
      return snapshot(0);
    },
    shutdown() {
      /* placeholder shutdown */
    },
    spawnWorld() {
      /* placeholder world spawn */
    },
    frame(step: FixedStepContext) {
      const context = frameLoop.advance(step);
      return snapshot(context.frame);
    },
  };
}
