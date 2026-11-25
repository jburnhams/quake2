import type { Vec3 } from '@quake2ts/shared';
import { createRandomGenerator, scaleVec3, RandomGenerator } from '@quake2ts/shared';
import { runGravity, runBouncing, runProjectileMovement, runStep } from '../physics/movement.js';
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
  FL_NOTARGET
} from './entity.js';
import { EntityPool, type EntityPoolSnapshot } from './pool.js';
import type { ThinkScheduleEntry } from './thinkScheduler.js';
import { physicsPusher } from '../physics/pusher.js';
import { lengthVec3, subtractVec3, ServerCommand } from '@quake2ts/shared';
import type { AnyCallback, CallbackRegistry } from './callbacks.js';
import type { TargetAwarenessState } from '../ai/targeting.js';
import type { SpawnFunction, SpawnRegistry } from './spawn.js';
import { SpatialGrid } from './spatial.js';
import { ScriptHookRegistry } from '../scripting/hooks.js';

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
  mapname?: string; // Added mapname
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

interface ExtendedTargetAwarenessState extends TargetAwarenessState {
  activePlayers: Entity[];
  monsterAlertedByPlayers(monster: Entity): Entity | null;
  soundClient(): Entity | null;
}

/** Allowance for float rounding when comparing a nextthink with level time. */
const THINK_TIME_EPSILON = 1e-4;

export class EntitySystem {
  private readonly pool: EntityPool;
  private readonly targetNameIndex = new Map<string, Set<Entity>>();
  private readonly random: RandomGenerator;
  private readonly callbackToName: Map<AnyCallback, string>;
  private spawnRegistry?: SpawnRegistry;
  private currentTimeSeconds = 0;
  private currentDeltaSeconds = 0;
  private frameNumber = 0;
  private spawnCount = 0;

  private spatialGrid: SpatialGrid;
  private spatialGridInUse = false;
  /** Entities linked and not since unlinked or freed: what the grid holds once it is in use. */
  private readonly linkedEntities = new Set<Entity>();

  // We will lazily access this.scriptHooks from _game or via a property if passed.
  // Actually, EntitySystem doesn't own the registry, GameExports does.
  // But GameExports is initialized with EntitySystem, so it's circular.
  // We can add a property that delegates to _game.hooks.
  get scriptHooks(): ScriptHookRegistry | undefined {
      return (this as any)._game?.hooks;
  }

  readonly targetAwareness: ExtendedTargetAwarenessState;

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

  registerEntityClass(classname: string, factory: SpawnFunction): void {
    this.spawnRegistry?.register(classname, factory);
  }

  getSpawnFunction(classname: string): SpawnFunction | undefined {
    return this.spawnRegistry?.get(classname);
  }

  readonly engine: GameEngine;
  readonly imports: GameImports;
  private readonly gravity: Vec3;
  readonly deathmatch: boolean;
  readonly skill: number;
  readonly coop: boolean;

  get trace(): TraceFunction {
    return this.imports.trace;
  }

  get traceModel() {
    return this.imports.traceModel;
  }

  get pointcontents(): PointContentsFunction {
    return this.imports.pointcontents;
  }

  get areaEdicts() {
      return this.imports.areaEdicts;
  }

  get game(): any {
      return (this as any)._game;
  }

  get maxClients(): number {
    return 32; // Default, can be configurable or from engine
  }

  get entities(): ArrayLike<Entity | null> {
    // This is a rough approximation to allow index-based access like g_edicts
    // for legacy code ports. It's not efficient.
    const arr: (Entity | null)[] = new Array(this.pool.capacity + 1).fill(null);
    for (const ent of this.pool) {
      if (ent.index >= 0 && ent.index < arr.length) {
        arr[ent.index] = ent;
      }
    }
    return arr;
  }

  get deltaSeconds(): number {
      return this.currentDeltaSeconds;
  }

