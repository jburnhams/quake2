import type {
  GameFrameResult,
  GameSimulation,
  FixedStepContext,
} from '@quake2ts/engine';
import type { Vec3 } from '@quake2ts/shared';
import { EntitySystem } from './entities/index.js';
import { GameFrameLoop } from './loop.js';
import { LevelClock, type LevelFrameState } from './level.js';
import { createSaveFile, applySaveFile, GameSaveFile } from './save/index.js';
import { RandomGenerator } from '@quake2ts/shared';
export * from './entities/index.js';
export * from './ai/index.js';

const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 } as const;

export interface GameCreateOptions {
  gravity: Vec3;
  deathmatch?: boolean;
}

import { ServerCommand } from '@quake2ts/shared';
import { MulticastType } from './imports.js';

export interface GameEngine {
    trace(start: Vec3, end: Vec3): unknown;
    sound?(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void;
    centerprintf?(entity: Entity, message: string): void;
    modelIndex?(model: string): number;
    multicast?(origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]): void;
    unicast?(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void;
}

export interface GameStateSnapshot {
  readonly gravity: Vec3;
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly viewangles: Vec3; // Added
  readonly level: LevelFrameState;
  readonly entities: {
    readonly activeCount: number;
    readonly worldClassname: string;
  };
  readonly pmFlags: number; // PmFlags
  readonly pmType: number; // PmType
  readonly waterlevel: number;
  readonly deltaAngles: Vec3;
  readonly client?: PlayerClient;
  readonly health: number;
  readonly armor: number;
  readonly ammo: number;
  readonly blend: [number, number, number, number];
  readonly pickupIcon?: string;
  readonly damageAlpha: number;
  readonly damageIndicators: any[];
}

import { findPlayerStart } from './entities/spawn.js';
import { player_die, player_think } from './entities/player.js';

import { UserCommand, applyPmove, PmoveTraceResult } from '@quake2ts/shared';
import { Entity, MoveType } from './entities/entity.js';

import { GameTraceResult } from './imports.js';
import { throwGibs } from './entities/gibs.js';

export interface GameExports extends GameSimulation<GameStateSnapshot> {
  spawnWorld(): void;
  readonly entities: EntitySystem;
  sound(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void;
  centerprintf(entity: Entity, message: string): void;
  readonly time: number;
  readonly deathmatch: boolean;
  trace(start: Vec3, mins: Vec3 | null, maxs: Vec3 | null, end: Vec3, passent: Entity | null, contentmask: number): GameTraceResult;
  multicast(origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]): void;
  unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void;
  createSave(mapName: string, difficulty: number, playtimeSeconds: number): GameSaveFile;
  loadSave(save: GameSaveFile): void;
}

export { hashGameState, hashEntitySystem } from './checksum.js';
export * from './save/index.js';
export * from './combat/index.js';
export * from './inventory/index.js';
import { createPlayerInventory, PlayerClient, PowerupId } from './inventory/index.js';
import { createPlayerWeaponStates } from './combat/index.js';

import { CollisionModel } from '@quake2ts/shared';

import { GameImports } from './imports.js';
export type { GameImports }; // Export GameImports type

export function createGame(
  { trace, pointcontents, multicast, unicast }: GameImports,
  engine: GameEngine,
  options: GameCreateOptions
): GameExports {
  const gravity = options.gravity;
  const deathmatch = options.deathmatch ?? false;
  const levelClock = new LevelClock();
  const frameLoop = new GameFrameLoop();
  const rng = new RandomGenerator(); // Main game RNG

  const linkentity = (ent: Entity) => {
    ent.absmin = {
      x: ent.origin.x + ent.mins.x,
      y: ent.origin.y + ent.mins.y,
      z: ent.origin.z + ent.mins.z,
    };
    ent.absmax = {
      x: ent.origin.x + ent.maxs.x,
      y: ent.origin.y + ent.maxs.y,
      z: ent.origin.z + ent.maxs.z,
    };
  };

  const entities = new EntitySystem(engine, { trace, pointcontents, linkentity, multicast, unicast }, gravity);
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

  // Helper to calculate blend
  const calculateBlend = (player: Entity | undefined, time: number): [number, number, number, number] => {
      const blend: [number, number, number, number] = [0, 0, 0, 0];
      if (!player || !player.client) return blend;

      const inventory = player.client.inventory;

      // Powerup blends
      // Quad Damage: Blue
      if (inventory.powerups.has(PowerupId.QuadDamage)) {
           blend[2] = 1;
           blend[3] = 0.08;
      }
      // Invulnerability: Yellow/Red?
      if (inventory.powerups.has(PowerupId.Invulnerability)) {
           blend[0] = 1;
           blend[1] = 1;
           blend[3] = 0.08;
      }
      // Enviro Suit: Green
       if (inventory.powerups.has(PowerupId.EnviroSuit)) {
           blend[1] = 1;
           blend[3] = 0.08;
      }
       // Rebreather: Whiteish?
       if (inventory.powerups.has(PowerupId.Rebreather)) {
           blend[0] = 0.4;
           blend[1] = 1;
           blend[2] = 0.4;
           blend[3] = 0.04;
      }

      return blend;
  };

  const snapshot = (frame: number): GameFrameResult<GameStateSnapshot> => {
    const player = entities.find(e => e.classname === 'player');

    // Calculate pickup icon expiration
    let pickupIcon: string | undefined = undefined;
    if (player?.client?.inventory.pickupItem && player.client.inventory.pickupTime) {
        if (levelClock.current.timeSeconds * 1000 < player.client.inventory.pickupTime + 3000) {
            pickupIcon = player.client.inventory.pickupItem;
        }
    }

    return {
      frame,
      timeMs: frameLoop.time,
      state: {
        gravity: { ...gravity },
        origin: player ? { ...player.origin } : { ...origin },
        velocity: player ? { ...player.velocity } : { ...velocity },
        viewangles: player ? { ...player.angles } : { x:0, y:0, z:0 },
        level: { ...levelClock.current },
        entities: {
          activeCount: entities.activeCount,
          worldClassname: entities.world.classname,
        },
        pmFlags: 0, // TODO: get from player
        pmType: 0,
        waterlevel: player ? player.waterlevel : 0,
        deltaAngles: { x: 0, y: 0, z: 0 },
        client: player?.client,
        health: player?.health ?? 0,
        armor: player?.client?.inventory.armor?.armorCount ?? 0,
        ammo: 0, // TODO: get current weapon ammo
        blend: calculateBlend(player, frameLoop.time),
        pickupIcon,
        damageAlpha: 0, // TODO
        damageIndicators: []
      },
    };
  };

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
      const player = entities.spawn();
      player.classname = 'player';
      player.origin = playerStart ? { ...playerStart.origin } : { x: 0, y: 0, z: 0 };
      player.angles = playerStart ? { ...playerStart.angles } : { x: 0, y: 0, z: 0 };
      player.health = 100;
      player.takedamage = true; // Players take damage!
      player.movetype = MoveType.Toss;
      player.mins = { x: -16, y: -16, z: -24 };
      player.maxs = { x: 16, y: 16, z: 32 };
      player.client = {
          inventory: createPlayerInventory(),
          weaponStates: createPlayerWeaponStates(),
      };

      // Attach die callback
      player.die = (self, inflictor, attacker, damage, point, mod) => {
         // Use closure to access entities for gibs/obituaries
         player_die(self, inflictor, attacker, damage, point, mod, entities);
      };

      // Attach think callback
      player.think = (self) => {
          player_think(self, entities);
      };
      player.nextthink = entities.timeSeconds + 0.1;
      entities.scheduleThink(player, player.nextthink);

      entities.finalizeSpawn(player);
      origin = { ...player.origin };
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
          msec: command.msec,
          angles: command.angles,
        };
        // We really should use pmove state from the entity if possible
        const playerState = {
            origin: player.origin,
            velocity: player.velocity,
            onGround: false, // Should be persistent
            waterLevel: 0,
            mins: player.mins,
            maxs: player.maxs,
            damageAlpha: 0,
            damageIndicators: [],
            viewAngles: player.angles,
            blend: [0,0,0,0] as [number, number, number, number]
        };

