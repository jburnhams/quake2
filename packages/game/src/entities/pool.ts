import { Entity } from './entity.js';

const MAX_EDICTS = 2048;
const WORLD_INDEX = 0;

export interface EntityPoolSnapshot {
  readonly capacity: number;
  /** In-use entities, in index order. */
  readonly activeOrder: readonly number[];
  /** globals.num_edicts: one past the highest slot ever handed out. */
  readonly numEdicts?: number;
  /** When each free slot below numEdicts was freed (seconds of level time), as [index, freetime]. */
  readonly freeTimes?: readonly (readonly [number, number])[];
  /** Kept for older snapshots; unused. */
  readonly freeList?: readonly number[];
  readonly pendingFree?: readonly number[];
}

/**
 * The game's edict array, handed out as the rerelease's G_Spawn and G_FreeEdict (g_utils.cpp) do:
 *
 * - a new entity takes the lowest free slot after the clients (and the world), but a slot freed
 *   in the last half second is skipped once the level has run two seconds, so a client never
 *   sees one entity turn into another; with none free, the array grows (num_edicts);
 * - a freed entity is out of use at once, and keeps the time it was freed;
 * - iteration is in index order, as every loop over g_edicts is.
 */
export class EntityPool implements Iterable<Entity> {
  private readonly entities: Entity[];
  private numEdicts = 1;
  /** Level time in seconds, for freetime; the entity system sets it each frame. */
  now = 0;

  constructor(maxEntities = MAX_EDICTS) {
    if (maxEntities < 1 || !Number.isInteger(maxEntities)) {
      throw new Error('EntityPool requires a positive integer size');
    }

    this.entities = new Array<Entity>(maxEntities);
    for (let i = 0; i < maxEntities; i += 1) {
      this.entities[i] = new Entity(i);
    }

    const world = this.entities[WORLD_INDEX];
    world.inUse = true;
    world.classname = 'worldspawn';
  }

  get world(): Entity {
    return this.entities[WORLD_INDEX];
  }

  get capacity(): number {
    return this.entities.length;
  }

  /** globals.num_edicts. */
  get count(): number {
    return this.numEdicts;
  }

  get activeCount(): number {
    let count = 0;
    for (const _ of this) {
      count += 1;
    }
    return count;
  }

  getByIndex(index: number): Entity | undefined {
    return this.entities[index];
  }

  [Symbol.iterator](): Iterator<Entity> {
    let i = 0;
    return {
      next: () => {
        while (i < this.numEdicts) {
          const value = this.entities[i++];
          if (value.inUse) return { done: false, value };
        }
        return { done: true, value: undefined } as const;
      },
    };
  }

  /** Number of slots after the world kept for clients (edicts 1..maxclients in the original). */
  private reservedSlots = 0;

  /**
   * Keeps slots 1..count for clients, so map entities start after them as in the original
   * and the player is edict 1 (InitGame sets num_edicts to maxclients + 1).
   */
  reserveClientSlots(count: number): void {
    this.reservedSlots = Math.min(count, this.entities.length - 1);
    this.numEdicts = Math.max(this.numEdicts, this.reservedSlots + 1);
  }

  /** The lowest free client slot, or undefined if none is reserved or all are taken. */
  spawnClient(): Entity | undefined {
    for (let i = 1; i <= this.reservedSlots; i += 1) {
      const entity = this.entities[i];
      if (!entity.inUse) {
        entity.reset();
        entity.inUse = true;
        return entity;
      }
    }
    return undefined;
  }

  /** G_Spawn. */
  spawn(): Entity {
    let i = this.reservedSlots + 1;
    for (; i < this.numEdicts; i += 1) {
      const e = this.entities[i];
      // the first couple seconds of server time can involve a lot of
      // freeing and allocating, so relax the replacement policy
      if (!e.inUse && (e.freetime < 2 || this.now - e.freetime > 0.5)) {
        return this.initEdict(e);
      }
    }
    if (i >= this.entities.length) {
      throw new Error('No free entities available');
    }
    this.numEdicts += 1;
    return this.initEdict(this.entities[i]);
  }

  /** G_InitEdict. */
  private initEdict(e: Entity): Entity {
    e.reset();
    e.inUse = true;
    e.classname = 'noclass';
    return e;
  }

  /** G_FreeEdict: out of use at once; the entity's fields are cleared and its free time kept. */
  deferFree(entity: Entity): void {
    this.freeImmediate(entity);
  }

  freeImmediate(entity: Entity): void {
    if (entity.index === WORLD_INDEX) {
      throw new Error('Cannot free world entity');
    }
    if (!entity.inUse) {
      return;
    }
    entity.reset();
    entity.classname = 'freed';
    entity.freetime = this.now;
  }

  /** Kept for callers from when frees were deferred to the end of a frame. */
  flushFreeList(): void {}

  createSnapshot(): EntityPoolSnapshot {
    const activeOrder = Array.from(this, (entity) => entity.index);
    const freeTimes: [number, number][] = [];
    for (let i = 1; i < this.numEdicts; i += 1) {
      const e = this.entities[i];
      if (!e.inUse && e.freetime) freeTimes.push([i, e.freetime]);
    }
    return { capacity: this.entities.length, activeOrder, numEdicts: this.numEdicts, freeTimes };
  }

  restore(snapshot: EntityPoolSnapshot): void {
    if (snapshot.capacity !== this.entities.length) {
      throw new Error(`Snapshot capacity ${snapshot.capacity} does not match pool capacity ${this.entities.length}`);
    }

    const seen = new Set<number>();
    for (const index of snapshot.activeOrder) {
      if (index < 0 || index >= this.entities.length) {
        throw new Error(`Invalid entity index ${index} in activeOrder`);
      }
      if (seen.has(index)) {
        throw new Error(`Duplicate entity index ${index} in snapshot`);
      }
      seen.add(index);
    }
    if (!seen.has(WORLD_INDEX)) {
      throw new Error('Snapshot must include the world entity as active');
    }

    for (const entity of this.entities) {
      entity.reset();
    }
    let top = this.reservedSlots + 1;
    for (const index of snapshot.activeOrder) {
      this.entities[index].inUse = true;
      top = Math.max(top, index + 1);
    }
    for (const [index, time] of snapshot.freeTimes ?? []) {
      this.entities[index].freetime = time;
    }
    this.numEdicts = Math.max(top, snapshot.numEdicts ?? 0);
  }
}
