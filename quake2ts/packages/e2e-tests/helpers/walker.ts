/**
 * Walks the player of a LocalHost through a map, objective by objective, for the
 * walkthrough gate. Each leg plans a route (route.ts) from where the player stands, through
 * the world as it is now, with two allowances: doors that open on approach are planned as
 * open, and monsters are ignored (they move). Then it steers along the route a frame at a
 * time, as a player would, and fails if the player stops making progress.
 */
import { MASK_PLAYERSOLID, type Vec3 } from '@quake2ts/shared';
import { MoveType, type Entity } from '@quake2ts/game';
import type { LocalHost } from '@quake2ts/server';
import { PLAYER_MAXS, PLAYER_MINS, findRoute, simplifyRoute, type RouteWorld } from './route.js';

export interface Objective {
  /** Shown in failures, e.g. "press the lift button". */
  readonly name: string;
  /** The entity to reach: a trigger to stand in, or a button to walk into. */
  readonly find: (host: LocalHost) => Entity | undefined;
  /** Walk into the entity after reaching it (buttons), rather than stopping beside it. */
  readonly press?: boolean;
  /** Before planning this leg, wait until this holds (a lift at the bottom), up to waitSeconds. */
  readonly waitFor?: (host: LocalHost) => boolean;
  readonly waitSeconds?: number;
}

export interface LegResult {
  readonly objective: string;
  readonly reached: boolean;
  readonly seconds: number;
  readonly waypoints: number;
  readonly failure?: string;
}

/** Doors with no targetname and no health open when walked up to. */
const opensOnApproach = (e: Entity) => e.classname === 'func_door' && !e.targetname && !e.health && !!e.moveinfo?.end_origin;

/** Plans against the world as it is now, with approach doors open and monsters and players lifted out. */
function withPlanningWorld<T>(host: LocalHost, plan: (world: RouteWorld) => T): T {
  const { world, game } = host.map;
  const lifted: Entity[] = [];
  const moved: [Entity, Vec3][] = [];
  game.entities.forEachEntity((e) => {
    if (!world.isLinked(e)) return;
    if (opensOnApproach(e)) {
      moved.push([e, e.origin]);
      e.origin = { ...e.moveinfo!.end_origin! };
      world.link(e);
    } else if (e.client || e.movetype === MoveType.Step || e.movetype === MoveType.Walk) {
      lifted.push(e);
      world.unlink(e);
    }
  });
  try {
    return plan({
      trace: (a, b) => world.trace(a, PLAYER_MINS, PLAYER_MAXS, b, null, MASK_PLAYERSOLID),
      pointContents: (p) => world.pointContents(p),
    });
  } finally {
    for (const e of lifted) world.link(e);
    for (const [e, origin] of moved) {
      e.origin = origin;
      world.link(e);
    }
  }
}

const overlaps = (p: Vec3, e: Entity, pad: number) =>
  p.x + PLAYER_MAXS.x + pad > e.absmin.x &&
  p.x + PLAYER_MINS.x - pad < e.absmax.x &&
  p.y + PLAYER_MAXS.y + pad > e.absmin.y &&
  p.y + PLAYER_MINS.y - pad < e.absmax.y &&
  p.z + PLAYER_MAXS.z + pad > e.absmin.z &&
  p.z + PLAYER_MINS.z - pad < e.absmax.z;

const center = (e: Entity): Vec3 => ({
  x: (e.absmin.x + e.absmax.x) / 2,
  y: (e.absmin.y + e.absmax.y) / 2,
  z: (e.absmin.z + e.absmax.z) / 2,
});

/** Turns the player toward a point and runs one frame, slowing for the last few units. */
function stepToward(host: LocalHost, to: Vec3): number {
  const p = host.player!.origin;
  const dx = to.x - p.x;
  const dy = to.y - p.y;
  const d = Math.hypot(dx, dy);
  const yaw = (Math.atan2(dy, dx) * 180) / Math.PI;
  host.frame({ forwardmove: Math.min(400, d * 40), angles: { x: 0, y: yaw, z: 0 } });
  return d;
}

/** Walks one objective. Gives up when the player makes no progress for stuckSeconds. */
export function walkObjective(host: LocalHost, objective: Objective, stuckSeconds = 4): LegResult {
  const startTime = host.timeSeconds;
  const result = (reached: boolean, waypoints: number, failure?: string): LegResult => ({
    objective: objective.name,
    reached,
    seconds: host.timeSeconds - startTime,
    waypoints,
    failure,
  });

  if (objective.waitFor) {
    const until = host.timeSeconds + (objective.waitSeconds ?? 10);
    while (!objective.waitFor(host)) {
      if (host.timeSeconds > until) return result(false, 0, 'gave up waiting');
      host.frame({});
    }
  }

  const target = objective.find(host);
  if (!target) return result(false, 0, 'objective entity not found');
  const pad = objective.press ? 4 : 0;
  const route = withPlanningWorld(host, (world) => {
    const raw = findRoute(world, host.player!.origin, (p) => overlaps(p, target, pad));
    return raw && simplifyRoute(world, raw);
  });
  if (!route) return result(false, 0, `no route from ${fmt(host.player!.origin)}`);

  for (let i = 1; i < route.length; i++) {
    const w = route[i];
    let best = Infinity;
    let lastProgress = host.timeSeconds;
    for (;;) {
      const p = host.player!.origin;
      const d = Math.hypot(w.x - p.x, w.y - p.y);
      if (d < 8 && Math.abs(p.z - w.z) < 40) break;
      if (d < best - 1) {
        best = d;
        lastProgress = host.timeSeconds;
      }
      if (host.timeSeconds - lastProgress > stuckSeconds)
        return result(false, route.length, `stuck at ${fmt(p)} going to waypoint ${i} ${fmt(w)}`);
      stepToward(host, w);
    }
  }

  if (objective.press) {
    // Walk into it until it moves.
    const until = host.timeSeconds + 1;
    const startState = target.moveinfo?.state;
    while (host.timeSeconds < until && target.moveinfo?.state === startState) stepToward(host, center(target));
    if (target.moveinfo?.state === startState) return result(false, route.length, `${target.classname} did not move`);
  } else if (!overlaps(host.player!.origin, target, 0)) {
    return result(false, route.length, `ended at ${fmt(host.player!.origin)}, outside ${target.classname}`);
  }
  return result(true, route.length);
}

const fmt = (p: Vec3) => `(${Math.round(p.x)} ${Math.round(p.y)} ${Math.round(p.z)})`;
