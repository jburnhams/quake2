import { SAVE_FORMAT_VERSION, type GameSaveFile } from './save.js';
import type { RandomGeneratorState } from '@quake2ts/shared';
import { RandomGenerator } from '@quake2ts/shared';
import { ENTITY_FIELD_METADATA } from '../entities/entity.js';
import type { EntitySystemSnapshot, SerializedEntityState, SerializedTargetAwareness } from '../entities/system.js';
import type { LevelFrameState } from '../level.js';

export type JsonObject = Record<string, unknown>;

export interface RereleaseGameSave {
  readonly saveVersion: number;
  readonly game: JsonObject & { readonly maxclients?: number };
  readonly clients: readonly JsonObject[];
}

export interface RereleaseLevelSave {
  readonly saveVersion: number;
  readonly level: JsonObject;
  readonly entities: ReadonlyMap<number, JsonObject>;
}

export type RereleaseSave = RereleaseGameSave | RereleaseLevelSave;

export interface RereleaseSaveSummary {
  readonly version: number;
  readonly kind: 'game' | 'level';
  readonly maxClients?: number;
  readonly clientCount?: number;
  readonly entityCount?: number;
  readonly highestEntityIndex?: number;
}

export interface RereleaseLevelSaveJson {
  readonly save_version: number;
  readonly level: JsonObject;
  readonly entities: Record<string, JsonObject>;
}

export interface RereleaseGameSaveJson {
  readonly save_version: number;
  readonly game: JsonObject;
  readonly clients: readonly JsonObject[];
}

export type RereleaseSaveJson = RereleaseLevelSaveJson | RereleaseGameSaveJson;

function ensureObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function ensureNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function ensureArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function parseEntityMap(raw: JsonObject): ReadonlyMap<number, JsonObject> {
  const map = new Map<number, JsonObject>();
  for (const [rawIndex, value] of Object.entries(raw)) {
    const index = Number(rawIndex);
    if (!Number.isInteger(index)) {
      throw new Error(`entities[${rawIndex}] must use an integer key`);
    }
    map.set(index, ensureObject(value, `entities[${rawIndex}]`));
  }
  return map;
}

export function parseRereleaseSave(raw: unknown): RereleaseSave {
  const root = ensureObject(raw, 'rerelease save');
  const saveVersion = ensureNumber(root.save_version, 'save_version');
  const hasGame = 'game' in root;
  const hasLevel = 'level' in root;

  if (hasGame === hasLevel) {
    throw new Error('save must contain either game or level data');
  }

  if (hasGame) {
    const game = ensureObject((root as Record<string, unknown>).game, 'game');
    const clients = ensureArray((root as Record<string, unknown>).clients, 'clients').map((entry, idx) =>
      ensureObject(entry, `clients[${idx}]`),
    );
    const maxclients = game.maxclients !== undefined ? ensureNumber(game.maxclients, 'game.maxclients') : clients.length;
    if (clients.length !== maxclients) {
      throw new Error(`clients length ${clients.length} does not match game.maxclients ${maxclients}`);
    }
    return { saveVersion, game, clients };
  }

  const level = ensureObject((root as Record<string, unknown>).level, 'level');
  const entitiesRoot = ensureObject((root as Record<string, unknown>).entities, 'entities');
  const entities = parseEntityMap(entitiesRoot);
  return { saveVersion, level, entities };
}

export function summarizeRereleaseSave(raw: unknown): RereleaseSaveSummary {
  const parsed = parseRereleaseSave(raw);
  if ('game' in parsed) {
    const maxClients = parsed.game.maxclients ?? parsed.clients.length;
    return {
      version: parsed.saveVersion,
      kind: 'game',
      maxClients,
      clientCount: parsed.clients.length,
    };
  }

  let highestEntityIndex = -1;
  for (const index of parsed.entities.keys()) {
    if (index > highestEntityIndex) {
      highestEntityIndex = index;
    }
  }

  return {
    version: parsed.saveVersion,
    kind: 'level',
    entityCount: parsed.entities.size,
    highestEntityIndex: highestEntityIndex >= 0 ? highestEntityIndex : undefined,
  };
}

const SERIALIZABLE_FIELD_NAMES = new Set<keyof SerializedEntityState['fields']>(
  ENTITY_FIELD_METADATA.filter((field) => field.save).map((field) => field.name as keyof SerializedEntityState['fields']),
);

function toVec3(value: unknown, label: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`${label} must be a vec3 array`);
  }
  const [x, y, z] = value;
  return [ensureNumber(x, `${label}[0]`), ensureNumber(y, `${label}[1]`), ensureNumber(z, `${label}[2]`)];
}

function normalizeEntityFields(raw: JsonObject, label: string): SerializedEntityState['fields'] {
  const fields: SerializedEntityState['fields'] = {};
  for (const [rawName, value] of Object.entries(raw)) {
    const name = rawName as keyof SerializedEntityState['fields'];
    if (!SERIALIZABLE_FIELD_NAMES.has(name)) {
      continue;
    }

    if (value === null) {
      fields[name as keyof SerializedEntityState['fields']] = null;
      continue;
    }

    if (Array.isArray(value)) {
      fields[name as keyof SerializedEntityState['fields']] = toVec3(value, `${label}.${name}`);
      continue;
    }

    switch (typeof value) {
      case 'number':
      case 'string':
      case 'boolean':
        fields[name as keyof SerializedEntityState['fields']] = value;
        break;
      default:
        if (name === 'inventory' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const inventory: Record<string, number> = {};
          const obj = value as Record<string, unknown>;
          for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'number') {
              inventory[k] = v;
            }
          }
          fields[name] = inventory;
          break;
        }
        throw new Error(`Unsupported field type for ${label}.${name}`);
    }
  }
  return fields;
}

