/**
 * func_door and func_button against the rerelease g_func.cpp, run through the real entity
 * frame loop (G_RunFrame), so thinks, pusher physics and teams all take part.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Vec3 } from '@quake2ts/shared';
import { createDefaultSpawnRegistry, spawnEntitiesFromText } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { MoveType, Solid, type Entity } from '../../../src/entities/entity.js';
import { STATE_BOTTOM, STATE_DOWN, STATE_TOP, STATE_UP, calcAcceleratedMove, accelerate } from '../../../src/entities/movers.js';
import { DamageMod } from '../../../src/combat/damageMods.js';

const FRAME = 0.025;

interface World {
  entities: EntitySystem;
  spawned: Entity[];
  run(seconds: number): void;
  sound: ReturnType<typeof vi.fn>;
}

/** A level with nothing but the given entities; traces hit only what `blocking` says. */
function level(lump: string, blocking?: (passent: Entity | null) => boolean): World {
  const sound = vi.fn();
  const engine = { sound, centerprintf: vi.fn() } as any;
  const trace = (start: Vec3, _mins: Vec3 | null, _maxs: Vec3 | null, end: Vec3, passent: Entity | null) => {
    const solid = blocking?.(passent) ?? false;
    return {
      allsolid: solid,
      startsolid: solid,
      fraction: solid ? 0 : 1,
      endpos: solid ? start : end,
      plane: null,
      surfaceFlags: 0,
      contents: 0,
      ent: null,
    };
  };
  const entities = new EntitySystem(engine, { trace } as any, { x: 0, y: 0, z: -800 }, 2048);
  const registry = createDefaultSpawnRegistry(null);
  const spawned = spawnEntitiesFromText(lump, { registry, entities });
  let time = 0;
  return {
    entities,
    spawned,
    sound,
    run(seconds) {
      const frames = Math.round(seconds / FRAME);
      for (let i = 0; i < frames; i++) {
        time += FRAME;
        entities.beginFrame(time);
        entities.runFrame();
      }
    },
  };
}

const door = (extra = '') => `{
  "classname" "func_door"
  "angle" "90"
  "mins" "-20 -20 0"
  "maxs" "20 20 80"
  ${extra}
}`;

/** A player-like entity that triggers doors. */
function visitor(entities: EntitySystem, origin: Vec3): Entity {
  const p = entities.spawn();
  p.classname = 'player';
  p.client = {} as any;
  p.health = 100;
  p.origin = origin;
  p.mins = { x: -16, y: -16, z: -24 };
  p.maxs = { x: 16, y: 16, z: 32 };
  p.movetype = MoveType.None;
  entities.linkentity(p);
  return p;
}

