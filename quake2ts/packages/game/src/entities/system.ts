import type { Vec3 } from '@quake2ts/shared';
import { createRandomGenerator, scaleVec3, RandomGenerator } from '@quake2ts/shared';
import { runGravity, runBouncing, runProjectileMovement, runPush, runStep } from '../physics/movement.js';
import { checkWater } from '../physics/fluid.js';
import { GameImports, GameEngine, TraceFunction, PointContentsFunction, MulticastType } from '../imports.js';
import {
  DeadFlag,
  ENTITY_FIELD_METADATA,
  Entity,
  MoveType,
  ServerFlags,
  type EntityFieldDescriptor,
  Solid,
} from './entity.js';
import { EntityPool, type EntityPoolSnapshot } from './pool.js';
import { ThinkScheduler, type ThinkScheduleEntry } from './thinkScheduler.js';
import { lengthVec3, subtractVec3, ServerCommand } from '@quake2ts/shared';
import type { AnyCallback, CallbackRegistry } from './callbacks.js';
import type { TargetAwarenessState } from '../ai/targeting.js';
import type { SpawnFunction, SpawnRegistry } from './spawn.js';
import { SpatialGrid } from './spatial.js';

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

type SerializableInventory = Record<string, number>;

type SerializableEntityFieldValue =
  | number
  | string
  | boolean
  | null
  | SerializableVec3
  | SerializableInventory;

type SerializableFieldName = (typeof ENTITY_FIELD_METADATA)[number]['name'];
type SerializableFieldDescriptor = EntityFieldDescriptor<SerializableFieldName>;

const SERIALIZABLE_FIELDS = ENTITY_FIELD_METADATA.filter(
  (field) => field.save || field.type === 'callback',
) as SerializableFieldDescriptor[];
const DESCRIPTORS = new Map(SERIALIZABLE_FIELDS.map((descriptor) => [descriptor.name, descriptor]));

export interface SerializedEntityState {
  readonly index: number;
  readonly fields: Partial<Record<SerializableFieldName, SerializableEntityFieldValue>>;
}

export interface SerializedTargetAwareness {
  readonly frameNumber: number;
  readonly sightEntityIndex: number | null;
  readonly sightEntityFrame: number;
  readonly soundEntityIndex: number | null;
  readonly soundEntityFrame: number;
  readonly sound2EntityIndex: number | null;
  readonly sound2EntityFrame: number;
  readonly sightClientIndex: number | null;
}

export interface EntitySystemSnapshot {
  readonly timeSeconds: number;
  readonly pool: EntityPoolSnapshot;
  readonly entities: SerializedEntityState[];
  readonly thinks: ThinkScheduleEntry[];
  readonly awareness: SerializedTargetAwareness;
  readonly crossLevelFlags: number;
  readonly crossUnitFlags: number;
  readonly level: LevelState;
}

export interface LevelState {
  next_auto_save: number;
  health_bar_entities: (Entity | null)[];
  intermission_angle: Vec3;
  intermission_origin: Vec3;
  helpmessage1: string;
  helpmessage2: string;
  help1changed: number;
  help2changed: number;
}


function serializeVec3(vec: Vec3 | undefined): SerializableVec3 {
  if (!vec) {
      return [0, 0, 0];
  }
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

function assignField(entity: Entity, name: SerializableFieldName, value: Entity[SerializableFieldName]): void {
  (entity as Record<SerializableFieldName, Entity[SerializableFieldName]>)[name] = value;
}

function serializeInventory(inventory: Record<string, number>): SerializableInventory {
  return { ...inventory };
}

function deserializeInventory(value: SerializableEntityFieldValue): Record<string, number> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid inventory serialization');
  }

  const parsed: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    parsed[key] = Number(entry);
  }
  return parsed;
}

export class EntitySystem {
  private readonly pool: EntityPool;
  private readonly thinkScheduler: ThinkScheduler;
  private readonly targetNameIndex = new Map<string, Set<Entity>>();
  private readonly random: RandomGenerator;
  private readonly callbackToName: Map<AnyCallback, string>;
  private spawnRegistry?: SpawnRegistry;
  private currentTimeSeconds = 0;
  private frameNumber = 0;
  private spawnCount = 0;

