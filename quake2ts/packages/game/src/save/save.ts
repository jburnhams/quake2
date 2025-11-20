import type { CvarRegistry } from '@quake2ts/engine';
import { CvarFlags, RandomGenerator, type RandomGeneratorState } from '@quake2ts/shared';
import type { RandomGenerator as RandomGeneratorType } from '@quake2ts/shared';
import type {
  CallbackRegistry,
  EntitySystem,
  EntitySystemSnapshot,
  SerializedEntityState,
} from '../entities/index.js';
import {
  type PlayerInventory,
  type SerializedPlayerInventory,
  deserializePlayerInventory,
  serializePlayerInventory,
} from '../inventory/index.js';
import type { LevelClock, LevelFrameState } from '../level.js';

export const SAVE_FORMAT_VERSION = 2;

export interface CvarSaveEntry {
  readonly name: string;
  readonly value: string;
  readonly flags: CvarFlags;
}

export interface GameSaveFile {
  readonly version: number;
  readonly timestamp: number;
  readonly map: string;
  readonly difficulty: number;
  readonly playtimeSeconds: number;
  readonly gameState: Record<string, unknown>;
  readonly level: LevelFrameState;
  readonly rng: RandomGeneratorState;
  readonly entities: EntitySystemSnapshot;
  readonly cvars: readonly CvarSaveEntry[];
  readonly configstrings: readonly string[];
  readonly player?: SerializedPlayerInventory;
}

export interface SaveCreationOptions {
  readonly map: string;
  readonly difficulty: number;
  readonly playtimeSeconds: number;
  readonly levelState: LevelFrameState;
  readonly entitySystem: EntitySystem;
  readonly rngState: RandomGeneratorState;
  readonly configstrings?: readonly string[];
  readonly cvars?: CvarRegistry;
  readonly gameState?: Record<string, unknown>;
  readonly timestamp?: number;
  readonly player?: PlayerInventory;
}

export interface SaveApplyTargets {
  readonly levelClock: LevelClock;
  readonly entitySystem: EntitySystem;
  readonly rng: RandomGeneratorType;
  readonly cvars?: CvarRegistry;
  readonly player?: PlayerInventory;
  readonly callbackRegistry?: CallbackRegistry;
}

export interface ParseSaveOptions {
  readonly allowNewerVersion?: boolean;
}

const MIN_SUPPORTED_VERSION = 1;

function ensureObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function ensureNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function ensureNumberOrDefault(value: unknown, label: string, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  return ensureNumber(value, label);
}

function ensureString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function ensureNumberArray(value: unknown, label: string): readonly number[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  for (const element of value) {
    ensureNumber(element, `${label} element`);
  }
  return value;
}

function parseLevelState(raw: unknown): LevelFrameState {
  if (raw === undefined) {
    return { frameNumber: 0, timeSeconds: 0, previousTimeSeconds: 0, deltaSeconds: 0 };
  }

  const level = ensureObject(raw, 'level');
  return {
    frameNumber: ensureNumberOrDefault(level.frameNumber, 'level.frameNumber', 0),
    timeSeconds: ensureNumberOrDefault(level.timeSeconds, 'level.timeSeconds', 0),
    previousTimeSeconds: ensureNumberOrDefault(level.previousTimeSeconds, 'level.previousTimeSeconds', 0),
    deltaSeconds: ensureNumberOrDefault(level.deltaSeconds, 'level.deltaSeconds', 0),
  };
}

function parseRngState(raw: unknown): RandomGeneratorState {
  if (raw === undefined) {
    return new RandomGenerator().getState();
  }

  const rng = ensureObject(raw, 'rng');
  const mt = ensureObject(rng.mt, 'rng.mt');
  const state = ensureNumberArray(mt.state, 'rng.mt.state');
  return {
    mt: {
      index: ensureNumber(mt.index, 'rng.mt.index'),
      state,
    },
  };
}

function parseThinkEntries(raw: unknown): EntitySystemSnapshot['thinks'] {
  if (raw === undefined) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new Error('thinks must be an array');
  }

  return raw.map((entry, idx) => {
    const think = ensureObject(entry, `thinks[${idx}]`);
    return {
      time: ensureNumber(think.time, `thinks[${idx}].time`),
      entityIndex: ensureNumber(think.entityIndex, `thinks[${idx}].entityIndex`),
    };
  });
}

function parseEntityFields(raw: unknown): SerializedEntityState['fields'] {
  if (raw === undefined) {
    return {};
  }

  const fields = ensureObject(raw, 'entity.fields');
  const parsed: SerializedEntityState['fields'] = {};
  for (const [name, value] of Object.entries(fields)) {
    if (value === null) {
      parsed[name as keyof SerializedEntityState['fields']] = null;
      continue;
    }

    switch (typeof value) {
      case 'number':
      case 'string':
      case 'boolean':
        parsed[name as keyof SerializedEntityState['fields']] = value;
        break;
      default: {
        if (!Array.isArray(value)) {
          const object = ensureObject(value, name);
          const inventory: Record<string, number> = {};
          for (const [entryName, entryValue] of Object.entries(object)) {
            inventory[entryName] = ensureNumber(entryValue, `${name}.${entryName}`);
          }
          parsed[name as keyof SerializedEntityState['fields']] = inventory;
          break;
        }
        if (Array.isArray(value) && value.length === 3) {
          const [x, y, z] = value;
          parsed[name as keyof SerializedEntityState['fields']] = [
            ensureNumber(x, `${name}[0]`),
            ensureNumber(y, `${name}[1]`),
            ensureNumber(z, `${name}[2]`),
          ];
          break;
        }
        throw new Error(`Unsupported entity field value for ${name}`);
      }
    }
  }
  return parsed;
}