  constructor(
    engine: GameEngine,
    imports?: Partial<GameImports>,
    gravity?: Vec3,
    maxEntities?: number,
    callbackRegistry?: CallbackRegistry,
    deathmatch?: boolean,
    skill?: number,
    random?: RandomGenerator,
    coop?: boolean,
    readonly friendlyFire: boolean = false
  ) {
    this.pool = new EntityPool(maxEntities);
    this.engine = engine;
    this.deathmatch = deathmatch ?? false;
    this.coop = coop ?? false;
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
      setLagCompensation: () => {},
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
        // The local grid only serves findInBox when the host has no area query of its own,
        // so it is kept up to date only once findInBox has needed it.
        this.linkedEntities.add(ent);
        if (this.spatialGridInUse) this.spatialGrid.update(ent);
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
      activePlayers: [],
      monsterAlertedByPlayers: (monster: Entity) => null, // Default implementation
      soundClient: () => null // Default implementation
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

  /** See EntityPool.reserveClientSlots. */
  reserveClientSlots(count: number): void {
    this.pool.reserveClientSlots(count);
  }

  /** An entity in the lowest free client slot, or an ordinary one if no slots are reserved. */
  spawnClient(): Entity {
    const ent = this.pool.spawnClient();
    if (!ent) return this.spawn();
    this.spawnCount++;
    ent.spawn_count = this.spawnCount;
    ent.timestamp = this.currentTimeSeconds;
    this.scriptHooks?.onEntitySpawn?.(ent);
    return ent;
  }

  spawn(): Entity {
    const ent = this.pool.spawn();
    this.spawnCount++;
    ent.spawn_count = this.spawnCount;
    ent.timestamp = this.currentTimeSeconds;
    this.scriptHooks?.onEntitySpawn?.(ent);
    return ent;
  }

  free(entity: Entity): void {
    this.scriptHooks?.onEntityRemove?.(entity);
    this.unregisterTarget(entity);
    this.spatialGrid.remove(entity);
    this.linkedEntities.delete(entity);
    this.imports.unlinkentity?.(entity);
    this.pool.deferFree(entity);
  }

  freeImmediate(entity: Entity): void {
    this.unregisterTarget(entity);
    this.spatialGrid.remove(entity);
    this.linkedEntities.delete(entity);
    this.imports.unlinkentity?.(entity);
    this.pool.freeImmediate(entity);
  }

  sound(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void {
    this.engine.sound?.(entity, channel, sound, volume, attenuation, timeofs);
  }

  soundIndex(sound: string): number {
    return this.engine.soundIndex?.(sound) || 0;
  }

  configStringIndex(str: string): number {
      // Not typically exposed by engine directly like soundIndex/modelIndex
      // But maybe configString lookup is possible if we track it?
      // Or engine.configStringIndex?
      // If the engine interface doesn't have it, we might need to rely on cached values or assume 0.
      // For now, let's assume engine might provide it or return 0.
      return (this.engine as any).configStringIndex?.(str) || 0;
  }

  modelIndex(model: string): number {
    return this.engine.modelIndex?.(model) || 0;
  }

  linkentity(ent: Entity): void {
    this.imports.linkentity(ent);
  }

  /** gi.setmodel: the host fills in a submodel's bounds; without one, only modelindex is set. */
  setModel(ent: Entity, name: string): void {
    ent.model = name;
    if (this.imports.setmodel) {
      this.imports.setmodel(ent, name);
    } else {
      ent.modelindex = this.modelIndex(name);
    }
  }

  link(ent: Entity): void {
    this.linkentity(ent);
  }

  /** gi.unlinkentity: out of the local spatial grid and the server's collision world. */
  unlink(ent: Entity): void {
    this.spatialGrid.remove(ent);
    this.linkedEntities.delete(ent);
    this.imports.unlinkentity?.(ent);
  }

  multicast(origin: Vec3, type: MulticastType, ServerCommand: ServerCommand, ...args: any[]): void {
    this.imports.multicast(origin, type, ServerCommand, ...args);
  }

  unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void {
    this.imports.unicast(ent, reliable, event, ...args);
  }

  /** Sets ent.nextthink; G_RunFrame runs the think when level time reaches it. */
  scheduleThink(entity: Entity, nextThinkSeconds: number): void {
    entity.nextthink = nextThinkSeconds;
  }

  /** gi.frame_time_s: the length of the frame being run. */
  get frameTimeSeconds(): number {
    return this.currentDeltaSeconds;
  }

  /** level.current_entity: the entity G_RunFrame is running, or null outside the loop. */
  currentEntity: Entity | null = null;

  get capacity(): number {
    return this.pool.capacity;
  }

  /** Whether the entity is linked into the world (gi.linkentity and not since unlinked). */
  isLinked(ent: Entity): boolean {
    return this.linkedEntities.has(ent);
  }

  /**
   * SV_RunThink: runs the entity's think if its nextthink has come, and says whether it
   * did not (so callers can carry on). Times are float seconds here, so "has come" allows
   * for the rounding of sums like 0.1 + 0.2.
   */
  runThink(ent: Entity): boolean {
    const thinktime = ent.nextthink;
    if (thinktime <= 0) return true;
    if (thinktime > this.currentTimeSeconds + THINK_TIME_EPSILON) return true;
    ent.nextthink = 0;
    ent.think?.(ent, this);
    return false;
  }

  /**
   * G_TouchTriggers: calls the touch function of every trigger the entity's box is in.
   * Dead players and monsters don't set triggers off.
   */
  touchTriggers(ent: Entity): void {
    if ((ent.client || ent.svflags & ServerFlags.Monster) && ent.health <= 0) return;
    for (const hit of this.findInBox(ent.absmin, ent.absmax)) {
      if (hit === ent || hit.solid !== Solid.Trigger || !hit.touch) continue;
      if (!hit.inUse || hit.freePending) continue;
      if (
        ent.absmin.x > hit.absmax.x || ent.absmax.x < hit.absmin.x ||
        ent.absmin.y > hit.absmax.y || ent.absmax.y < hit.absmin.y ||
        ent.absmin.z > hit.absmax.z || ent.absmax.z < hit.absmin.z
      )
        continue;
      hit.touch(hit, ent);
    }
  }

  beginFrame(timeSeconds: number): void {
    this.currentDeltaSeconds = timeSeconds - this.currentTimeSeconds;
    this.currentTimeSeconds = timeSeconds;
    this.frameNumber++;
    this.targetAwareness.timeSeconds = timeSeconds;
    this.targetAwareness.frameNumber = this.frameNumber;

    // Update active players list
    // This is simple: just iterate and check clients.
    this.targetAwareness.activePlayers = [];
    for (let i = 1; i <= this.maxClients; i++) {
        const ent = this.entities[i];
        if (ent && ent.inUse && !ent.freePending && (ent.svflags & ServerFlags.Player) && (ent.flags & FL_NOTARGET) === 0) {
             this.targetAwareness.activePlayers.push(ent);
        }
    }
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
      // No area query from the host: use the local grid, filling it the first time.
      if (!this.spatialGridInUse) {
        this.spatialGridInUse = true;
        for (const entity of this.linkedEntities) this.spatialGrid.update(entity);
      }
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

  /**
   * The entity loop of G_RunFrame (g_main.cpp) with G_RunEntity (g_phys.cpp): every entity
   * in index order runs its physics, and its think from inside that physics, as the
   * original does. Clients move by their usercmds (ClientThink), not here.
   */
  runFrame(): void {
    const capacity = this.pool.capacity;
    for (let i = 0; i < capacity; i++) {
      const ent = this.pool.getByIndex(i);
      if (!ent || !ent.inUse || ent.freePending) continue;
      this.currentEntity = ent;
      if (ent.client) {
        // ClientBeginServerFrame; the port still gives clients their think here.
        this.runThink(ent);
        continue;
      }
      this.runEntity(ent);
    }
    this.currentEntity = null;
    this.pool.flushFreeList();
  }

  /** G_RunEntity: one entity's physics for this frame, by its movetype. */
  private runEntity(ent: Entity): void {

    const frametime = this.currentDeltaSeconds;
    if (ent.movetype !== MoveType.None && ent.movetype !== MoveType.Push && ent.movetype !== MoveType.Stop && ent.movetype !== MoveType.Noclip) {
      checkWater(ent, this, this.imports);
    }

    switch (ent.movetype) {
      case MoveType.Push:
      case MoveType.Stop:
        physicsPusher(ent, this);
        break;
      case MoveType.None:
        this.runThink(ent);
        break;
      case MoveType.Noclip:
        // SV_Physics_Noclip
        if (this.runThink(ent) && ent.inUse) {
          ent.angles = { x: ent.angles.x + ent.avelocity.x * frametime, y: ent.angles.y + ent.avelocity.y * frametime, z: ent.angles.z + ent.avelocity.z * frametime };
          ent.origin = { x: ent.origin.x + ent.velocity.x * frametime, y: ent.origin.y + ent.velocity.y * frametime, z: ent.origin.z + ent.velocity.z * frametime };
          this.linkentity(ent);
        }
        break;
      case MoveType.Step:
      case MoveType.Walk:
        // SV_Physics_Step: move, then think.
        runStep(ent, this, this.imports, this.gravity, frametime);
        ent.timestamp = this.currentTimeSeconds;
        this.runThink(ent);
        break;
      case MoveType.Toss:
      case MoveType.Bounce:
      case MoveType.Fly:
      case MoveType.FlyMissile:
      case MoveType.WallBounce:
        // SV_Physics_Toss: think, then move.
        this.runThink(ent);
        if (!ent.inUse || ent.freePending) break;
        if (ent.movetype === MoveType.Toss) runGravity(ent, this.gravity, frametime);
        if (ent.movetype === MoveType.FlyMissile) runProjectileMovement(ent, this.imports, frametime);
        else if (ent.movetype !== MoveType.Fly) runBouncing(ent, this, this.imports, frametime);
        ent.timestamp = this.currentTimeSeconds;
        break;
      default:
        this.runThink(ent);
        break;
    }

    ent.postthink?.(ent, this);
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
      thinks: [],
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
    this.linkedEntities.clear();
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
      this.linkedEntities.add(entity);
    }

    for (const ref of pendingEntityRefs) {
      const target = ref.targetIndex === null ? null : indexToEntity.get(ref.targetIndex) ?? null;
      assignField(ref.entity, ref.name, target as Entity[SerializableFieldName]);
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