  private spatialGrid: SpatialGrid;

  readonly targetAwareness: TargetAwarenessState;

  // Persistent state for cross-level logic
  crossLevelFlags: number = 0;
  crossUnitFlags: number = 0;

  public level: LevelState;

  get rng() {
    return this.random;
  }

  setSpawnRegistry(registry: SpawnRegistry): void {
    this.spawnRegistry = registry;
  }

  getSpawnFunction(classname: string): SpawnFunction | undefined {
    return this.spawnRegistry?.get(classname);
  }

  readonly engine: GameEngine;
  readonly imports: GameImports;
  private readonly gravity: Vec3;
  readonly deathmatch: boolean;
  readonly skill: number;

  get trace(): TraceFunction {
    return this.imports.trace;
  }

  get pointcontents(): PointContentsFunction {
    return this.imports.pointcontents;
  }

  get game(): any {
      return (this as any)._game;
  }

  constructor(
    engine: GameEngine,
    imports?: Partial<GameImports>,
    gravity?: Vec3,
    maxEntities?: number,
    callbackRegistry?: CallbackRegistry,
    deathmatch?: boolean,
    skill?: number,
    random?: RandomGenerator
  ) {
    this.pool = new EntityPool(maxEntities);
    this.thinkScheduler = new ThinkScheduler();
    this.engine = engine;
    this.deathmatch = deathmatch ?? false;
    this.skill = skill ?? 1; // Default to medium
    this.random = random ?? createRandomGenerator();
    this.spatialGrid = new SpatialGrid();

    // Default imports
    const defaultImports: GameImports = {
      trace: () => ({
        allsolid: false,
        startsolid: false,
        fraction: 1,
        endpos: { x: 0, y: 0, z: 0 },
        plane: null,
        surfaceFlags: 0,
        contents: 0,
        ent: null,
      }),
      pointcontents: () => 0,
      linkentity: (ent) => {
        ent.absmin = {
          x: ent.origin.x + ent.mins.x,
          y: ent.origin.y + ent.mins.y,
          z: ent.origin.z + ent.mins.z,
        };
        ent.absmax = {
          x: ent.origin.x + ent.maxs.x,
          y: ent.origin.y + ent.maxs.y,
          z: ent.origin.z + ent.maxs.z,
        };
      },
      areaEdicts: () => null, // Default to null to signal fallback
      multicast: () => {},
      unicast: () => {},
      configstring: () => {},
      serverCommand: () => {},
    };

    // Merge defaults with provided imports
    this.imports = { ...defaultImports, ...imports };

    // Wrap linkentity to update spatial grid
    const originalLinkEntity = this.imports.linkentity;
    this.imports.linkentity = (ent: Entity) => {
        if (originalLinkEntity) {
             originalLinkEntity(ent);
        } else {
             // Fallback logic if original didn't exist (but defaultImports ensures it does)
             ent.absmin = {
                x: ent.origin.x + ent.mins.x,
                y: ent.origin.y + ent.mins.y,
                z: ent.origin.z + ent.mins.z,
              };
              ent.absmax = {
                x: ent.origin.x + ent.maxs.x,
                y: ent.origin.y + ent.maxs.y,
                z: ent.origin.z + ent.maxs.z,
              };
        }
        // Always update spatial grid
        this.spatialGrid.update(ent);
    };

    this.gravity = gravity || { x: 0, y: 0, z: 0 };
    this.callbackToName = new Map<AnyCallback, string>();
    if (callbackRegistry) {
      for (const [name, fn] of callbackRegistry.entries()) {
        this.callbackToName.set(fn, name);
      }
    }

    this.targetAwareness = {
      timeSeconds: 0,
      frameNumber: 0,
      sightEntity: null,
      sightEntityFrame: 0,
      soundEntity: null,
      soundEntityFrame: 0,
      sound2Entity: null,
      sound2EntityFrame: 0,
      sightClient: null,
    };

    this.level = {
      next_auto_save: 0,
      health_bar_entities: [null, null, null, null],
      intermission_angle: { x: 0, y: 0, z: 0 },
      intermission_origin: { x: 0, y: 0, z: 0 },
      helpmessage1: "",
      helpmessage2: "",
      help1changed: 0,
      help2changed: 0,
    };
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
      if (entity.inUse && !entity.freePending) {
        callback(entity);
      }
    }
  }

  find(predicate: (entity: Entity) => boolean): Entity | undefined {
    for (const entity of this.pool) {
      if (predicate(entity)) {
        return entity;
      }
    }
    return undefined;
  }

  getByIndex(index: number): Entity | undefined {
    return this.pool.getByIndex(index);
  }

  spawn(): Entity {
    const ent = this.pool.spawn();
    this.spawnCount++;
    ent.spawn_count = this.spawnCount;
    ent.timestamp = this.currentTimeSeconds;
    return ent;
  }

  free(entity: Entity): void {
    this.unregisterTarget(entity);
    this.thinkScheduler.cancel(entity);
    this.spatialGrid.remove(entity);
    this.pool.deferFree(entity);
  }

  freeImmediate(entity: Entity): void {
    this.unregisterTarget(entity);
    this.thinkScheduler.cancel(entity);
    this.spatialGrid.remove(entity);
    this.pool.freeImmediate(entity);
  }

  sound(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void {
    this.engine.sound?.(entity, channel, sound, volume, attenuation, timeofs);
  }

  soundIndex(sound: string): number {
    return this.engine.soundIndex?.(sound) || 0;
  }

  modelIndex(model: string): number {
    return this.engine.modelIndex?.(model) || 0;
  }

  linkentity(ent: Entity): void {
    this.imports.linkentity(ent);
  }

  multicast(origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]): void {
    this.imports.multicast(origin, type, event, ...args);
  }

  unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void {
    this.imports.unicast(ent, reliable, event, ...args);
  }

  scheduleThink(entity: Entity, nextThinkSeconds: number): void {
    this.thinkScheduler.schedule(entity, nextThinkSeconds);
  }

  beginFrame(timeSeconds: number): void {
    this.currentTimeSeconds = timeSeconds;
    this.frameNumber++;
    this.targetAwareness.timeSeconds = timeSeconds;
    this.targetAwareness.frameNumber = this.frameNumber;
  }

  finalizeSpawn(entity: Entity): void {
    if (!entity.inUse || entity.freePending) {
      return;
    }
    this.registerTarget(entity);
    this.linkentity(entity); // Ensure it's in the spatial grid
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

  findInBox(mins: Vec3, maxs: Vec3): Entity[] {
    const indices = this.imports.areaEdicts(mins, maxs);
    if (indices === null) {
      // Use our spatial grid optimization
      const candidates = this.spatialGrid.query(mins, maxs);
      const results: Entity[] = [];
      const bounds = { min: mins, max: maxs };

      for (const entity of candidates) {
         if (!entity.inUse || entity.freePending || entity.solid === Solid.Not) continue;
         if (boundsIntersect(bounds, computeBounds(entity))) {
            results.push(entity);
         }
      }
      return results;
    }

    const results: Entity[] = [];
    for (const index of indices) {
      const entity = this.pool.getByIndex(index);
      if (entity && entity.inUse && !entity.freePending) {
        results.push(entity);
      }
    }
    return results;
  }

  findByRadius(origin: Vec3, radius: number): Entity[] {
    const mins = { x: origin.x - radius, y: origin.y - radius, z: origin.z - radius };
    const maxs = { x: origin.x + radius, y: origin.y + radius, z: origin.z + radius };

    // Use findInBox (which handles fallback)
    const candidates = this.findInBox(mins, maxs);
    const matches: Entity[] = [];

    for (const entity of candidates) {
        const distance = lengthVec3(subtractVec3(origin, entity.origin));
        if (distance <= radius) {
          matches.push(entity);
        }
    }
    return matches;
  }

  pickTarget(targetname: string | undefined): Entity | null {
    if (!targetname) {
      return null;
    }
    const matches = this.findByTargetName(targetname);
    if (matches.length === 0) {
      return null;
    }
    const choice = this.random.randomIndex(matches);
    return matches[choice] ?? null;
  }

  killBox(entity: Entity): void {
    const targetBounds = computeBounds(entity);
    // killBox typically only cares about damageable entities inside the box
    // Using findInBox is much better than iterating all entities
    const potentialVictims = this.findInBox(targetBounds.min, targetBounds.max);

    for (const other of potentialVictims) {
      if (other === entity || other === this.pool.world) {
        continue;
      }
      if (!other.inUse || other.freePending || other.solid === Solid.Not) {
        continue;
      }
      if (other.svflags & ServerFlags.DeadMonster) {
        continue;
      }
      if (!boundsIntersect(targetBounds, computeBounds(other))) {
        continue;
      }
      other.health = 0;
      other.deadflag = DeadFlag.Dead;
      this.free(other);
    }
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
    this.thinkScheduler.runDueThinks(this.currentTimeSeconds, this);

    for (const ent of this.pool) {
      if (!ent.inUse || ent.freePending) {
        continue;
      }

      if (ent.movetype !== MoveType.None && ent.movetype !== MoveType.Push && ent.movetype !== MoveType.Stop && ent.movetype !== MoveType.Noclip) {
        checkWater(ent, this, this.imports);
      }

      const frametime = this.currentTimeSeconds - (ent.timestamp || 0);
      switch (ent.movetype) {
        case MoveType.Toss:
          runGravity(ent, this.gravity, frametime);
          runBouncing(ent, this, this.imports, frametime);
          ent.timestamp = this.currentTimeSeconds;
          break;
        case MoveType.Bounce:
          runBouncing(ent, this, this.imports, frametime);
          ent.timestamp = this.currentTimeSeconds;
          break;
        case MoveType.FlyMissile:
          runProjectileMovement(ent, this.imports, frametime);
          ent.timestamp = this.currentTimeSeconds;
          break;
        case MoveType.Push:
          runPush(ent, this, this.imports, frametime);
          break;
        case MoveType.Step:
          runStep(ent, this, this.imports, this.gravity, frametime);
          ent.timestamp = this.currentTimeSeconds;
          break;
        case MoveType.Walk:
          // MOVETYPE_WALK is typically for clients or monsters behaving like clients
          // If it has no client attached, treat it as STEP (Quake 2 logic)
          if (!ent.client) {
             runStep(ent, this, this.imports, this.gravity, frametime);
             ent.timestamp = this.currentTimeSeconds;
          }
          break;
      }
    }

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
          case 'inventory':
            fields[descriptor.name] = serializeInventory(value as Record<string, number>);
            break;
          case 'callback':
            fields[descriptor.name] = value ? this.callbackToName.get(value as AnyCallback) ?? null : null;
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
      awareness: {
        frameNumber: this.targetAwareness.frameNumber,
        sightEntityIndex: this.targetAwareness.sightEntity?.index ?? null,
        sightEntityFrame: this.targetAwareness.sightEntityFrame,
        soundEntityIndex: this.targetAwareness.soundEntity?.index ?? null,
        soundEntityFrame: this.targetAwareness.soundEntityFrame,
        sound2EntityIndex: this.targetAwareness.sound2Entity?.index ?? null,
        sound2EntityFrame: this.targetAwareness.sound2EntityFrame,
        sightClientIndex: this.targetAwareness.sightClient?.index ?? null,
      },
      crossLevelFlags: this.crossLevelFlags,
      crossUnitFlags: this.crossUnitFlags,
      level: {
        next_auto_save: this.level.next_auto_save,
        health_bar_entities: [null, null, null, null], // Transient
        intermission_angle: this.level.intermission_angle,
        intermission_origin: this.level.intermission_origin,
        helpmessage1: this.level.helpmessage1,
        helpmessage2: this.level.helpmessage2,
        help1changed: this.level.help1changed,
        help2changed: this.level.help2changed,
      },
    };
  }

  restore(snapshot: EntitySystemSnapshot, callbackRegistry?: CallbackRegistry): void {
    this.spatialGrid.clear(); // Clear grid before restoring
    this.currentTimeSeconds = snapshot.timeSeconds;
    this.crossLevelFlags = snapshot.crossLevelFlags ?? 0;
    this.crossUnitFlags = snapshot.crossUnitFlags ?? 0;
    if (snapshot.level) {
        this.level = { ...snapshot.level };
        this.level.health_bar_entities = [null, null, null, null];
        if (!this.level.intermission_angle) this.level.intermission_angle = { x: 0, y: 0, z: 0 };
        if (!this.level.intermission_origin) this.level.intermission_origin = { x: 0, y: 0, z: 0 };
        if (this.level.helpmessage1 === undefined) this.level.helpmessage1 = "";
        if (this.level.helpmessage2 === undefined) this.level.helpmessage2 = "";
        if (this.level.help1changed === undefined) this.level.help1changed = 0;
        if (this.level.help2changed === undefined) this.level.help2changed = 0;
    }
    this.pool.restore(snapshot.pool);

    const indexToEntity = new Map<number, Entity>();
    for (const entity of this.pool) {
      indexToEntity.set(entity.index, entity);
    }

    // Restore awareness
    if (snapshot.awareness) {
      this.frameNumber = snapshot.awareness.frameNumber;
      this.targetAwareness.frameNumber = snapshot.awareness.frameNumber;
      this.targetAwareness.sightEntity = snapshot.awareness.sightEntityIndex !== null ? indexToEntity.get(snapshot.awareness.sightEntityIndex) || null : null;
      this.targetAwareness.sightEntityFrame = snapshot.awareness.sightEntityFrame;
      this.targetAwareness.soundEntity = snapshot.awareness.soundEntityIndex !== null ? indexToEntity.get(snapshot.awareness.soundEntityIndex) || null : null;
      this.targetAwareness.soundEntityFrame = snapshot.awareness.soundEntityFrame;
      this.targetAwareness.sound2Entity = snapshot.awareness.sound2EntityIndex !== null ? indexToEntity.get(snapshot.awareness.sound2EntityIndex) || null : null;
      this.targetAwareness.sound2EntityFrame = snapshot.awareness.sound2EntityFrame;
      this.targetAwareness.sightClient = snapshot.awareness.sightClientIndex !== null ? indexToEntity.get(snapshot.awareness.sightClientIndex) || null : null;
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
          case 'inventory':
            assignField(entity, name, deserializeInventory(value) as Entity[typeof name]);
            break;
          case 'boolean':
            assignField(entity, name, Boolean(value) as Entity[typeof name]);
            break;
          case 'callback':
            if (value) {
              const callback = callbackRegistry?.get(value as string);
              if (callback) {
                assignField(entity, name, callback as Entity[typeof name]);
              }
            }
            break;
          default:
            assignField(entity, name, value as Entity[typeof name]);
            break;
        }
      }

      // Re-add to spatial grid AFTER fields are restored
      this.spatialGrid.insert(entity);
    }

    for (const ref of pendingEntityRefs) {
      const target = ref.targetIndex === null ? null : indexToEntity.get(ref.targetIndex) ?? null;
      assignField(ref.entity, ref.name, target as Entity[SerializableFieldName]);
    }

    this.thinkScheduler.restore(snapshot.thinks, (index) => indexToEntity.get(index));
  }

  private runTouches(): void {
    // Spatial optimization using areaEdicts
    const world = this.pool.world;
    const activeEntities: Entity[] = [];

    // Collect active entities that can touch or be touched
    // Optimizing this collection might be hard without a separate "active" list,
    // but the nested loop is the killer.
    for (const entity of this.pool) {
      if (entity === world) continue;
      if (!entity.inUse || entity.freePending || entity.solid === Solid.Not) continue;
      activeEntities.push(entity);
    }

    // New optimized approach
    for (const first of activeEntities) {
       const candidates = this.findInBox(first.absmin, first.absmax);
       const firstBounds = computeBounds(first);

       for (const second of candidates) {
         if (first === second) continue;
         if (!first.touch) continue; // Only process if first has a touch callback
         // AABB check again just in case areaEdicts is coarse
         const secondBounds = computeBounds(second);
         if (!boundsIntersect(firstBounds, secondBounds)) continue;

         first.touch(first, second);
         // Do not call second.touch(second, first) here; it will be called when the outer loop reaches 'second'.
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