        // Adapter functions to match pmove signatures
        const traceAdapter = (start: Vec3, end: Vec3) => {
          const result = trace(start, player.mins, player.maxs, end, player, 0x10000001);
          return {
            fraction: result.fraction,
            endpos: result.endpos,
            allsolid: result.allsolid,
            startsolid: result.startsolid,
            planeNormal: result.plane?.normal,
          };
        };
        const pointContentsAdapter = (point: Vec3) => pointcontents(point);

        const newState = applyPmove(playerState, pcmd, traceAdapter, pointContentsAdapter);
        player.origin = newState.origin;
        player.velocity = newState.velocity;
        player.angles = newState.viewAngles; // Update angles
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
    trace,
    deathmatch,
    multicast(origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]): void {
      multicast(origin, type, event, ...args);
    },
    unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void {
      unicast(ent, reliable, event, ...args);
    },
    get time() {
      return levelClock.current.timeSeconds;
    },
    createSave(mapName: string, difficulty: number, playtimeSeconds: number): GameSaveFile {
      const player = entities.find((e) => e.classname === 'player');
      return createSaveFile({
        map: mapName,
        difficulty,
        playtimeSeconds,
        levelState: levelClock.snapshot(),
        entitySystem: entities,
        rngState: rng.getState(),
        player: player?.client?.inventory
      });
    },
    loadSave(save: GameSaveFile): void {
      const player = entities.find((e) => e.classname === 'player');
      applySaveFile(save, {
        levelClock,
        entitySystem: entities,
        rng,
        player: player?.client?.inventory
      });
      // After load, sync engine state
      origin = player ? { ...player.origin } : { ...ZERO_VEC3 };
      velocity = player ? { ...player.velocity } : { ...ZERO_VEC3 };
      frameLoop.reset(save.level.timeSeconds * 1000);
    }
  };
}
