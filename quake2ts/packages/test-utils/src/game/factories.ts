import {
  Entity,
  MoveType,
  Solid,
  ServerFlags,
  DeadFlag,
  EntityFlags
} from '@quake2ts/game';
import type { PlayerState, EntityState } from '@quake2ts/shared';
import type { GameStateSnapshot } from '@quake2ts/game';

// -- Shared / Game State Factories --

export const createPlayerStateFactory = (overrides?: Partial<PlayerState>): PlayerState => ({
  pm_type: 0,
  pm_time: 0,
  pm_flags: 0,
  origin: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  viewAngles: { x: 0, y: 0, z: 0 },
  onGround: false,
  waterLevel: 0,
  watertype: 0,
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
  gravity: { x: 0, y: 0, z: -800 },
  origin: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  viewangles: { x: 0, y: 0, z: 0 },
  level: { timeSeconds: 0, frameNumber: 0, previousTimeSeconds: 0, deltaSeconds: 0.1 },
  entities: {
    activeCount: 0,
    worldClassname: 'worldspawn',
  },
  packetEntities: [],
  pmFlags: 0,
  pmType: 0,
  waterlevel: 0,
  watertype: 0,
  deltaAngles: { x: 0, y: 0, z: 0 },
  health: 100,
  armor: 0,
  ammo: 0,
  blend: [0, 0, 0, 0],
  damageAlpha: 0,
  damageIndicators: [],
  stats: [],
  kick_angles: { x: 0, y: 0, z: 0 },
  kick_origin: { x: 0, y: 0, z: 0 },
  gunoffset: { x: 0, y: 0, z: 0 },
  gunangles: { x: 0, y: 0, z: 0 },
  gunindex: 0,
  pm_time: 0,
  gun_frame: 0,
  rdflags: 0,
  fov: 90,
  renderfx: 0,
  pm_flags: 0,
  pm_type: 0,
  ...overrides,
});

// -- Entity Factories --

// Helper to remove internal fields that shouldn't be copied via Object.assign,
// but PRESERVE the Entity prototype so getters/setters/methods work.
function sanitizeEntity(ent: Entity): Partial<Entity> {
  // We modify the instance in place (it's a factory-created one, so safe to mutate).
  // We want to delete properties that would conflict with EntitySystem internals
  // if this object is merged into another Entity via Object.assign.

  // Actually, Object.assign(target, source) only copies enumerable own properties.
  // If we delete them from 'ent', they won't be copied.
  // BUT 'ent' must still be a valid Entity for tests that use the factory result directly.

  // The issue in `dm-spawn.test.ts` was:
  // Object.assign(player, createPlayerEntityFactory(...))
  // 'player' is a REAL entity from the system.
  // 'createPlayerEntityFactory' returns an Entity.
  // 'Entity' class defines 'linkNext = null' etc as instance properties.
  // So Object.assign copies 'linkNext: null'.

  // We need to remove these properties from the returned object so Object.assign doesn't copy them.
  // But we want to keep the prototype.

  const safe = ent as any;
  delete safe.index;
  delete safe.inUse;
  delete safe.freePending;
  delete safe.linkPrevious;
  delete safe.linkNext;
  delete safe.linkcount;

  return ent;
}

export function createEntityFactory(overrides: Partial<Entity> = {}): Partial<Entity> {
  const ent = new Entity(1);
  Object.assign(ent, {
    classname: 'info_null',
    health: 0,
    max_health: 0,
    takedamage: false,
    deadflag: DeadFlag.Alive,
    solid: Solid.Not,
    movetype: MoveType.None,
    flags: 0,
    svflags: 0,
    ...overrides
  });
  return sanitizeEntity(ent);
}

export function createPlayerEntityFactory(overrides: Partial<Entity> = {}): Partial<Entity> {
  return createEntityFactory({
    classname: 'player',
    health: 100,
    max_health: 100,
    takedamage: true,
    solid: Solid.BoundingBox,
    movetype: MoveType.Walk,
    svflags: ServerFlags.Player,
    viewheight: 22,
    ...overrides
  });
}

export function createMonsterEntityFactory(classname: string, overrides: Partial<Entity> = {}): Partial<Entity> {
  return createEntityFactory({
    classname,
    health: 100,
    max_health: 100,
    takedamage: true,
    solid: Solid.BoundingBox,
    movetype: MoveType.Step,
    svflags: ServerFlags.Monster,
    deadflag: DeadFlag.Alive,
    ...overrides
  });
}

export function createItemEntityFactory(classname: string, overrides: Partial<Entity> = {}): Partial<Entity> {
  return createEntityFactory({
    classname,
    solid: Solid.Trigger,
    movetype: MoveType.Toss,
    ...overrides
  });
}

export function createProjectileEntityFactory(classname: string, overrides: Partial<Entity> = {}): Partial<Entity> {
  return createEntityFactory({
    classname,
    solid: Solid.Bsp,
    movetype: MoveType.FlyMissile,
    svflags: ServerFlags.Projectile,
    ...overrides
  });
}

export function createTriggerEntityFactory(classname: string, overrides: Partial<Entity> = {}): Partial<Entity> {
  return createEntityFactory({
    classname,
    solid: Solid.Trigger,
    movetype: MoveType.None,
    ...overrides
  });
}
