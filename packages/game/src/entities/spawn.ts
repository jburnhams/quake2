import { MASK_SOLID, RenderFx, type Vec3 } from '@quake2ts/shared';
import { G_FixStuckObject } from '../ai/monsterStart.js';
import {
  ENTITY_FIELD_METADATA,
  type EntityFieldDescriptor,
  Entity,
  MoveType,
  Solid,
  SPAWNFLAG_NOT_EASY,
  SPAWNFLAG_NOT_MEDIUM,
  SPAWNFLAG_NOT_HARD,
  SPAWNFLAG_NOT_DEATHMATCH,
  SPAWNFLAG_NOT_COOP,
  EntityFlags,
} from './entity.js';
import { registerMiscSpawns } from './misc.js';
import { registerTargetSpawns } from './targets.js';
import { registerTriggerSpawns } from './triggers/index.js';
import { registerItemSpawns } from './items.js';
import { registerFuncSpawns } from './funcs.js';
import { registerPathSpawns } from './paths.js';
import { registerLightSpawns } from './lights.js';
import { registerMonsterSpawns } from './monsters/index.js';
import { registerWorldSpawn } from './worldspawn.js';
import { registerTargetCamera } from './camera.js';
import type { EntitySystem } from './system.js';

/** PLAYER_MINS and PLAYER_MAXS (g_local.h). */
const PLAYER_MINS: Vec3 = { x: -16, y: -16, z: -24 };
const PLAYER_MAXS: Vec3 = { x: 16, y: 16, z: 32 };

export type ParsedEntity = Record<string, string>;

type ParseableKeys = keyof Entity & string;
type FieldLookupEntry = EntityFieldDescriptor<ParseableKeys>;

const FIELD_LOOKUP: ReadonlyMap<ParseableKeys, FieldLookupEntry> = new Map(
  ENTITY_FIELD_METADATA.map((field) => [field.name as ParseableKeys, field as FieldLookupEntry]),
);

function parseVec3(text: string): Vec3 {
  const parts = text.trim().split(/\s+/);
  const [x = 0, y = 0, z = 0] = parts.map((part) => Number.parseFloat(part)).map((value) => (Number.isNaN(value) ? 0 : value));
  return { x, y, z } as const;
}

