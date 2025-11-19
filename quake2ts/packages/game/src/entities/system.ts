import type { Vec3 } from '@quake2ts/shared';
import { Entity } from './entity.js';
import { EntityPool } from './pool.js';
import { ThinkScheduler } from './thinkScheduler.js';

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
    if (entity.target) {
      for (const target of this.findByTargetName(entity.target)) {
        if (target === entity) {
          continue;
        }
        target.use?.(target, entity, activator ?? entity);
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

  runFrame(): void {
    this.thinkScheduler.runDueThinks(this.currentTimeSeconds);
    this.runTouches();
    this.pool.flushFreeList();
  }

  private runTouches(): void {
    const world = this.pool.world;
    const activeEntities: Entity[] = [];
    for (const entity of this.pool) {
      if (entity === world) {
        continue;
      }
      if (!entity.inUse || entity.freePending) {
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
}
