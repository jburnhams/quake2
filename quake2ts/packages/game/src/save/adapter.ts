import type { PlayerState } from '@quake2ts/shared';
import type {
  EntitySystem,
  SerializedEntityState,
  LevelState,
  EntitySystemSnapshot
} from '../entities/index.js';
import {
  type SerializedPlayerInventory,
  serializePlayerInventory,
  deserializePlayerInventory,
  type PlayerInventory
} from '../inventory/index.js';
import type { LevelClock } from '../level.js';
import { populatePlayerStats } from '../entities/playerStats.js';
import { Entity } from '../entities/entity.js';
import { RandomGenerator } from '@quake2ts/shared';
import type { RandomGeneratorState } from '@quake2ts/shared';

export interface SerializedGameState {
  mapName: string;
  playerState: PlayerState;
  entities: SerializedEntityState[];
  levelState: LevelState;
  time: number;
  playerInventory?: SerializedPlayerInventory;
  rngState?: RandomGeneratorState;
  // Full internal snapshot to ensure lossless restoration (thinks, pool, awareness)
  _internalSnapshot?: EntitySystemSnapshot;
}

export interface AdapterContext {
  entitySystem: EntitySystem;
  levelClock: LevelClock;
  random?: RandomGenerator;
}

export function createSerializedGameState(context: AdapterContext): SerializedGameState {
  const { entitySystem, levelClock, random } = context;

  // Find player
  const player = entitySystem.find(e => e.classname === 'player');

  // Create entity snapshot
  const sysSnapshot = entitySystem.createSnapshot();

  // Construct PlayerState
  // This constructs the client-side view of the player
  const playerState: PlayerState = {
    origin: player ? { ...player.origin } : { x: 0, y: 0, z: 0 },
    velocity: player ? { ...player.velocity } : { x: 0, y: 0, z: 0 },
    viewAngles: player ? { ...player.angles } : { x: 0, y: 0, z: 0 },
    onGround: player ? (player.groundentity !== null) : false,
    waterLevel: player ? player.waterlevel : 0,
    mins: player ? { ...player.mins } : { x: -16, y: -16, z: -24 },
    maxs: player ? { ...player.maxs } : { x: 16, y: 16, z: 32 },
    damageAlpha: player?.client?.damage_alpha ?? 0,
    damageIndicators: [], // Transient
    blend: [0, 0, 0, 0], // Transient
    stats: player ? populatePlayerStats(player, levelClock.current.timeSeconds) : [],
    kick_angles: player?.client?.kick_angles ?? { x: 0, y: 0, z: 0 },
    kick_origin: player?.client?.kick_origin ?? { x: 0, y: 0, z: 0 },
    gunoffset: { x: 0, y: 0, z: 0 },
    gunangles: { x: 0, y: 0, z: 0 },
    gunindex: 0,

    // Q2 Network Compatibility
    pm_type: player?.client?.pm_type ?? 0,
    pm_time: player?.client?.pm_time ?? 0,
    pm_flags: player?.client?.pm_flags ?? 0,
    gun_frame: player?.client?.gun_frame ?? 0,
    rdflags: player?.client?.rdflags ?? 0,
    fov: player?.client?.fov ?? 90,
    renderfx: player?.renderfx ?? 0
  };

  return {
    mapName: entitySystem.level.mapname || 'unknown',
    playerState,
    entities: sysSnapshot.entities,
    levelState: sysSnapshot.level,
    time: levelClock.current.timeSeconds,
    playerInventory: player?.client?.inventory ? serializePlayerInventory(player.client.inventory) : undefined,
    rngState: random?.getState(),
    _internalSnapshot: sysSnapshot
  };
}

export function applySerializedGameState(state: SerializedGameState, context: AdapterContext): void {
  const { entitySystem, levelClock, random } = context;

  // Restore Level Clock
  levelClock.restore({
    frameNumber: 0, // Unknown in this format, reset to 0
    timeSeconds: state.time,
    previousTimeSeconds: state.time,
    deltaSeconds: 0
  });

  // Restore RNG
  if (random && state.rngState) {
    random.setState(state.rngState);
  }

  // Restore Entity System
  if (state._internalSnapshot) {
    entitySystem.restore(state._internalSnapshot);
  } else {
    // Fallback: Best effort restore from partial data
    // This path is risky as it misses Thinks and Pool state
    console.warn("Restoring from partial SerializedGameState. Thinks and Pool state may be lost.");

    const partialSnapshot: EntitySystemSnapshot = {
      timeSeconds: state.time,
      pool: {
        capacity: state.entities.length + 32, // Estimate
        activeOrder: state.entities.map(e => e.index), // Naive
        freeList: [], // Assume none
        pendingFree: []
      },
      entities: state.entities,
      thinks: [], // LOST
      awareness: {
        frameNumber: 0,
        sightEntityIndex: null,
        sightEntityFrame: 0,
        soundEntityIndex: null,
        soundEntityFrame: 0,
        sound2EntityIndex: null,
        sound2EntityFrame: 0,
        sightClientIndex: null,
      },
      crossLevelFlags: 0,
      crossUnitFlags: 0,
      level: state.levelState
    };
    entitySystem.restore(partialSnapshot);
  }

  // Restore Player Inventory
  const player = entitySystem.find(e => e.classname === 'player');
  if (player && state.playerInventory) {
      const inventory = deserializePlayerInventory(state.playerInventory);
      player.client = player.client || {} as any;
      if (player.client) {
        player.client.inventory = inventory;
      }
  }
}
