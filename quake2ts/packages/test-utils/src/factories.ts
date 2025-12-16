import type { PlayerState, EntityState } from '@quake2ts/shared';

// Define GameStateSnapshot locally if it's not exported or if we need a specific mock version
// Assuming it matches the structure expected by the game/client
export interface GameStateSnapshot {
  entities: EntityState[];
  playerState: PlayerState;
  timestamp: number;
}

export const createPlayerStateFactory = (overrides?: Partial<PlayerState>): PlayerState => ({
  pm_type: 0,
  origin: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  viewangles: { x: 0, y: 0, z: 0 },
  viewheight: 0,
  weapon_index: 0,
  weapon_frame: 0,
  gun_index: 0,
  gun_frame: 0,
  blend: { r: 0, g: 0, b: 0, a: 0 },
  fov: 90,
  rdflags: 0,
  stats: [],
  ...overrides,
});

export const createEntityStateFactory = (overrides?: Partial<EntityState>): EntityState => ({
  number: 0,
  flags: 0,
  origin: { x: 0, y: 0, z: 0 },
  angles: { x: 0, y: 0, z: 0 },
  old_origin: { x: 0, y: 0, z: 0 },
  model_index: 0,
  model_index2: 0,
  model_index3: 0,
  model_index4: 0,
  frame: 0,
  skin: 0,
  effects: 0,
  renderfx: 0,
  solid: 0,
  sound: 0,
  event: 0,
  ...overrides,
});

export const createGameStateSnapshotFactory = (overrides?: Partial<GameStateSnapshot>): GameStateSnapshot => ({
  entities: [],
  playerState: createPlayerStateFactory(),
  timestamp: Date.now(),
  ...overrides,
});
