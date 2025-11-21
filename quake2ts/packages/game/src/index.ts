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

export interface GameEngine {
    trace(start: Vec3, end: Vec3): unknown;
    sound?(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void;
    centerprintf?(entity: Entity, message: string): void;
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

import { findPlayerStart } from './entities/spawn.js';

import { UserCommand, applyPmove, PmoveTraceResult } from '@quake2ts/shared';
import { Entity } from './entities/entity.js';

export interface GameExports extends GameSimulation<GameStateSnapshot> {
  spawnWorld(): void;
  readonly entities: EntitySystem;
  sound(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void;
  centerprintf(entity: Entity, message: string): void;
  readonly time: number;
}

export { hashGameState } from './checksum.js';
export * from './save/index.js';
export * from './combat/index.js';
export * from './inventory/index.js';
import { createPlayerInventory } from './inventory/index.js';
import { createPlayerWeaponStates } from './combat/index.js';

import { CollisionModel } from '@quake2ts/shared';

export function createGame(
  trace: (start: Vec3, end: Vec3) => PmoveTraceResult,
  pointContents: (point: Vec3) => number,
  engine: GameEngine,
  options: GameCreateOptions,
): GameExports {
  const gravity = options.gravity;
  const levelClock = new LevelClock();
  const frameLoop = new GameFrameLoop();
  const entities = new EntitySystem(engine);
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
      return snapshot(0);
    },
    shutdown() {
      /* placeholder shutdown */
    },
    spawnWorld() {
      const playerStart = findPlayerStart(entities);
      if (playerStart) {
        const player = entities.spawn();
        player.classname = 'player';
        player.origin = { ...playerStart.origin };
        player.angles = { ...playerStart.angles };
        player.health = 100;
        player.mins = { x: -16, y: -16, z: -24 };
        player.maxs = { x: 16, y: 16, z: 32 };
        player.client = {
            inventory: createPlayerInventory(),
            weaponStates: createPlayerWeaponStates(),
        };
        entities.finalizeSpawn(player);
        origin = { ...player.origin };
      }
    },
    frame(step: FixedStepContext, command?: UserCommand) {
      const context = frameLoop.advance(step);
      const player = entities.find((e) => e.classname === 'player');
      if (command && player) {
        const pcmd = {
          forwardmove: command.forwardmove,
          sidemove: command.sidemove,
          upmove: command.upmove,
          buttons: command.buttons,
        };
        const playerState = { origin: player.origin, velocity: player.velocity, onGround: false, waterLevel: 0, mins: player.mins, maxs: player.maxs };
        const newState = applyPmove(playerState, pcmd, trace, pointContents);
        player.origin = newState.origin;
        player.velocity = newState.velocity;
      }
      return snapshot(context.frame);
    },
    entities,
    sound(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void {
      entities.sound(entity, channel, sound, volume, attenuation, timeofs);
    },
    centerprintf(entity: Entity, message: string): void {
      engine.centerprintf?.(entity, message);
    },
    get time() {
      return levelClock.current.timeSeconds;
    }
  };
}