describe('func_door', () => {
  it('takes the original defaults and moves its size less the 8-unit lip', () => {
    const { spawned } = level(door());
    const d = spawned[0];
    expect(d.speed).toBe(100);
    expect(d.wait).toBe(3);
    expect(d.dmg).toBe(2);
    expect(d.solid).toBe(Solid.Bsp);
    expect(d.movetype).toBe(MoveType.Push);
    expect(d.angles).toEqual({ x: 0, y: 0, z: 0 }); // G_SetMovedir clears them
    expect(d.moveinfo!.distance).toBeCloseTo(40 - 8);
    expect(d.pos2.y).toBeCloseTo(32);
    expect(d.moveinfo!.state).toBe(STATE_BOTTOM);
  });

  it('spawns a trigger 60 units wider than the door on its first frame, and opens when a player walks in', () => {
    const w = level(door());
    const d = w.spawned[0];
    expect(d.touch).toBeUndefined(); // the door itself is not the trigger
    w.run(FRAME);
    const trigger = w.entities.findByClassname('door_trigger')[0];
    expect(trigger).toBeDefined();
    expect(trigger.owner).toBe(d);
    expect(trigger.solid).toBe(Solid.Trigger);
    expect(trigger.mins.x).toBe(d.absmin.x - 60);
    expect(trigger.maxs.y).toBe(d.absmax.y + 60);

    const p = visitor(w.entities, { x: 0, y: -50, z: 24 });
    w.entities.touchTriggers(p);
    expect(d.moveinfo!.state).toBe(STATE_UP);

    // 32 units at 100 u/s
    w.run(0.4);
    expect(d.moveinfo!.state).toBe(STATE_TOP);
    expect(d.origin.y).toBeCloseTo(32, 3);
    expect(d.velocity).toEqual({ x: 0, y: 0, z: 0 });

    // waits 3 s, then closes
    w.run(3);
    expect(d.moveinfo!.state).toBe(STATE_DOWN);
    w.run(0.5);
    expect(d.moveinfo!.state).toBe(STATE_BOTTOM);
    expect(d.origin.y).toBeCloseTo(0, 3);
  });

  it('a trigger touch is ignored for a second after one that opened it', () => {
    const w = level(door('"wait" "-1"'));
    w.run(FRAME);
    const trigger = w.entities.findByClassname('door_trigger')[0];
    const p = visitor(w.entities, { x: 0, y: -50, z: 24 });
    trigger.touch!(trigger, p);
    expect(trigger.touch_debounce_time).toBeCloseTo(w.entities.timeSeconds + 1);
  });

  it('with a targetname, spawns no trigger and opens when used', () => {
    const w = level(door('"targetname" "d1"'));
    w.run(0.1);
    expect(w.entities.findByClassname('door_trigger')).toHaveLength(0);
    const d = w.spawned[0];
    d.use!(d, null, null);
    w.run(0.5);
    expect(d.origin.y).toBeCloseTo(32, 3);
  });

  it('with health, must be shot open', () => {
    const w = level(door('"health" "5"'));
    const d = w.spawned[0];
    expect(d.takedamage).toBe(true);
    expect(d.max_health).toBe(5);
    w.run(FRAME);
    expect(w.entities.findByClassname('door_trigger')).toHaveLength(0);
    d.die!(d, null, null, 5, { x: 0, y: 0, z: 0 }, DamageMod.UNKNOWN);
    expect(d.moveinfo!.state).toBe(STATE_UP);
    expect(d.takedamage).toBe(false);
  });

  it('TOGGLE stays open until used again', () => {
    const w = level(door('"targetname" "d1" "spawnflags" "32"'));
    const d = w.spawned[0];
    d.use!(d, null, null);
    w.run(5);
    expect(d.moveinfo!.state).toBe(STATE_TOP);
    d.use!(d, null, null);
    w.run(0.5);
    expect(d.moveinfo!.state).toBe(STATE_BOTTOM);
  });

  it('doors on one team open together and finish together', () => {
    const w = level(`{
      "classname" "func_door" "team" "pair" "angle" "90" "targetname" "d" "mins" "-20 -20 0" "maxs" "20 20 80"
    }
    {
      "classname" "func_door" "team" "pair" "angle" "270" "mins" "-20 -40 0" "maxs" "20 40 80"
    }`);
    const [a, b] = w.spawned;
    expect(a.teammaster).toBe(a);
    expect(a.teamchain).toBe(b);
    expect(b.teammaster).toBe(a);
    w.run(FRAME); // Think_CalcMoveSpeed evens out the speeds
    expect(b.moveinfo!.speed! / a.moveinfo!.speed!).toBeCloseTo(b.moveinfo!.distance! / a.moveinfo!.distance!);

    a.use!(a, null, null);
    expect(b.moveinfo!.state).toBe(STATE_UP);
    // b is a team slave: using it directly does nothing
    w.run(0.4);
    expect(a.moveinfo!.state).toBe(STATE_TOP);
    expect(b.moveinfo!.state).toBe(STATE_TOP);
    expect(a.origin.y).toBeCloseTo(32, 3);
    expect(b.origin.y).toBeCloseTo(-72, 3);
  });

  it('when blocked, hurts what blocks it and goes back the other way', () => {
    let blocker: Entity | null = null;
    const w = level(door('"targetname" "d1" "dmg" "5"'), (passent) => passent === blocker);
    const d = w.spawned[0];
    blocker = visitor(w.entities, { x: 0, y: 30, z: 24 });
    blocker.takedamage = true;
    blocker.svflags |= 1 << 2; // a monster, so it is crushed rather than removed
    blocker.movetype = MoveType.Step; // pushers ignore MOVETYPE_NONE
    blocker.client = undefined as any;
    d.use!(d, null, null);
    w.run(0.1);
    expect(blocker.health).toBeLessThan(100);
    // It turned back: closing, or already closed again.
    expect([STATE_DOWN, STATE_BOTTOM]).toContain(d.moveinfo!.state);
    expect(d.origin.y).toBeLessThan(1);
  });
});

