export {
  Entity,
  type DieCallback,
  type EntityFieldDescriptor,
  type EntityFieldType,
  type PainCallback,
  type ThinkCallback,
  type TouchCallback,
  type UseCallback,
  MoveType,
  Solid,
  ServerFlags,
  DeadFlag,
  ENTITY_FIELD_METADATA,
} from './entity.js';
export { EntitySystem } from './system.js';
export {
  applyEntityKeyValues,
  createDefaultSpawnRegistry,
  parseEntityLump,
  registerDefaultSpawns,
  spawnEntitiesFromText,
  spawnEntityFromDictionary,
  SpawnRegistry,
  type ParsedEntity,
  type SpawnOptions,
  type SpawnContext,
  type SpawnFunction,
} from './spawn.js';
export { isZeroVector, setMovedir } from './utils.js';
