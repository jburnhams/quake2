import type { Vec3 } from '@quake2ts/shared';
import {
  ENTITY_FIELD_METADATA,
  type EntityFieldDescriptor,
  Entity,
  MoveType,
  Solid,
} from './entity.js';
import { registerMiscSpawns } from './misc.js';
import { registerTargetSpawns } from './targets.js';
import { registerTriggerSpawns } from './triggers.js';
import { registerItemSpawns } from './items.js';
import { registerFuncSpawns } from './funcs.js';
import { registerPathSpawns } from './paths.js';
import { registerLightSpawns } from './lights.js';
import { registerGunnerSpawns } from './monsters/gunner.js';
import { registerMonsterSpawns } from './monsters/soldier.js';
import { registerMonsterStubs } from './monsters/stubs.js';
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
    throw new Error(`Unexpected token in entity lump: ${current}`);
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
      throw new Error('Expected { at start of entity definition');
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

  const context: SpawnContext = {
    keyValues: dictionary,
    entities: options.entities,
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

export function registerDefaultSpawns(game: any, registry: SpawnRegistry): void {
  registry.register('worldspawn', (entity) => {
    entity.movetype = MoveType.Push;
    entity.solid = Solid.Bsp;
    entity.modelindex = entity.modelindex || 1;
  });

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
  registerItemSpawns(game, registry);
  registerFuncSpawns(registry);
  registerPathSpawns(registry);
  registerLightSpawns(registry);
  registerMonsterSpawns(registry);
  registerGunnerSpawns(registry);
}

export function createDefaultSpawnRegistry(game: any): SpawnRegistry {
  const registry = new SpawnRegistry();
  registerDefaultSpawns(game, registry);
  return registry;
}
