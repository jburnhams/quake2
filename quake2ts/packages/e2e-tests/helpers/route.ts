/**
 * Finds a walking route through a map's world brushes for the walkthrough gate.
 *
 * A breadth-first search over standing spots on a grid: from each spot it tries a step in
 * eight directions with the player's box (step up to 18 units, as pmove does, or drop down
 * any height a player survives), and keeps spots with a floor under them. The caller's
 * trace decides what counts as solid: worldTrace() is the world brushes only, and a host
 * can add the entities that stay put (crates, corpses) but leave out doors and lifts, so
 * walking the route is what tests them.
 */
import { CONTENTS_LAVA, CONTENTS_SLIME, MASK_PLAYERSOLID, pointContents, traceBox, type CollisionModel, type Vec3 } from '@quake2ts/shared';

export interface RouteTraceResult {
  readonly fraction: number;
  readonly endpos: Vec3;
  readonly startsolid: boolean;
  readonly allsolid: boolean;
  readonly plane?: { readonly normal: Vec3 } | null;
}

/** A player-box trace from start to end. */
export type RouteTrace = (start: Vec3, end: Vec3) => RouteTraceResult;

export interface RouteWorld {
  readonly trace: RouteTrace;
  readonly pointContents: (p: Vec3) => number;
}

export const PLAYER_MINS: Vec3 = { x: -16, y: -16, z: -24 };
export const PLAYER_MAXS: Vec3 = { x: 16, y: 16, z: 32 };
const STEP = 18;
const MAX_DROP = 300;
const GRID = 16;

export interface RouteOptions {
  readonly grid?: number;
  readonly maxNodes?: number;
}

const add = (a: Vec3, x: number, y: number, z: number): Vec3 => ({ x: a.x + x, y: a.y + y, z: a.z + z });

/** The world brushes only. */
export function worldOnly(model: CollisionModel): RouteWorld {
  return {
    trace: (start, end) =>
      traceBox({ model, start, end, mins: PLAYER_MINS, maxs: PLAYER_MAXS, headnode: 0, contentMask: MASK_PLAYERSOLID }),
    pointContents: (p) => pointContents(p, model),
  };
}

/** Drops a player box at p onto the floor below it, or undefined if there is none it can stand on. */
export function dropToFloor(world: RouteWorld, p: Vec3, maxDrop = MAX_DROP): Vec3 | undefined {
  const t = world.trace(p, add(p, 0, 0, -maxDrop));
  if (t.startsolid || t.allsolid || t.fraction === 1) return undefined;
  if (!t.plane || t.plane.normal.z < 0.7) return undefined;
  const at = t.endpos;
  const below = world.pointContents(add(at, 0, 0, PLAYER_MINS.z + 1));
  if (below & (CONTENTS_LAVA | CONTENTS_SLIME)) return undefined;
  return at;
}

const key = (p: Vec3, grid: number) => `${Math.round(p.x / grid)},${Math.round(p.y / grid)},${Math.round(p.z / 8)}`;

/**
 * Standing spots from start to any spot for which reached() is true, or undefined.
 * The first spot is start dropped to the floor.
 */
export function findRoute(world: RouteWorld, start: Vec3, reached: (p: Vec3) => boolean, options: RouteOptions = {}): Vec3[] | undefined {
  const grid = options.grid ?? GRID;
  const maxNodes = options.maxNodes ?? 400_000;
  const trace = world.trace;
  const first = dropToFloor(world, start);
  if (!first) return undefined;
  const prev = new Map<string, string | null>([[key(first, grid), null]]);
  const at = new Map<string, Vec3>([[key(first, grid), first]]);
  const queue: Vec3[] = [first];
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  for (let head = 0; head < queue.length && prev.size < maxNodes; head++) {
    const p = queue[head];
    const pk = key(p, grid);
    if (reached(p)) {
      const route: Vec3[] = [];
      for (let k: string | null = pk; k; k = prev.get(k) ?? null) route.push(at.get(k)!);
      return route.reverse();
    }
    for (const [dx, dy] of dirs) {
      // Up by a step, across, then down onto whatever is there: the shape of a pmove step.
      const up = trace(p, add(p, 0, 0, STEP));
      const across = trace(up.endpos, add(up.endpos, dx * grid, dy * grid, 0));
      if (across.fraction < 1) continue;
      const landed = dropToFloor(world, across.endpos, STEP + MAX_DROP);
      if (!landed) continue;
      const k = key(landed, grid);
      if (prev.has(k)) continue;
      prev.set(k, pk);
      at.set(k, landed);
      queue.push(landed);
    }
  }
  return undefined;
}

/** Thins a route to the spots where it turns or changes height, so a walker steers between fewer points. */
export function simplifyRoute(world: RouteWorld, route: Vec3[]): Vec3[] {
  if (route.length < 3) return route;
  const trace = world.trace;
  const out = [route[0]];
  let anchor = 0;
  for (let i = 2; i < route.length; i++) {
    const a = route[anchor];
    const b = route[i];
    const level = Math.abs(b.z - a.z) < 1;
    const clear = level && trace(add(a, 0, 0, 1), add(b, 0, 0, 1)).fraction === 1;
    if (!clear) {
      out.push(route[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(route[route.length - 1]);
  return out;
}