function buildEntitySnapshot(
  entities: ReadonlyMap<number, JsonObject>,
  levelTimeSeconds: number,
  capacityHint?: number,
): EntitySystemSnapshot {
  let highestIndex = 0;
  const active = new Set<number>();
  const activeOrder: number[] = [];
  const serialized: SerializedEntityState[] = [];

  for (const [index, entry] of entities.entries()) {
    if (index > highestIndex) {
      highestIndex = index;
    }

    const inUse = (entry.inuse as boolean | undefined) !== false;
    if (!inUse) {
      continue;
    }

    if (!active.has(index)) {
      activeOrder.push(index);
    }
    active.add(index);
    serialized.push({ index, fields: normalizeEntityFields(entry, `entities[${index}]`) });
  }

  if (!active.has(0)) {
    active.add(0);
    activeOrder.unshift(0);
    serialized.unshift({ index: 0, fields: { classname: 'worldspawn' } });
  }

  const capacity = Math.max(capacityHint ?? 0, highestIndex + 1, Math.max(...active) + 1);
  const freeList: number[] = [];
  for (let i = 0; i < capacity; i += 1) {
    if (!active.has(i)) {
      freeList.push(i);
    }
  }

  const dummyAwareness: SerializedTargetAwareness = {
    frameNumber: 0,
    sightEntityIndex: null,
    sightEntityFrame: 0,
    soundEntityIndex: null,
    soundEntityFrame: 0,
    sound2EntityIndex: null,
    sound2EntityFrame: 0,
    sightClientIndex: null,
  };

  return {
    timeSeconds: levelTimeSeconds,
    pool: { capacity, activeOrder, freeList, pendingFree: [] },
    entities: serialized,
    thinks: [],
    awareness: dummyAwareness,
    crossLevelFlags: 0,
    crossUnitFlags: 0,
  };
}

function buildLevelState(level: JsonObject): LevelFrameState {
  const timeSeconds = typeof level.time === 'number' ? level.time : 0;
  const frameNumber = typeof level.framenum === 'number' ? level.framenum : 0;
  const deltaSeconds = typeof level.frametime === 'number' ? level.frametime : 0;
  const previousTimeSeconds = timeSeconds - deltaSeconds;
  return { frameNumber, timeSeconds, previousTimeSeconds, deltaSeconds };
}

export interface RereleaseImportOptions {
  readonly timestamp?: number;
  readonly defaultDifficulty?: number;
  readonly defaultPlaytimeSeconds?: number;
  readonly rngState?: RandomGeneratorState;
  readonly configstrings?: readonly string[];
  readonly gameState?: Record<string, unknown>;
}

export function convertRereleaseLevelToGameSave(
  save: RereleaseLevelSave,
  options: RereleaseImportOptions = {},
): GameSaveFile {
  const { timestamp = Date.now(), defaultDifficulty = 1, defaultPlaytimeSeconds, rngState, configstrings = [] } = options;
  const levelName = (save.level.mapname as string | undefined) ?? 'unknown';
  const level = buildLevelState(save.level);
  const playtimeSeconds = defaultPlaytimeSeconds ?? level.timeSeconds;

  return {
    version: SAVE_FORMAT_VERSION,
    timestamp,
    map: levelName,
    difficulty: defaultDifficulty,
    playtimeSeconds,
    gameState: { ...(options.gameState ?? {}), rereleaseVersion: save.saveVersion },
    level,
    rng: rngState ? { mt: { index: rngState.mt.index, state: [...rngState.mt.state] } } : new RandomGenerator().getState(),
    entities: buildEntitySnapshot(save.entities, level.timeSeconds, (save.level.maxentities as number | undefined) ?? undefined),
    cvars: [],
    configstrings: [...configstrings],
  };
}

export function convertRereleaseSaveToGameSave(
  save: RereleaseSave,
  options: RereleaseImportOptions = {},
): GameSaveFile {
  if ('game' in save) {
    throw new Error('Game-wide rerelease saves are not currently supported for conversion');
  }
  return convertRereleaseLevelToGameSave(save, options);
}

export function convertGameSaveToRereleaseLevel(save: GameSaveFile): RereleaseLevelSave {
  const active = new Set(save.entities.pool.activeOrder);
  const entities = new Map<number, JsonObject>();
  for (const entity of save.entities.entities) {
    if (!active.has(entity.index)) {
      continue;
    }
    const fields: JsonObject = { inuse: true };
    for (const [name, value] of Object.entries(entity.fields)) {
      if (value === undefined) {
        continue;
      }
      fields[name] = value as unknown;
    }
    entities.set(entity.index, fields);
  }

  return {
    saveVersion: save.version,
    level: {
      mapname: save.map,
      time: save.level.timeSeconds,
      framenum: save.level.frameNumber,
      frametime: save.level.deltaSeconds,
    },
    entities,
  };
}

export function serializeRereleaseSave(save: RereleaseSave): RereleaseSaveJson {
  if ('game' in save) {
    return { save_version: save.saveVersion, game: save.game, clients: save.clients };
  }

  const entities: Record<string, JsonObject> = {};
  for (const [index, entity] of save.entities.entries()) {
    entities[index.toString(10)] = entity;
  }

  return { save_version: save.saveVersion, level: save.level, entities };
}
