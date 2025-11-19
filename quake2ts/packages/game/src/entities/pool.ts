import { Entity } from './entity.js';

const MAX_EDICTS = 2048;
const WORLD_INDEX = 0;

export interface EntityPoolSnapshot {
  readonly capacity: number;
  readonly activeOrder: readonly number[];
  readonly freeList: readonly number[];
  readonly pendingFree: readonly number[];
}

export class EntityPool implements Iterable<Entity> {
  private readonly entities: Entity[];
  private readonly freeList: number[] = [];
  private readonly pendingFree: number[] = [];
  private activeHead: Entity | null = null;

  constructor(maxEntities = MAX_EDICTS) {
    if (maxEntities < 1 || !Number.isInteger(maxEntities)) {
      throw new Error('EntityPool requires a positive integer size');
    }

    this.entities = new Array<Entity>(maxEntities);

    for (let i = 0; i < maxEntities; i += 1) {
      this.entities[i] = new Entity(i);
      if (i !== WORLD_INDEX) {
        this.freeList.push(i);
      }
    }

    const world = this.entities[WORLD_INDEX];
    world.inUse = true;
    world.classname = 'worldspawn';
    this.activeHead = world;
  }

  get world(): Entity {
    return this.entities[WORLD_INDEX];
  }

  get capacity(): number {
    return this.entities.length;
  }

  get activeCount(): number {
    let count = 0;
    for (const _ of this) {
      count += 1;
    }
    return count;
  }

  [Symbol.iterator](): Iterator<Entity> {
    let current = this.activeHead;
    return {
      next: () => {
        if (!current) {
          return { done: true, value: undefined } as const;
        }
        const value = current;
        current = current.linkNext;
        return { done: false, value };
      },
    };
  }

  spawn(): Entity {
    const index = this.freeList.pop();
    if (index === undefined) {
      throw new Error('No free entities available');
    }

    const entity = this.entities[index];
    entity.reset();
    entity.inUse = true;
    this.link(entity);
    return entity;
  }

  deferFree(entity: Entity): void {
    if (entity.index === WORLD_INDEX) {
      throw new Error('Cannot free world entity');
    }

    if (!entity.inUse || entity.freePending) {
      return;
    }

    this.unlink(entity);
    entity.inUse = false;
    entity.freePending = true;
    this.pendingFree.push(entity.index);
  }

  freeImmediate(entity: Entity): void {
    if (entity.index === WORLD_INDEX) {
      throw new Error('Cannot free world entity');
    }

    if (!entity.inUse) {
      return;
    }

    this.unlink(entity);
    entity.reset();
    this.freeList.push(entity.index);
  }

  flushFreeList(): void {
    if (this.pendingFree.length === 0) {
      return;
    }

    for (const index of this.pendingFree) {
      const entity = this.entities[index];
      entity.reset();
      this.freeList.push(index);
    }

    this.pendingFree.length = 0;
  }

  createSnapshot(): EntityPoolSnapshot {
    const activeOrder = Array.from(this, (entity) => entity.index);
    return {
      capacity: this.entities.length,
      activeOrder,
      freeList: [...this.freeList],
      pendingFree: [...this.pendingFree],
    };
  }

  restore(snapshot: EntityPoolSnapshot): void {
    if (snapshot.capacity !== this.entities.length) {
      throw new Error(`Snapshot capacity ${snapshot.capacity} does not match pool capacity ${this.entities.length}`);
    }

    const seen = new Set<number>();
    const noteIndex = (index: number, label: string) => {
      if (index < 0 || index >= this.entities.length) {
        throw new Error(`Invalid entity index ${index} in ${label}`);
      }
      if (seen.has(index)) {
        throw new Error(`Duplicate entity index ${index} in snapshot`);
      }
      seen.add(index);
    };

    for (const index of snapshot.activeOrder) {
      noteIndex(index, 'activeOrder');
    }
    for (const index of snapshot.freeList) {
      noteIndex(index, 'freeList');
    }
    for (const index of snapshot.pendingFree) {
      noteIndex(index, 'pendingFree');
    }

    this.activeHead = null;
    this.freeList.length = 0;
    this.pendingFree.length = 0;

    for (const entity of this.entities) {
      entity.reset();
    }

    for (let i = snapshot.activeOrder.length - 1; i >= 0; i -= 1) {
      const entity = this.entities[snapshot.activeOrder[i]];
      entity.inUse = true;
      this.link(entity);
    }

    for (const index of snapshot.pendingFree) {
      const entity = this.entities[index];
      entity.inUse = false;
      entity.freePending = true;
      entity.linkNext = null;
      entity.linkPrevious = null;
      this.pendingFree.push(index);
    }

    for (const index of snapshot.freeList) {
      const entity = this.entities[index];
      entity.inUse = false;
      entity.freePending = false;
      entity.linkNext = null;
      entity.linkPrevious = null;
      this.freeList.push(index);
    }

    if (!snapshot.activeOrder.includes(WORLD_INDEX)) {
      throw new Error('Snapshot must include the world entity as active');
    }
  }

  private link(entity: Entity): void {
    entity.linkNext = this.activeHead;
    if (this.activeHead) {
      this.activeHead.linkPrevious = entity;
    }
    this.activeHead = entity;
    entity.linkPrevious = null;
  }

  private unlink(entity: Entity): void {
    if (entity.linkPrevious) {
      entity.linkPrevious.linkNext = entity.linkNext;
    }
    if (entity.linkNext) {
      entity.linkNext.linkPrevious = entity.linkPrevious;
    }
    if (this.activeHead === entity) {
      this.activeHead = entity.linkNext;
    }

    entity.linkPrevious = null;
    entity.linkNext = null;
  }
}
