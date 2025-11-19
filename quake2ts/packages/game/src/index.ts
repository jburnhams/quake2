import type {
  GameFrameResult,
  GameSimulation,
  FixedStepContext,
} from '@quake2ts/engine';
import type { Vec3 } from '@quake2ts/shared';
import { EntitySystem } from './entities/index.js';
import { GameFrameLoop } from './loop.js';
import { LevelClock, type LevelFrameState } from './level.js';
export * from './entities/index.js';
export * from './ai/index.js';

const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 } as const;

export interface GameCreateOptions {
  gravity: Vec3;
}

export interface GameStateSnapshot {
  readonly gravity: Vec3;
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly level: LevelFrameState;
  readonly entities: {
    readonly activeCount: number;
    readonly worldClassname: string;
  };
}

export interface GameExports extends GameSimulation<GameStateSnapshot> {
  spawnWorld(): void;
  readonly entities: EntitySystem;
}

export * from './save/index.js';
export * from './combat/index.js';

export function createGame(
  engine: { trace(start: Vec3, end: Vec3): unknown },
  options: GameCreateOptions,
): GameExports {
  const gravity = options.gravity;
  const levelClock = new LevelClock();
  const frameLoop = new GameFrameLoop();
  const entities = new EntitySystem();
  frameLoop.addStage('prep', (context) => {
    levelClock.tick(context);
    entities.beginFrame(levelClock.current.timeSeconds);
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

    entities.runFrame();
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
      entities: {
        activeCount: entities.activeCount,
        worldClassname: entities.world.classname,
      },
    },
  });

  const resetState = (startTimeMs: number) => {
    frameLoop.reset(startTimeMs);
    levelClock.start(startTimeMs);
    origin = { ...ZERO_VEC3 };
    velocity = { ...ZERO_VEC3 };
    entities.beginFrame(startTimeMs / 1000);
    entities.runFrame();
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
    entities,
  };
}