function parseBoolean(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseValue(type: FieldLookupEntry['type'], value: string): unknown {
  switch (type) {
    case 'int':
      return Number.parseInt(value, 10) || 0;
    case 'float':
      return Number.parseFloat(value) || 0;
    case 'boolean':
      return parseBoolean(value);
    case 'vec3':
      return parseVec3(value);
    case 'string':
      return value;
    case 'entity':
    case 'callback':
      return undefined;
    default:
      return value;
  }
}

export function applyEntityKeyValues(entity: Entity, values: ParsedEntity): void {
  if ('angle' in values && !('angles' in values)) {
    entity.angles = { x: 0, y: Number.parseFloat(values.angle) || 0, z: 0 };
  }

  for (const [key, rawValue] of Object.entries(values)) {
    if (key.startsWith('_')) {
      continue;
    }

    const descriptor = FIELD_LOOKUP.get(key as ParseableKeys);
    if (!descriptor) {
      continue;
    }

    const parsed = parseValue(descriptor.type, rawValue);
    if (parsed !== undefined) {
      (entity as unknown as Record<ParseableKeys, unknown>)[descriptor.name] = parsed;
    }
  }

  entity.size = {
    x: entity.maxs.x - entity.mins.x,
    y: entity.maxs.y - entity.mins.y,
    z: entity.maxs.z - entity.mins.z,
  } as const;
}

function parseQuoted(text: string, start: number): { value: string; nextIndex: number } {
  let index = start;
  let result = '';
  while (index < text.length) {
    const char = text[index];
    if (char === '"') {
      return { value: result, nextIndex: index + 1 };
    }
    result += char;
    index += 1;
  }
  throw new Error('Unterminated quoted string in entity lump');
}

function consumeWhitespace(text: string, start: number): number {
  let index = start;
  while (index < text.length && /\s/.test(text[index] ?? '')) {
    index += 1;
  }
  return index;
}

function parseToken(text: string, start: number): { token: string | null; nextIndex: number } {
  const index = consumeWhitespace(text, start);
  if (index >= text.length) {
    return { token: null, nextIndex: index };
  }

  const current = text[index];
  if (current === '{' || current === '}') {
    return { token: current, nextIndex: index + 1 };
  }

  if (current !== '"') {
    // throw new Error(`Unexpected token in entity lump: ${current}`);
    // Quake 2 entity parser is very lenient. It might encounter garbage or unquoted strings?
    // But usually keys/values are quoted.
    // However, sometimes map compilers output unquoted numbers?
    // Let's assume non-quoted tokens are valid if they are not {}
    // We'll read until next whitespace.
    let end = index;
    while (end < text.length && !/\s/.test(text[end]) && text[end] !== '{' && text[end] !== '}') {
      end++;
    }
    return { token: text.substring(index, end), nextIndex: end };
  }

  const quoted = parseQuoted(text, index + 1);
  return { token: quoted.value, nextIndex: quoted.nextIndex };
}

export function parseEntityLump(text: string): ParsedEntity[] {
  const entities: ParsedEntity[] = [];
  let index = 0;

  while (index < text.length) {
    const open = parseToken(text, index);
    index = open.nextIndex;
    if (open.token === null) {
      break;
    }
    if (open.token !== '{') {
      // In some BSPs, there might be garbage at the end of the entity lump?
      // Token consumption logic might be too strict.
      // If we encounter a token that is not { but we are at top level, check if it's whitespace-ish or similar.
      // Alternatively, previous parseToken might have consumed something weird.

      // Let's try to just skip until we find { or EOF.
      // This matches more resilient C parsing.
      while (index < text.length && text[index] !== '{') {
          index++;
      }
      if (index >= text.length) break;
      // If we found {, continue loop (which will call parseToken again)
      // Actually we need to restart this loop iteration effectively.
      // But parseToken is called at top of loop.
      // Let's just continue and let the next parseToken handle it.
      continue;

      // throw new Error('Expected { at start of entity definition');
    }

    const entity: ParsedEntity = {};

    while (true) {
      const keyToken = parseToken(text, index);
      index = keyToken.nextIndex;
      if (keyToken.token === null) {
        throw new Error('EOF reached while parsing entity');
      }
      if (keyToken.token === '}') {
        break;
      }

      const valueToken = parseToken(text, index);
      index = valueToken.nextIndex;
      if (valueToken.token === null || valueToken.token === '{' || valueToken.token === '}') {
        throw new Error('Malformed entity key/value pair');
      }

      if (!keyToken.token.startsWith('_')) {
        entity[keyToken.token] = valueToken.token;
      }
    }

    entities.push(entity);
  }

  return entities;
}

export interface SpawnContext {
  readonly keyValues: ParsedEntity;
  readonly entities: EntitySystem;
  readonly health_multiplier: number;
  warn(message: string): void;
  free(entity: Entity): void;
}

export type SpawnFunction = (entity: Entity, context: SpawnContext) => void;

export class SpawnRegistry {
  private readonly registry = new Map<string, SpawnFunction>();

  register(classname: string, spawn: SpawnFunction): void {
    this.registry.set(classname, spawn);
  }

  unregister(classname: string): void {
    this.registry.delete(classname);
  }

  get(classname: string): SpawnFunction | undefined {
    return this.registry.get(classname);
  }

  keys(): IterableIterator<string> {
    return this.registry.keys();
  }
}

function defaultWarn(message: string): void {
  void message;
}

export interface SpawnOptions {
  readonly registry: SpawnRegistry;
  readonly entities: EntitySystem;
  readonly onWarning?: (message: string) => void;
}

const SPAWNFLAG_COOP_ONLY = 0x00004000;
/** SPAWNFLAG_EDITOR_MASK: the skill, mode and reserved bits, cleared once an entity is kept. */
const SPAWNFLAG_EDITOR_MASK = 0x0000ff00;
/** BODY_QUEUE_SIZE (g_local.h). */
export const BODY_QUEUE_SIZE = 8;

/** G_InhibitEntity (g_spawn.cpp): whether this skill or game mode leaves the entity out. */
function inhibitEntity(entity: Entity, entities: EntitySystem): boolean {
  const flags = entity.spawnflags;
  if (entities.deathmatch) return (flags & SPAWNFLAG_NOT_DEATHMATCH) !== 0;
  const coop = (entities as { coop?: boolean }).coop ?? false;
  if (coop && flags & SPAWNFLAG_NOT_COOP) return true;
  if (!coop && flags & SPAWNFLAG_COOP_ONLY) return true;
  const skill = entities.skill;
  return (
    (skill === 0 && (flags & SPAWNFLAG_NOT_EASY) !== 0) ||
    (skill === 1 && (flags & SPAWNFLAG_NOT_MEDIUM) !== 0) ||
    (skill >= 2 && (flags & SPAWNFLAG_NOT_HARD) !== 0)
  );
}

/** InitBodyQue (p_client.cpp): reserve some spots for dead player bodies for coop / deathmatch. */
export function initBodyQue(entities: EntitySystem): void {
  for (let i = 0; i < BODY_QUEUE_SIZE; i++) {
    const ent = entities.spawn();
    ent.classname = 'bodyque';
  }
  entities.bodyQueueSize = BODY_QUEUE_SIZE;
}

/**
 * One entity of SpawnEntities' loop: the world takes edict 0 and every other entity a new
 * edict (G_Spawn); ED_ParseEdict fills it, G_InhibitEntity may free it again, then
 * ED_CallSpawn runs its spawn function.
 */
export function spawnEntityFromDictionary(dictionary: ParsedEntity, options: SpawnOptions): Entity | null {
  const warn = options.onWarning ?? defaultWarn;
  const classname = dictionary.classname;
  const isWorld = classname === 'worldspawn';
  const entity = isWorld ? options.entities.world : options.entities.spawn();
  applyEntityKeyValues(entity, dictionary);

  // remove things (except the world) from different skill levels or deathmatch
  if (!isWorld) {
    if (inhibitEntity(entity, options.entities)) {
      options.entities.freeImmediate(entity);
      return null;
    }
    entity.spawnflags &= ~SPAWNFLAG_EDITOR_MASK;
  }

  // PGM - do this before calling the spawn function so it can be overridden.
  entity.gravityVector = { x: 0, y: 0, z: -1 };

  const context: SpawnContext = {
    keyValues: dictionary,
    entities: options.entities,
    health_multiplier: dictionary.health_multiplier ? Number.parseFloat(dictionary.health_multiplier) : 1.0,
    warn,
    free(target) {
      options.entities.freeImmediate(target);
    },
  };

  // ED_CallSpawn: an entity with no spawn function is freed, and so is one with no classname.
  const spawnFunc = classname ? options.registry.get(classname) : undefined;
  if (!spawnFunc) {
    warn(classname ? `${classname} doesn't have a spawn function` : 'ED_CallSpawn: nullptr classname');
    if (!isWorld) options.entities.freeImmediate(entity);
    return null;
  }

  // Brush entities name a submodel ("*3"). The original spawn functions call gi.setmodel,
  // which sets modelindex and copies the submodel's bounds; doing it here, before the spawn
  // function runs, gives doors and plats the size their movement is worked out from.
  if (entity.model && entity.model.startsWith('*')) {
    options.entities.setModel(entity, entity.model);
  }

  spawnFunc(entity, context);

  // SpawnEntities: every entity is visible to IR goggles (PGM), freed or not.
  entity.renderfx |= RenderFx.IrVisible;

  if (!entity.inUse) {
    return null;
  }

  // The original spawn functions set s.modelindex = gi.modelindex("models/.../tris.md2"); the
  // port's (every monster, barrels, dead bodies) name the model in `model` only, so without this
  // they spawn with modelindex 0 and are never sent to the renderer (monsters were invisible in /play).
  if (entity.model && !entity.model.startsWith('*') && !entity.modelindex) {
    entity.modelindex = options.entities.modelIndex(entity.model);
  }

  options.entities.finalizeSpawn(entity);

  return entity;
}

/** SpawnEntities (g_spawn.cpp): the body queue, then the entity lump in order, then the teams. */
export function spawnEntitiesFromText(text: string, options: SpawnOptions): Entity[] {
  const parsed = parseEntityLump(text);
  const spawned: Entity[] = [];

  initBodyQue(options.entities);

  for (const dictionary of parsed) {
    const entity = spawnEntityFromDictionary(dictionary, options);
    if (entity) {
      spawned.push(entity);
    }
  }

  findTeams(options.entities);
  return spawned;
}

/**
 * G_FindTeams (g_spawn.cpp): entities with the same "team" key become one team, chained
 * in index order through teamchain, with the first as teammaster and the rest flagged
 * TeamSlave. Doors and other movers act on their whole team.
 */
export function findTeams(entities: EntitySystem): void {
  const members: Entity[] = [];
  entities.forEachEntity((e) => {
    if (e.index > 0 && e.team) members.push(e);
  });
  members.sort((a, b) => a.index - b.index);
  for (let i = 0; i < members.length; i++) {
    const e = members[i];
    if (e.flags & EntityFlags.TeamSlave) continue;
    let chain = e;
    e.teammaster = e;
    e.flags |= EntityFlags.TeamMaster;
    for (let j = i + 1; j < members.length; j++) {
      const e2 = members[j];
      if (e2.flags & EntityFlags.TeamSlave) continue;
      if (e.team === e2.team) {
        chain.teamchain = e2;
        e2.teammaster = e;
        chain = e2;
        e2.flags |= EntityFlags.TeamSlave;
      }
    }
  }
}

export function SelectDeathmatchSpawnPoint(entities: EntitySystem): Entity | undefined {
  const spots = entities.findByClassname('info_player_deathmatch');
  if (spots.length === 0) {
    return undefined;
  }
  const index = Math.floor(entities.rng.frandom() * spots.length);
  return spots[index];
}

/**
 * SelectSpawnPoint: a deathmatch spot in deathmatch; otherwise SelectSingleSpawnPoint, the
 * info_player_start whose targetname is game.spawnpoint (the one with none when the level was
 * not entered through a named spot), then any without a targetname, then any at all.
 */
export function SelectSpawnPoint(entities: EntitySystem): Entity | undefined {
  if (entities.deathmatch) {
    const spot = SelectDeathmatchSpawnPoint(entities);
    if (spot) return spot;
  }
  return SelectSingleSpawnPoint(entities);
}

/** SelectSingleSpawnPoint */
export function SelectSingleSpawnPoint(entities: EntitySystem): Entity | undefined {
  const starts = entities.findByClassname('info_player_start');
  const spawnpoint = entities.spawnpoint;
  let spot = starts.find((e) => {
    if (!spawnpoint && !e.targetname) return true;
    if (!spawnpoint || !e.targetname) return false;
    return spawnpoint.toLowerCase() === e.targetname.toLowerCase();
  });
  // there wasn't a matching targeted spawnpoint, use one that has no targetname
  if (!spot) spot = starts.find((e) => !e.targetname);
  // none at all, so just pick any
  return spot ?? starts[0];
}

/** The spot the single-player game puts the player at. */
export function findPlayerStart(entities: EntitySystem): Entity | undefined {
  return SelectSingleSpawnPoint(entities);
}

/** SP_info_player_start: fix stuck spawn points. */
const SP_info_player_start: SpawnFunction = (self, context) => {
  const sys = context.entities;
  if (sys.trace(self.origin, PLAYER_MINS, PLAYER_MAXS, self.origin, self, MASK_SOLID).startsolid) G_FixStuckObject(self, { ...self.origin }, sys);
};

export function registerDefaultSpawns(registry: SpawnRegistry, game?: any): void {
  registerWorldSpawn(registry);

  registry.register('info_player_start', SP_info_player_start);

  // SP_info_player_deathmatch: only in deathmatch (where it is SP_misc_teleporter_dest)
  registry.register('info_player_deathmatch', (self, context) => {
    if (!context.entities.deathmatch) {
      context.free(self);
      return;
    }
    context.entities.setModel(self, 'models/objects/dmspot/tris.md2');
    self.skin = 0;
    self.solid = Solid.BoundingBox;
    self.mins = { x: -32, y: -32, z: -24 };
    self.maxs = { x: 32, y: 32, z: -16 };
    context.entities.linkentity(self);
  });

  // SP_info_player_coop and SP_info_player_coop_lava: only in coop
  const coopStart: SpawnFunction = (self, context) => {
    if (!context.entities.coop) {
      context.free(self);
      return;
    }
    SP_info_player_start(self, context);
  };
  registry.register('info_player_coop', coopStart);
  registry.register('info_player_coop_lava', coopStart);

  // SP_info_player_intermission: nothing
  registry.register('info_player_intermission', () => {});

  registry.register('info_null', (entity, context) => {
    context.free(entity);
  });

  registry.register('info_notnull', () => {
    // Placeholder positional target
  });

  registry.register('info_teleport_destination', () => {
    // Destination marker for trigger_teleport
  });

  registerTriggerSpawns(registry);
  registerTargetSpawns(registry);
  registerMiscSpawns(registry);
  if (game) {
    registerItemSpawns(game, registry);
  }
  registerFuncSpawns(registry);
  registerPathSpawns(registry);
  registerLightSpawns(registry);
  registerMonsterSpawns(registry);
  registerTargetCamera(registry);
}

export function createDefaultSpawnRegistry(game: any): SpawnRegistry {
  const registry = new SpawnRegistry();
  registerDefaultSpawns(registry, game);
  return registry;
}
