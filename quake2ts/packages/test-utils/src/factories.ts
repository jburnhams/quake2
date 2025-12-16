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
  pm_time: 0,
  pm_flags: 0,
  origin: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  viewAngles: { x: 0, y: 0, z: 0 },
  onGround: false,
  waterLevel: 0,
  mins: { x: 0, y: 0, z: 0 },
  maxs: { x: 0, y: 0, z: 0 },
  damageAlpha: 0,
  damageIndicators: [],
  blend: [0, 0, 0, 0],
  stats: [],
  kick_angles: { x: 0, y: 0, z: 0 },
  kick_origin: { x: 0, y: 0, z: 0 },
  gunoffset: { x: 0, y: 0, z: 0 },
  gunangles: { x: 0, y: 0, z: 0 },
  gunindex: 0,
  gun_frame: 0,
  rdflags: 0,
  fov: 90,
  renderfx: 0,
  ...overrides,
});

export const createEntityStateFactory = (overrides?: Partial<EntityState>): EntityState => ({
  number: 0,
  origin: { x: 0, y: 0, z: 0 },
  angles: { x: 0, y: 0, z: 0 },
  oldOrigin: { x: 0, y: 0, z: 0 },
  modelIndex: 0,
  modelIndex2: 0,
  modelIndex3: 0,
  modelIndex4: 0,
  frame: 0,
  skinNum: 0,
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