describe('Move_Calc acceleration (plat_CalcAcceleratedMove, plat_Accelerate)', () => {
  it('a mover with accel and decel speeds up, slows down and stops exactly at its end', () => {
    // The accelerating move works in distance per 1/10 s, as func_plat's speeds are
    // (it scales them by 0.1): speed 10 is 100 u/s.
    const w = level(door('"targetname" "d1" "angle" "-1" "speed" "10" "accel" "2" "decel" "2" "mins" "-20 -20 0" "maxs" "20 20 140"'));
    const d = w.spawned[0];
    d.use!(d, null, null);
    const speeds: number[] = [];
    for (let i = 0; i < 200 && d.moveinfo!.state !== STATE_TOP; i++) {
      w.run(FRAME);
      speeds.push(d.velocity.z);
    }
    expect(d.moveinfo!.state).toBe(STATE_TOP);
    expect(d.origin.z).toBeCloseTo(132, 3);
    const peak = Math.max(...speeds);
    expect(peak).toBeLessThanOrEqual(100 + 1e-6);
    expect(speeds[1]).toBeLessThan(peak); // starts slow
    expect(speeds[speeds.length - 3]).toBeLessThan(peak); // ends slow
  });

  it('a move too short to reach full speed peaks below it', () => {
    const mi = { speed: 100, accel: 10, decel: 10, remaining_distance: 50, current_speed: 0 };
    calcAcceleratedMove(mi);
    expect(mi.current_speed).toBeLessThan(100);
    accelerate(mi);
    expect(mi.current_speed).toBeGreaterThan(0);
  });
});

describe('func_button', () => {
  const button = (extra = '') => `{
    "classname" "func_button"
    "angle" "90"
    "target" "t_btn"
    "mins" "-4 -4 0"
    "maxs" "4 4 8"
    ${extra}
  }`;

  it('moves in, fires its targets when fully in, and comes back after wait', () => {
    const w = level(button('"wait" "1"'));
    const b = w.spawned[0];
    expect(b.movetype).toBe(MoveType.Stop);
    expect(b.speed).toBe(40);
    let fired = 0;
    const target = w.entities.spawn();
    target.targetname = 't_btn';
    target.use = () => fired++;
    w.entities.finalizeSpawn(target);

    b.use!(b, null, null);
    expect(b.moveinfo!.state).toBe(STATE_UP);
    expect(fired).toBe(0);
    w.run(0.2); // 8 - 4 lip = 4 units at 40 u/s
    expect(b.moveinfo!.state).toBe(STATE_TOP);
    expect(fired).toBe(1);
    w.run(1.2);
    expect(b.moveinfo!.state).toBe(STATE_BOTTOM);
    expect(b.origin.y).toBeCloseTo(0, 3);
  });

  it('is pressed by a living client touching it, and not by anything else', () => {
    const w = level(button());
    const b = w.spawned[0];
    const crate = w.entities.spawn();
    b.touch!(b, crate);
    expect(b.moveinfo!.state).toBe(STATE_BOTTOM);
    const p = visitor(w.entities, { x: 0, y: -30, z: 24 });
    b.touch!(b, p);
    expect(b.moveinfo!.state).toBe(STATE_UP);
    expect(b.activator).toBe(p);
  });
});

describe('pusher physics', () => {
  it('calls entity.blocked on movers that have no moveinfo.blocked', () => {
    let blocker: Entity | null = null;
    const w = level(door('"targetname" "d1"'), (passent) => passent === blocker);
    const d = w.spawned[0];
    d.moveinfo!.blocked = null;
    const blocked = vi.fn();
    d.blocked = blocked;
    blocker = visitor(w.entities, { x: 0, y: 30, z: 24 });
    blocker.movetype = MoveType.Step;
    blocker.client = undefined as any;
    d.use!(d, null, null);
    w.run(0.1);
    expect(blocked).toHaveBeenCalled();
    expect(blocked.mock.calls[0][1]).toBe(blocker);
  });
});
