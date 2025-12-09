import type { GameStateSnapshot } from './index.js';
import type { EntitySystemSnapshot, SerializedEntityState } from './entities/system.js';
import type { EntityState } from '@quake2ts/shared';

export const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function hashBytes(hash: number, bytes: ArrayLike<number>): number {
  let h = hash >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i]! & 0xff;
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

export function hashNumber(hash: number, value: number): number {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, true);
  const bytes = new Uint8Array(buffer);
  return hashBytes(hash, bytes);
}

export function hashString(hash: number, value: string): number {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return hashBytes(hash, bytes);
}

function hashEntityState(hash: number, entity: EntityState): number {
    hash = hashNumber(hash, entity.number);
    hash = hashNumber(hash, entity.modelIndex ?? 0);
    hash = hashNumber(hash, entity.frame ?? 0);
    hash = hashNumber(hash, entity.skinNum ?? 0);
    hash = hashNumber(hash, entity.effects ?? 0);
    hash = hashNumber(hash, entity.renderfx ?? 0);
    hash = hashNumber(hash, entity.solid ?? 0);
    hash = hashNumber(hash, entity.sound ?? 0);

    hash = hashNumber(hash, entity.origin.x);
    hash = hashNumber(hash, entity.origin.y);
    hash = hashNumber(hash, entity.origin.z);

    hash = hashNumber(hash, entity.angles.x);
    hash = hashNumber(hash, entity.angles.y);
    hash = hashNumber(hash, entity.angles.z);

    return hash;
}

export function hashGameState(state: GameStateSnapshot): number {
  let hash = FNV_OFFSET_BASIS;

  hash = hashNumber(hash, state.gravity.x);
  hash = hashNumber(hash, state.gravity.y);
  hash = hashNumber(hash, state.gravity.z);

  hash = hashNumber(hash, state.origin.x);
  hash = hashNumber(hash, state.origin.y);
  hash = hashNumber(hash, state.origin.z);

  hash = hashNumber(hash, state.velocity.x);
  hash = hashNumber(hash, state.velocity.y);
  hash = hashNumber(hash, state.velocity.z);

  // Safely handle potential undefined values in state.level
  hash = hashNumber(hash, state.level.frameNumber ?? 0);
  hash = hashNumber(hash, state.level.timeSeconds ?? 0);
  hash = hashNumber(hash, state.level.previousTimeSeconds ?? 0);
  hash = hashNumber(hash, state.level.deltaSeconds ?? 0);

  hash = hashNumber(hash, state.entities.activeCount);
  hash = hashString(hash, state.entities.worldClassname);

  // Include packetEntities in hash
  if (state.packetEntities) {
      // Sort to ensure stable hash
      const sorted = [...state.packetEntities].sort((a, b) => a.number - b.number);
      for (const ent of sorted) {
          hash = hashEntityState(hash, ent);
      }
  }

  return hash >>> 0;
}

function hashEntityValue(hash: number, value: any): number {
  if (value === null || value === undefined) {
    return hashNumber(hash, 0);
  }
  if (typeof value === 'number') {
    return hashNumber(hash, value);
  }
  if (typeof value === 'string') {
    return hashString(hash, value);
  }
  if (typeof value === 'boolean') {
    return hashNumber(hash, value ? 1 : 0);
  }
  if (Array.isArray(value)) {
    // Vec3 or similar array
    for (const v of value) {
        if (typeof v === 'number') {
            hash = hashNumber(hash, v);
        }
    }
    return hash;
  }
  if (typeof value === 'object') {
    // Inventory or other object
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      hash = hashString(hash, key);
      hash = hashEntityValue(hash, value[key]);
    }
    return hash;
  }
  return hash;
}

function hashSerializedEntity(hash: number, entity: SerializedEntityState): number {
    hash = hashNumber(hash, entity.index);
    const keys = Object.keys(entity.fields).sort();
    for (const key of keys) {
        hash = hashString(hash, key);
        hash = hashEntityValue(hash, (entity.fields as any)[key]);
    }
    return hash;
}

export function hashEntitySystem(snapshot: EntitySystemSnapshot): number {
    let hash = FNV_OFFSET_BASIS;
    hash = hashNumber(hash, snapshot.timeSeconds);

    // Snapshot entity list might be just the active ones, or include nulls.
    // EntitySystemSnapshot in system.ts returns SerializedEntityState[].

    // Hash entities, assuming they are in stable order (index order)
    // If not, we might need to sort them by index first
    const sortedEntities = [...snapshot.entities].sort((a, b) => a.index - b.index);

    for (const entity of sortedEntities) {
        hash = hashSerializedEntity(hash, entity);
    }

    return hash >>> 0;
}

// Support hashing the EntitySystem instance directly for convenience in tests
// by extracting the snapshot first.
// This is a bit of a hack to support the test code without changing it,
// checking if the argument is an EntitySystem class instance instead of a snapshot.
import { EntitySystem } from './entities/system.js';
export function hashEntitySystemInstance(system: EntitySystem): number {
   return hashEntitySystem(system.createSnapshot());
}
