import type { Vec3 } from '@quake2ts/shared';
import { ENTITY_FIELD_METADATA, Entity, type EntityFieldDescriptor, Solid } from './entity.js';
import { EntityPool, type EntityPoolSnapshot } from './pool.js';
import { ThinkScheduler, type ThinkScheduleEntry } from './thinkScheduler.js';

interface Bounds {
  min: Vec3;
  max: Vec3;
}

function computeBounds(entity: Entity): Bounds {
  return {
    min: {
      x: entity.origin.x + entity.mins.x,
      y: entity.origin.y + entity.mins.y,
      z: entity.origin.z + entity.mins.z,
    },
    max: {
      x: entity.origin.x + entity.maxs.x,
      y: entity.origin.y + entity.maxs.y,
      z: entity.origin.z + entity.maxs.z,
    },
  };
}

function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(
    a.min.x > b.max.x ||
    a.max.x < b.min.x ||
    a.min.y > b.max.y ||
    a.max.y < b.min.y ||
    a.min.z > b.max.z ||
    a.max.z < b.min.z
  );
}

type SerializableVec3 = readonly [number, number, number];

type SerializableEntityFieldValue = number | string | boolean | null | SerializableVec3;

type SerializableFieldName = Exclude<
  (typeof ENTITY_FIELD_METADATA)[number]['name'],
  'think' | 'touch' | 'use' | 'pain' | 'die' | 'index'
>;
type SerializableFieldDescriptor = EntityFieldDescriptor<SerializableFieldName>;

const SERIALIZABLE_FIELDS = ENTITY_FIELD_METADATA.filter(
  (field) => field.save,
) as SerializableFieldDescriptor[];
const DESCRIPTORS = new Map(SERIALIZABLE_FIELDS.map((descriptor) => [descriptor.name, descriptor]));

export interface SerializedEntityState {
  readonly index: number;
  readonly fields: Partial<Record<SerializableFieldName, SerializableEntityFieldValue>>;
}

export interface EntitySystemSnapshot {
  readonly timeSeconds: number;
  readonly pool: EntityPoolSnapshot;
  readonly entities: SerializedEntityState[];
  readonly thinks: ThinkScheduleEntry[];
}


function serializeVec3(vec: Vec3): SerializableVec3 {
  return [vec.x, vec.y, vec.z];
}

function deserializeVec3(value: SerializableEntityFieldValue): Vec3 {
  const vec = value as SerializableVec3;
  if (!Array.isArray(vec) || vec.length !== 3) {
    throw new Error('Invalid vec3 serialization');
  }
  const [x, y, z] = vec;
  return { x, y, z };
}

function assignField(
  entity: Entity,
  name: SerializableFieldName,
  value: Entity[SerializableFieldName],
): void {
  (entity as Record<SerializableFieldName, Entity[SerializableFieldName]>)[name] = value;
}

export class EntitySystem {
  private readonly pool: EntityPool;
  private readonly thinkScheduler: ThinkScheduler;
  private readonly targetNameIndex = new Map<string, Set<Entity>>();
  private currentTimeSeconds = 0;

  constructor(maxEntities?: number) {
    this.pool = new EntityPool(maxEntities);
    this.thinkScheduler = new ThinkScheduler();
  }

  get world(): Entity {
    return this.pool.world;
  }

  get activeCount(): number {
    return this.pool.activeCount;
  }

  get timeSeconds(): number {
    return this.currentTimeSeconds;
  }

  forEachEntity(callback: (entity: Entity) => void): void {
    for (const entity of this.pool) {
      callback(entity);
    }
  }

  spawn(): Entity {
    return this.pool.spawn();
  }

  free(entity: Entity): void {
    this.unregisterTarget(entity);
    this.thinkScheduler.cancel(entity);
    this.pool.deferFree(entity);
  }

  freeImmediate(entity: Entity): void {
    this.unregisterTarget(entity);
    this.thinkScheduler.cancel(entity);
    this.pool.freeImmediate(entity);
  }

  scheduleThink(entity: Entity, nextThinkSeconds: number): void {
    this.thinkScheduler.schedule(entity, nextThinkSeconds);
  }

  beginFrame(timeSeconds: number): void {
    this.currentTimeSeconds = timeSeconds;
  }

  finalizeSpawn(entity: Entity): void {
    if (!entity.inUse || entity.freePending) {
      return;
    }
    this.registerTarget(entity);
  }

  findByClassname(classname: string): Entity[] {
    const matches: Entity[] = [];
    for (const entity of this.pool) {
      if (entity.classname === classname && entity.inUse && !entity.freePending) {
        matches.push(entity);
      }
    }
    return matches;
  }

  findByTargetName(targetname: string): Entity[] {
    const matches = this.targetNameIndex.get(targetname);
    if (!matches) {
      return [];
    }
    return Array.from(matches).filter((entity) => entity.inUse && !entity.freePending);
  }

  useTargets(entity: Entity, activator: Entity | null = null): void {
    if (entity.delay > 0) {
      const delayed = this.spawn();
      delayed.classname = 'DelayedUse';
      delayed.target = entity.target;
      delayed.killtarget = entity.killtarget;
      delayed.message = entity.message;
      delayed.think = (self) => {
        this.useTargetsImmediate(self, activator ?? entity);
        this.free(self);
      };
      this.scheduleThink(delayed, this.currentTimeSeconds + entity.delay);
      return;
    }

    this.useTargetsImmediate(entity, activator ?? entity);
  }

