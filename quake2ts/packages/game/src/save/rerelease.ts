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
