/**
 * Walks the player of a LocalHost through a map, objective by objective, for the
 * walkthrough gate. Each leg plans a route (route.ts) from where the player stands, through
 * the world as it is now, with two allowances: doors that open on approach are planned as
 * open, and monsters are ignored (they move). Then it steers along the route a frame at a
 * time, as a player would. If a monster stands in the way, it plans again round the monsters
 * where they are now, a few times, before failing because the player stopped making progress. On the way it fights:
 * it shoots the nearest monster it can see that is after it, still walking the route.
 */
import { MASK_PLAYERSOLID, MASK_SHOT, type Vec3 } from '@quake2ts/shared';
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

/**
 * Plans against the world as it is now, with approach doors open and players lifted out, and
 * monsters too unless keepMonsters.
 */
function withPlanningWorld<T>(host: LocalHost, plan: (world: RouteWorld) => T, keepMonsters = false): T {
  const { world, game } = host.map;
  const lifted: Entity[] = [];
  const moved: [Entity, Vec3][] = [];
  game.entities.forEachEntity((e) => {
    if (!world.isLinked(e)) return;
    if (opensOnApproach(e)) {
      moved.push([e, e.origin]);
      e.origin = { ...e.moveinfo!.end_origin! };
      world.link(e);
    } else if (e.client || (!keepMonsters && (e.movetype === MoveType.Step || e.movetype === MoveType.Walk))) {
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

/** Steps back from the closest monster for a moment, so a new plan does not start inside it. */
function backOffFromNearestMonster(host: LocalHost): void {
  const p = host.player!.origin;
  let nearest: Entity | undefined;
  let best = 128;
  host.map.game.entities.forEachEntity((e) => {
    if (!e.inUse || !e.solid || !e.classname?.startsWith('monster_')) return;
    const c = center(e);
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < best) {
      best = d;
      nearest = e;
    }
  });
  if (!nearest) return;
  const c = center(nearest);
  const away = Math.atan2(p.y - c.y, p.x - c.x);
  const yaw = (away * 180) / Math.PI;
  for (let i = 0; i < 8; i++) host.frame({ forwardmove: 200, angles: { x: 0, y: yaw, z: 0 } });
}

const BUTTON_ATTACK = 1;
const VIEWHEIGHT = 22;
const FIGHT_RANGE = 1000;

/** The nearest living monster that is after the player and in a clear line of fire. */
function hostileInSight(host: LocalHost): Entity | undefined {
  const player = host.player!;
  const eye = { ...player.origin, z: player.origin.z + VIEWHEIGHT };
  let best: Entity | undefined;
  let bestD = FIGHT_RANGE;
  host.map.game.entities.forEachEntity((e) => {
    if (!e.inUse || !e.classname?.startsWith('monster_') || e.health <= 0 || e.enemy !== player) return;
    const c = center(e);
    const d = Math.hypot(c.x - eye.x, c.y - eye.y, c.z - eye.z);
    if (d >= bestD) return;
    const tr = host.map.world.trace(eye, null, null, c, player, MASK_SHOT);
    if (tr.fraction < 1 && tr.ent !== e) return;
    best = e;
    bestD = d;
  });
  return best;
}

/**
 * Runs one frame moving toward a point, slowing for the last few units. The view faces the way
 * it walks, or the nearest hostile monster in sight, which it shoots while it walks.
 */
function stepToward(host: LocalHost, to: Vec3): number {
  const p = host.player!.origin;
  const dx = to.x - p.x;
  const dy = to.y - p.y;
  const d = Math.hypot(dx, dy);
  const moveYaw = Math.atan2(dy, dx);
  const speed = Math.min(400, d * 40);

  const target = hostileInSight(host);
  if (!target) {
    host.frame({ forwardmove: speed, angles: { x: 0, y: (moveYaw * 180) / Math.PI, z: 0 } });
    return d;
  }
  const c = center(target);
  const ex = c.x - p.x;
  const ey = c.y - p.y;
  const ez = c.z - (p.z + VIEWHEIGHT);
  const aimYaw = Math.atan2(ey, ex);
  const pitch = (-Math.atan2(ez, Math.hypot(ex, ey)) * 180) / Math.PI;
  // Walk the same way while facing the target: split the move into forward and side.
  const rel = moveYaw - aimYaw;
  host.frame({
    forwardmove: speed * Math.cos(rel),
    sidemove: -speed * Math.sin(rel),
    angles: { x: pitch, y: (aimYaw * 180) / Math.PI, z: 0 },
    buttons: BUTTON_ATTACK,
  });
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
  const plan = (keepMonsters: boolean) =>
    withPlanningWorld(
      host,
      (world) => {
        const raw = findRoute(world, host.player!.origin, (p) => overlaps(p, target, pad));
        return raw && simplifyRoute(world, raw);
      },
      keepMonsters,
    );

  let route = plan(false);
  if (!route) return result(false, 0, `no route from ${fmt(host.player!.origin)}`);

  // Blocked by a monster: plan round where the monsters stand now, a few times.
  let replans = 10;
  const blockedSeconds = 1.5;

  for (let i = 1; i < route.length; i++) {
    const w = route[i];
    let best = Infinity;
    let lastProgress = host.timeSeconds;
    let rerouted = false;
    for (;;) {
      const p = host.player!.origin;
      const d = Math.hypot(w.x - p.x, w.y - p.y);
      if (d < 8 && Math.abs(p.z - w.z) < 40) break;
      if (d < best - 1) {
        best = d;
        lastProgress = host.timeSeconds;
      }
      const stalled = host.timeSeconds - lastProgress;
      if (replans > 0 && stalled > blockedSeconds) {
        replans--;
        backOffFromNearestMonster(host);
        // Round the monsters if there is a way; if not (one stands in a doorway), the same way
        // again from here, as the monster may have moved on.
        const around = plan(true) ?? plan(false);
        if (around) {
          route = around;
          rerouted = true;
          break;
        }
      }
      if (stalled > stuckSeconds)
        return result(false, route.length, `stuck at ${fmt(p)} going to waypoint ${i} ${fmt(w)}, ${replans} replans left`);
      stepToward(host, w);
    }
    if (rerouted) i = 0;
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
