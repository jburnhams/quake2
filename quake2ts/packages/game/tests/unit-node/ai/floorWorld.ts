/**
 * A tiny analytic world for AI tests run through the real entity frame loop: solid below z = 0,
 * optionally only where x < ledge (a drop beyond it), and optionally solid walls, each a slab
 * from x = wall to x = wall + 16 at every y and z.
 */
import { vi } from 'vitest';
import type { Vec3 } from '@quake2ts/shared';
import { createDefaultSpawnRegistry, spawnEntitiesFromText } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { MoveType, ServerFlags, Solid, type Entity } from '../../../src/entities/entity.js';

export const FRAME = 0.025;
const WALL_THICKNESS = 16;

export function floorWorld(lump: string, options: { walls?: number[]; ledge?: number } = {}) {
  const walls = options.walls ?? [];
  const ledge = options.ledge ?? Infinity;
  let entities!: EntitySystem;

  const trace = (start: Vec3, mins: Vec3 | null, maxs: Vec3 | null, end: Vec3) => {
    const lo = mins ?? { x: 0, y: 0, z: 0 };
    const hi = maxs ?? { x: 0, y: 0, z: 0 };
    let fraction = 1;
    let normal: Vec3 | null = null;
    let startsolid = false;

    // the floor, where there is one under the box
    const s = start.z + lo.z;
    const e = end.z + lo.z;
    const overFloor = Math.min(start.x, end.x) + lo.x < ledge;
    if (!overFloor) {
      // nothing below
    } else if (s < 0) startsolid = true;
    else if (e < 0) {
      fraction = s / (s - e);
      normal = { x: 0, y: 0, z: 1 };
    }

    // the walls
    for (const w of walls) {
      const sMin = start.x + lo.x;
      const sMax = start.x + hi.x;
      if (sMax > w && sMin < w + WALL_THICKNESS) {
        startsolid = true;
        continue;
      }
      const dx = end.x - start.x;
      if (dx > 0 && sMax <= w && end.x + hi.x > w) {
        const f = (w - sMax) / dx;
        if (f < fraction) {
          fraction = f;
          normal = { x: -1, y: 0, z: 0 };
        }
      } else if (dx < 0 && sMin >= w + WALL_THICKNESS && end.x + lo.x < w + WALL_THICKNESS) {
        const f = (sMin - (w + WALL_THICKNESS)) / -dx;
        if (f < fraction) {
          fraction = f;
          normal = { x: 1, y: 0, z: 0 };
        }
      }
    }

    if (startsolid) fraction = 0;
    return {
      allsolid: startsolid,
      startsolid,
      fraction,
      endpos: {
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
        z: start.z + (end.z - start.z) * fraction,
      },
      plane: normal ? { normal, dist: 0, type: 0, signbits: 0 } : null,
      surfaceFlags: 0,
      contents: fraction < 1 ? 1 : 0,
      ent: fraction < 1 ? entities.world : null,
    };
  };

  const engine = { sound: vi.fn(), centerprintf: vi.fn(), modelIndex: () => 1 } as any;
  const imports = { trace, pointcontents: () => 0, multicast: vi.fn(), unicast: vi.fn(), configstring: vi.fn() } as any;
  entities = new EntitySystem(engine, imports, { x: 0, y: 0, z: -800 }, 1024);
  const spawned = spawnEntitiesFromText(lump, { registry: createDefaultSpawnRegistry(engine), entities });

  let time = 0;
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / FRAME); i++) {
      time += FRAME;
      entities.beginFrame(time);
      entities.runFrame();
    }
  };

  /** A player standing on the floor: what the AI looks for, without the client code. */
  const player = (origin: Vec3): Entity => {
    const p = entities.spawn();
    p.classname = 'player';
    p.svflags |= ServerFlags.Player;
    p.solid = Solid.BoundingBox;
    p.movetype = MoveType.None;
    p.mins = { x: -16, y: -16, z: -24 };
    p.maxs = { x: 16, y: 16, z: 32 };
    p.origin = { ...origin, z: 24 };
    p.viewheight = 22;
    p.health = 100;
    p.takedamage = true;
    p.client = { inventory: {}, pers: {} } as any;
    entities.linkentity(p);
    return p;
  };

  return { entities, spawned, run, player };
}
