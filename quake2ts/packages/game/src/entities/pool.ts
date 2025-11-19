import { Entity } from './entity.js';

const MAX_EDICTS = 2048;
const WORLD_INDEX = 0;

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
