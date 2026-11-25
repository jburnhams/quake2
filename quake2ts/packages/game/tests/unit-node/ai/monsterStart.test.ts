/**
 * monster_start and SV_Physics_Step against the rerelease g_monster.cpp and g_phys.cpp, run
 * through the real entity frame loop over a flat floor at z = 0.
 */
import { describe, expect, it, vi } from 'vitest';
import { MASK_MONSTERSOLID, type Vec3 } from '@quake2ts/shared';
import { createDefaultSpawnRegistry, spawnEntitiesFromText } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { EntityFlags, MoveType, ServerFlags, Solid, type Entity } from '../../../src/entities/entity.js';
import { M_CheckGround, M_WorldEffects } from '../../../src/ai/monsterStart.js';
import { physicsStep } from '../../../src/physics/step.js';

const FRAME = 0.025;

/** A world that is solid below z = 0 and empty above. */
function floorWorld(lump: string) {
  let entities!: EntitySystem;
  const trace = (start: Vec3, mins: Vec3 | null, _maxs: Vec3 | null, end: Vec3) => {
    const bottom = mins?.z ?? 0;
    const s = start.z + bottom;
    const e = end.z + bottom;
    const hit = (fraction: number) => ({
      allsolid: false,
      startsolid: false,
      fraction,
      endpos: {
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
        z: start.z + (end.z - start.z) * fraction,
      },
      plane: fraction < 1 ? { normal: { x: 0, y: 0, z: 1 }, dist: 0, type: 2, signbits: 0 } : null,
      surfaceFlags: 0,
      contents: fraction < 1 ? 1 : 0,
      ent: fraction < 1 ? entities.world : null,
    });
    if (s < 0) return { ...hit(0), startsolid: true, allsolid: e < 0 };
    if (e >= 0) return hit(1);
    return hit(s / (s - e));
  };
  const engine = { sound: vi.fn(), centerprintf: vi.fn(), modelIndex: () => 1 } as any;
  entities = new EntitySystem(engine, { trace, pointcontents: () => 0 } as any, { x: 0, y: 0, z: -800 }, 1024);
  const spawned = spawnEntitiesFromText(lump, { registry: createDefaultSpawnRegistry(engine), entities });
  let time = 0;
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / FRAME); i++) {
      time += FRAME;
      entities.beginFrame(time);
      entities.runFrame();
    }
  };
  return { entities, spawned, run };
}

describe('monster_start', () => {
  it('marks a monster as one, with the monster clip mask, and drops it to the floor a frame later', () => {
    const { spawned, run } = floorWorld('{ "classname" "monster_soldier" "origin" "0 0 100" }');
    const m = spawned[0];
    expect(m.svflags & ServerFlags.Monster).toBeTruthy();
    expect(m.clipmask).toBe(MASK_MONSTERSOLID);
    expect(m.takedamage).toBe(true);
    expect(m.origin.z).toBe(100);

    run(FRAME); // walkmonster_start_go: M_droptofloor
    expect(m.origin.z).toBeCloseTo(-m.mins.z, 3);
    expect(m.groundentity).not.toBeNull();
    expect(m.yaw_speed).toBe(20);

    // And stays there, thinking.
    run(2);
    expect(m.origin.z).toBeCloseTo(-m.mins.z, 3);
    expect(m.velocity.z).toBe(0);
    expect(m.nextthink).toBeGreaterThan(0);
  });

  it('a trigger-spawned monster stays hidden and out of the world until used', () => {
    const { spawned, run } = floorWorld('{ "classname" "monster_soldier" "origin" "0 0 100" "spawnflags" "2" "targetname" "s1" }');
    const m = spawned[0];
    run(0.1);
    expect(m.solid).toBe(Solid.Not);
    expect(m.movetype).toBe(MoveType.None);
    expect(m.svflags & ServerFlags.NoClient).toBeTruthy();
    m.use!(m, null, null);
    run(0.1);
    expect(m.solid).toBe(Solid.BoundingBox);
    expect(m.movetype).toBe(MoveType.Step);
    expect(m.origin.z).toBeCloseTo(-m.mins.z, 3);
  });

  it('a monster spawned dead plays its death move through and rests as a corpse', () => {
    const { spawned, run } = floorWorld('{ "classname" "monster_soldier" "origin" "0 0 100" "spawnflags" "65536" }');
    const m = spawned[0];
    run(FRAME);
    expect(m.health).toBeLessThanOrEqual(0);
    const move = m.monsterinfo.current_move!;
    expect(m.frame).toBe(move.lastframe);
    expect(m.monsterinfo.aiflags & (1 << 26)).toBe(0); // never AI_SPAWNED_ALIVE
  });

  it('flying monsters are not dropped and get FL_FLY', () => {
    const { spawned, run } = floorWorld('{ "classname" "monster_flyer" "origin" "0 0 200" }');
    const m = spawned[0];
    expect(m.flags & EntityFlags.Fly).toBeTruthy();
    run(0.5);
    expect(m.origin.z).toBeGreaterThan(150);
  });
});