function parseEntities(raw: unknown): SerializedEntityState[] {
  if (!Array.isArray(raw)) {
    throw new Error('entities must be an array');
  }

  return raw.map((entry, idx) => {
    const entity = ensureObject(entry, `entities[${idx}]`);
    return {
      index: ensureNumber(entity.index, `entities[${idx}].index`),
      fields: parseEntityFields(entity.fields),
    };
  });
}

function parsePool(raw: unknown): EntitySystemSnapshot['pool'] {
  const pool = ensureObject(raw, 'pool');
  return {
    capacity: ensureNumber(pool.capacity, 'pool.capacity'),
    activeOrder: ensureNumberArray(pool.activeOrder, 'pool.activeOrder'),
    freeList: ensureNumberArray(pool.freeList, 'pool.freeList'),
    pendingFree: ensureNumberArray(pool.pendingFree, 'pool.pendingFree'),
  };
}

function parseEntitySnapshot(raw: unknown): EntitySystemSnapshot {
  const snapshot = ensureObject(raw, 'entities');
  return {
    timeSeconds: ensureNumber(snapshot.timeSeconds, 'entities.timeSeconds'),
    pool: parsePool(snapshot.pool),
    entities: parseEntities(snapshot.entities),
    thinks: parseThinkEntries(snapshot.thinks),
  };
}

function parseCvars(raw: unknown): CvarSaveEntry[] {
  if (raw === undefined) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new Error('cvars must be an array');
  }

  return raw.map((entry, idx) => {
    const cvar = ensureObject(entry, `cvars[${idx}]`);
    return {
      name: ensureString(cvar.name, `cvars[${idx}].name`),
      value: ensureString(cvar.value, `cvars[${idx}].value`),
      flags: ensureNumber(cvar.flags, `cvars[${idx}].flags`) as CvarFlags,
    };
  });
}

function parseConfigstrings(raw: unknown): string[] {
  if (raw === undefined) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new Error('configstrings must be an array');
  }

  return raw.map((value, idx) => ensureString(value, `configstrings[${idx}]`));
}

function parseGameState(raw: unknown): Record<string, unknown> {
  if (raw === undefined) {
    return {};
  }

  return ensureObject(raw, 'gameState');
}

function serializeCvars(registry: CvarRegistry | undefined): CvarSaveEntry[] {
  if (!registry) {
    return [];
  }

  return registry
    .list()
    .filter((cvar) => (cvar.flags & CvarFlags.Archive) !== 0)
    .map((cvar) => ({ name: cvar.name, value: cvar.string, flags: cvar.flags }));
}

function applyCvars(entries: readonly CvarSaveEntry[], registry: CvarRegistry | undefined): void {
  if (!registry) {
    return;
  }

  for (const entry of entries) {
    const existing = registry.get(entry.name);
    if (existing) {
      existing.set(entry.value);
    } else {
      registry.register({ name: entry.name, defaultValue: entry.value, flags: entry.flags });
    }
  }
}

function cloneRngState(state: RandomGeneratorState): RandomGeneratorState {
  return {
    mt: {
      index: state.mt.index,
      state: [...state.mt.state],
    },
  };
}

export function createSaveFile(options: SaveCreationOptions): GameSaveFile {
  const {
    map,
    difficulty,
    playtimeSeconds,
    levelState,
    entitySystem,
    rngState,
    configstrings = [],
    cvars,
    gameState = {},
    timestamp = Date.now(),
    player,
  } = options;

  return {
    version: SAVE_FORMAT_VERSION,
    timestamp,
    map,
    difficulty,
    playtimeSeconds,
    gameState: { ...gameState },
    level: { ...levelState },
    rng: cloneRngState(rngState),
    entities: entitySystem.createSnapshot(),
    cvars: serializeCvars(cvars),
    configstrings: [...configstrings],
    player: player ? serializePlayerInventory(player) : undefined,
  };
}

export function parseSaveFile(serialized: unknown, options: ParseSaveOptions = {}): GameSaveFile {
  const { allowNewerVersion = true } = options;
  const raw = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
  const save = ensureObject(raw, 'save');

  const versionValue = save.version ?? SAVE_FORMAT_VERSION;
  const version = ensureNumber(versionValue, 'version');
  if (version < MIN_SUPPORTED_VERSION) {
    throw new Error(`Unsupported save version ${version}`);
  }
  if (version > SAVE_FORMAT_VERSION && !allowNewerVersion) {
    throw new Error(`Save version ${version} is newer than supported ${SAVE_FORMAT_VERSION}`);
  }

  return {
    version,
    timestamp: ensureNumber(save.timestamp, 'timestamp'),
    map: ensureString(save.map, 'map'),
    difficulty: ensureNumber(save.difficulty, 'difficulty'),
    playtimeSeconds: ensureNumber(save.playtimeSeconds, 'playtimeSeconds'),
    gameState: parseGameState(save.gameState),
    level: parseLevelState(save.level),
    rng: parseRngState(save.rng),
    entities: parseEntitySnapshot(save.entities),
    cvars: parseCvars(save.cvars),
    configstrings: parseConfigstrings(save.configstrings),
    player: save.player ? (save.player as SerializedPlayerInventory) : undefined,
  };
}

export function applySaveFile(save: GameSaveFile, targets: SaveApplyTargets): void {
  targets.levelClock.restore(save.level);
  targets.entitySystem.restore(save.entities, targets.callbackRegistry);
  targets.rng.setState(save.rng);
  applyCvars(save.cvars, targets.cvars);

  if (save.player && targets.player) {
    const deserialized = deserializePlayerInventory(save.player);
    Object.assign(targets.player, deserialized);
  }
}
