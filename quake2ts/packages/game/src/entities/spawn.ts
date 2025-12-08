import type { Vec3 } from '@quake2ts/shared';
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
} from './entity.js';
import { registerMiscSpawns } from './misc.js';
import { registerTargetSpawns } from './targets.js';
import { registerTriggerSpawns } from './triggers.js';
import { registerItemSpawns } from './items.js';
import { registerFuncSpawns } from './funcs.js';
import { registerPathSpawns } from './paths.js';
import { registerLightSpawns } from './lights.js';
import { registerMonsterSpawns } from './monsters/index.js';
import { registerWorldSpawn } from './worldspawn.js';
import { registerTargetCamera } from './camera.js';
import type { EntitySystem } from './system.js';

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

  get(classname: string): SpawnFunction | undefined {
    return this.registry.get(classname);
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

export function spawnEntityFromDictionary(dictionary: ParsedEntity, options: SpawnOptions): Entity | null {
  const warn = options.onWarning ?? defaultWarn;
  const classname = dictionary.classname;
  if (!classname) {
    warn('Encountered entity with no classname');
    return null;
  }

  const isWorld = classname === 'worldspawn';
  const entity = isWorld ? options.entities.world : options.entities.spawn();
  applyEntityKeyValues(entity, dictionary);

  // Check spawn flags for filtering
  if (!isWorld) {
    if ((entity.spawnflags & SPAWNFLAG_NOT_DEATHMATCH) && options.entities.deathmatch) {
      options.entities.freeImmediate(entity);
      return null;
    }

    if ((entity.spawnflags & SPAWNFLAG_NOT_EASY) && options.entities.skill === 0) {
      options.entities.freeImmediate(entity);
      return null;
    }

    if ((entity.spawnflags & SPAWNFLAG_NOT_MEDIUM) && options.entities.skill === 1) {
      options.entities.freeImmediate(entity);
      return null;
    }

    if ((entity.spawnflags & SPAWNFLAG_NOT_HARD) && options.entities.skill >= 2) {
      options.entities.freeImmediate(entity);
      return null;
    }

    // Co-op filtering
    if ((entity.spawnflags & SPAWNFLAG_NOT_COOP) && (options.entities as any).coop) {
      options.entities.freeImmediate(entity);
      return null;
    }
  }

  const context: SpawnContext = {
    keyValues: dictionary,
    entities: options.entities,
    health_multiplier: dictionary.health_multiplier ? Number.parseFloat(dictionary.health_multiplier) : 1.0,
    warn,
    free(target) {
      options.entities.freeImmediate(target);
    },
  };

  const spawnFunc = options.registry.get(classname);
  if (!spawnFunc) {
    warn(`${classname} does not have a spawn function`);
    if (!isWorld) {
      options.entities.freeImmediate(entity);
    }
    return null;
  }

  spawnFunc(entity, context);

  if (!entity.inUse) {
    return null;
  }

  options.entities.finalizeSpawn(entity);

  return entity;
}

export function spawnEntitiesFromText(text: string, options: SpawnOptions): Entity[] {
  const parsed = parseEntityLump(text);
  const spawned: Entity[] = [];

  for (const dictionary of parsed) {
    const entity = spawnEntityFromDictionary(dictionary, options);
    if (entity) {
      spawned.push(entity);
    }
  }

  return spawned;
}

export function findPlayerStart(entities: EntitySystem): Entity | undefined {
  return entities.find(
    (entity: Entity) => entity.classname === 'info_player_start'
  );
}

export function registerDefaultSpawns(registry: SpawnRegistry, game?: any): void {
  registerWorldSpawn(registry);

  registry.register('info_player_start', () => {
    // No-op spawn point
  });

  registry.register('info_player_deathmatch', () => {
    // Deathmatch handling is deferred until game rules are implemented
  });

  registry.register('info_player_coop', () => {
    // Coop spawn points share info_player_start behaviour for now
  });

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