  runFrame(): void {
    this.thinkScheduler.runDueThinks(this.currentTimeSeconds);
    this.runTouches();
    this.pool.flushFreeList();
  }

  createSnapshot(): EntitySystemSnapshot {
    const entities: SerializedEntityState[] = [];
    for (const entity of this.pool) {
      const fields: Partial<Record<SerializableFieldName, SerializableEntityFieldValue>> = {};
      for (const descriptor of SERIALIZABLE_FIELDS) {
        const value = entity[descriptor.name];
        switch (descriptor.type) {
          case 'vec3':
            fields[descriptor.name] = serializeVec3(value as Vec3);
            break;
          case 'entity':
            fields[descriptor.name] = (value as Entity | null)?.index ?? null;
            break;
          default:
            fields[descriptor.name] = (value as SerializableEntityFieldValue) ?? null;
            break;
        }
      }
      entities.push({
        index: entity.index,
        fields,
      });
    }

    return {
      timeSeconds: this.currentTimeSeconds,
      pool: this.pool.createSnapshot(),
      entities,
      thinks: this.thinkScheduler.snapshot(),
    };
  }

  restore(snapshot: EntitySystemSnapshot): void {
    this.currentTimeSeconds = snapshot.timeSeconds;
    this.pool.restore(snapshot.pool);

    const indexToEntity = new Map<number, Entity>();
    for (const entity of this.pool) {
      indexToEntity.set(entity.index, entity);
    }

    const pendingEntityRefs: Array<{ entity: Entity; name: SerializableFieldName; targetIndex: number | null }>
      = [];

    for (const serialized of snapshot.entities) {
      const entity = indexToEntity.get(serialized.index);
      if (!entity) {
        continue;
      }

      for (const [name, value] of Object.entries(serialized.fields) as [
        SerializableFieldName,
        SerializableEntityFieldValue,
      ][]) {
        const descriptor = DESCRIPTORS.get(name);
        if (!descriptor || value === undefined) {
          continue;
        }

        switch (descriptor.type) {
          case 'vec3':
            assignField(entity, name, deserializeVec3(value) as Entity[typeof name]);
            break;
          case 'entity':
            pendingEntityRefs.push({
              entity,
              name: descriptor.name,
              targetIndex: value as number | null,
            });
            break;
          case 'boolean':
            assignField(entity, name, Boolean(value) as Entity[typeof name]);
            break;
          default:
            assignField(entity, name, value as Entity[typeof name]);
            break;
        }
      }
    }

    for (const ref of pendingEntityRefs) {
      const target = ref.targetIndex === null ? null : indexToEntity.get(ref.targetIndex) ?? null;
      assignField(ref.entity, ref.name, target as Entity[SerializableFieldName]);
    }

    this.thinkScheduler.restore(snapshot.thinks, (index) => indexToEntity.get(index));
  }

  private runTouches(): void {
    const world = this.pool.world;
    const activeEntities: Entity[] = [];
    for (const entity of this.pool) {
      if (entity === world) {
        continue;
      }
      if (!entity.inUse || entity.freePending || entity.solid === Solid.Not) {
        continue;
      }
      activeEntities.push(entity);
    }

    for (let i = 0; i < activeEntities.length; i += 1) {
      const first = activeEntities[i];
      let firstBounds: Bounds | null = null;
      for (let j = i + 1; j < activeEntities.length; j += 1) {
        const second = activeEntities[j];
        if (!first.touch && !second.touch) {
          continue;
        }
        if (!firstBounds) {
          firstBounds = computeBounds(first);
        }
        const secondBounds = computeBounds(second);
        if (!boundsIntersect(firstBounds, secondBounds)) {
          continue;
        }
        if (first.touch) {
          first.touch(first, second);
        }
        if (second.touch) {
          second.touch(second, first);
        }
      }
    }
  }

  private registerTarget(entity: Entity): void {
    if (!entity.targetname) {
      return;
    }
    let bucket = this.targetNameIndex.get(entity.targetname);
    if (!bucket) {
      bucket = new Set<Entity>();
      this.targetNameIndex.set(entity.targetname, bucket);
    }
    bucket.add(entity);
  }

  private unregisterTarget(entity: Entity): void {
    if (!entity.targetname) {
      return;
    }
    const bucket = this.targetNameIndex.get(entity.targetname);
    if (!bucket) {
      return;
    }
    bucket.delete(entity);
    if (bucket.size === 0) {
      this.targetNameIndex.delete(entity.targetname);
    }
  }

  private useTargetsImmediate(entity: Entity, activator: Entity | null): void {
    if (entity.target) {
      for (const target of this.findByTargetName(entity.target)) {
        if (target === entity) {
          continue;
        }
        target.use?.(target, entity, activator);
      }
    }

    if (entity.killtarget) {
      for (const victim of this.findByTargetName(entity.killtarget)) {
        if (victim === entity) {
          continue;
        }
        this.free(victim);
      }
    }
  }
}
