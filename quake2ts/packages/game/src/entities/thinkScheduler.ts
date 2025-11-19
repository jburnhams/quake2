import type { Entity } from './entity.js';

interface ScheduledThink {
  readonly time: number;
  readonly entity: Entity;
}

export class ThinkScheduler {
  private readonly queue: ScheduledThink[] = [];

  schedule(entity: Entity, timeSeconds: number): void {
    entity.nextthink = timeSeconds;
    this.queue.push({ entity, time: timeSeconds });
    this.queue.sort((a, b) => (a.time === b.time ? a.entity.index - b.entity.index : a.time - b.time));
  }

  cancel(entity: Entity): void {
    if (this.queue.length === 0) {
      return;
    }
    for (let i = this.queue.length - 1; i >= 0; i -= 1) {
      if (this.queue[i].entity === entity) {
        this.queue.splice(i, 1);
      }
    }
  }

  runDueThinks(currentTimeSeconds: number): void {
    while (this.queue.length > 0) {
      const next = this.queue[0];
      if (next.time > currentTimeSeconds) {
        break;
      }

      this.queue.shift();
      const { entity, time } = next;
      if (!entity.inUse || entity.freePending) {
        continue;
      }
      if (!entity.think) {
        continue;
      }
      if (entity.nextthink !== time) {
        continue;
      }

      entity.think(entity);
    }
  }
}