describe('SV_Physics_Step', () => {
  function body(entities: EntitySystem, origin: Vec3): Entity {
    const e = entities.spawn();
    e.classname = 'crate';
    e.movetype = MoveType.Step;
    e.solid = Solid.BoundingBox;
    e.mins = { x: -16, y: -16, z: -24 };
    e.maxs = { x: 16, y: 16, z: 32 };
    e.origin = origin;
    entities.linkentity(e);
    return e;
  }

  it('an entity in the air falls under gravity and lands on the floor', () => {
    const { entities, run } = floorWorld('');
    const e = body(entities, { x: 0, y: 0, z: 200 });
    run(0.1);
    expect(e.origin.z).toBeLessThan(200);
    expect(e.velocity.z).toBeLessThan(0);
    run(2);
    expect(e.origin.z).toBeCloseTo(24, 3);
    expect(e.groundentity).toBe(entities.world);
    expect(e.velocity.z).toBe(0);
  });

  it('friction stops a sliding entity on the ground', () => {
    const { entities, run } = floorWorld('');
    const e = body(entities, { x: 0, y: 0, z: 24 });
    M_CheckGround(e, MASK_MONSTERSOLID, entities);
    e.velocity = { x: 300, y: 0, z: 0 };
    run(0.1);
    expect(e.velocity.x).toBeGreaterThan(0);
    expect(e.velocity.x).toBeLessThan(300);
    run(2);
    expect(e.velocity.x).toBe(0);
    expect(e.origin.z).toBeCloseTo(24, 3);
  });

  it('a land monster under water runs out of air and drowns; it does not become a swimmer', () => {
    const { entities } = floorWorld('');
    const e = body(entities, { x: 0, y: 0, z: 24 });
    e.svflags |= ServerFlags.Monster;
    e.health = 100;
    e.takedamage = true;
    entities.beginFrame(1);
    e.waterlevel = 3;
    e.watertype = 32; // CONTENTS_WATER
    e.air_finished = 0.5;
    M_WorldEffects(e, entities);
    expect(e.flags & EntityFlags.Swim).toBe(0);
    expect(e.health).toBeLessThan(100);
  });

  it('a monster whose ground moves checks it again and falls if it is gone', () => {
    const { entities, run } = floorWorld('');
    const e = body(entities, { x: 0, y: 0, z: 200 });
    e.svflags |= ServerFlags.Monster;
    const lift = entities.spawn();
    lift.classname = 'func_plat';
    e.groundentity = lift;
    e.groundentity_linkcount = lift.linkcount;
    run(0.5);
    expect(e.origin.z).toBe(200); // still on the lift
    lift.linkcount++; // the lift moved away
    run(2);
    expect(e.origin.z).toBeCloseTo(24, 3);
    expect(e.groundentity).toBe(entities.world);
  });

  it('runs the think after moving', () => {
    const { entities } = floorWorld('');
    const e = body(entities, { x: 0, y: 0, z: 24 });
    const think = vi.fn();
    e.think = think;
    e.nextthink = 0.01;
    entities.beginFrame(FRAME);
    physicsStep(e, entities, 800);
    expect(think).toHaveBeenCalledTimes(1);
  });
});
