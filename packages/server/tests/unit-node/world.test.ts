import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PakArchive, parseBsp, collisionModelFromBsp } from '@quake2ts/engine';
import { CONTENTS_MONSTER, MASK_PLAYERSOLID, MASK_SHOT, traceBox, type CollisionModel, type Vec3 } from '@quake2ts/shared';
import { parseEntityLump, ServerFlags, Solid } from '@quake2ts/game';
import { AreaType, World, type WorldEntity } from '../../src/world.js';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const PLAYER_MINS = v(-16, -16, -24);
const PLAYER_MAXS = v(16, 16, 32);

let nextIndex = 1;
function makeEntity(fields: Partial<WorldEntity>): WorldEntity {
  return {
    index: nextIndex++,
    inUse: true,
    solid: Solid.BoundingBox,
    svflags: 0,
    origin: v(0, 0, 0),
    angles: v(0, 0, 0),
    mins: v(-16, -16, -24),
    maxs: v(16, 16, 32),
    absmin: v(0, 0, 0),
    absmax: v(0, 0, 0),
    size: v(0, 0, 0),
    modelindex: 0,
    linkcount: 0,
    owner: null,
    ...fields,
  };
}

describe('World (sv_world.c) on demo1', () => {
  let model: CollisionModel;
  let start: Vec3; // info_player_start: open space with floor below
  let doorModel: number; // a func_door's "*N"
  let makeWorld: () => World<WorldEntity>;

  beforeAll(() => {
    const buf = readFileSync(resolve(__dirname, '../../../../pak.pak'));
    const pak = PakArchive.fromArrayBuffer('pak.pak', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const bytes = pak.readFile('maps/demo1.bsp');
    const bsp = parseBsp(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    model = collisionModelFromBsp(bsp);
    const ents = parseEntityLump(bsp.entities.raw);
    const [x, y, z] = ents.find((e) => e.classname === 'info_player_start')!.origin.split(' ').map(Number);
    start = v(x, y, z);
    doorModel = Number(ents.find((e) => e.classname === 'func_door')!.model.slice(1));
    makeWorld = () => {
      // modelindex here is the submodel number itself; a real host maps configstring indexes.
      const world = new World<WorldEntity>({ model, submodelHeadnode: (i) => model.bmodels[i]?.headnode });
      world.setWorldEntity(makeEntity({ solid: Solid.Bsp, index: 0 }));
      return world;
    };
  });

  it('with no entities, traces match the world BSP and report the world', () => {
    const world = makeWorld();
    const end = v(start.x, start.y, start.z - 512);
    const t = world.trace(start, PLAYER_MINS, PLAYER_MAXS, end, null, MASK_PLAYERSOLID);
    const bare = traceBox({ model, start, end, mins: PLAYER_MINS, maxs: PLAYER_MAXS, contentMask: MASK_PLAYERSOLID });
    expect(t.fraction).toBeLessThan(1); // there is a floor
    expect(t.fraction).toBe(bare.fraction);
    expect(t.ent.index).toBe(0);
  });

  it('a monster box blocks a shot, unless it is the shooter, its owner or its missile', () => {
    const world = makeWorld();
    const monster = makeEntity({ origin: v(start.x + 64, start.y, start.z), svflags: ServerFlags.Monster });
    world.link(monster);
    const from = v(start.x, start.y, start.z);
    const to = v(start.x + 128, start.y, start.z);

    const hit = world.trace(from, null, null, to, null, MASK_SHOT);
    expect(hit.ent).toBe(monster);
    expect(hit.endpos.x).toBeCloseTo(start.x + 64 - 16, 1);
    expect(hit.contents).toBe(CONTENTS_MONSTER);

    expect(world.trace(from, null, null, to, monster, MASK_SHOT).ent).not.toBe(monster);
    const rocket = makeEntity({ owner: monster });
    expect(world.trace(from, null, null, to, rocket, MASK_SHOT).ent).not.toBe(monster);
    monster.owner = rocket;
    expect(world.trace(from, null, null, to, rocket, MASK_SHOT).ent).not.toBe(monster);
  });

  it('a dead monster only blocks masks that include dead monsters', () => {
    const world = makeWorld();
    const corpse = makeEntity({ origin: v(start.x + 64, start.y, start.z), svflags: ServerFlags.DeadMonster });
    world.link(corpse);
    const t = world.trace(start, null, null, v(start.x + 128, start.y, start.z), null, MASK_PLAYERSOLID);
    expect(t.ent).not.toBe(corpse);
  });

  it('unlinked and freed entities no longer collide', () => {
    const world = makeWorld();
    const box = makeEntity({ origin: v(start.x + 64, start.y, start.z) });
    world.link(box);
    world.unlink(box);
    expect(world.isLinked(box)).toBe(false);
    expect(world.trace(start, null, null, v(start.x + 128, start.y, start.z), null, MASK_SHOT).ent).not.toBe(box);
  });

  it('triggers never block, and are listed apart from solids', () => {
    const world = makeWorld();
    const trigger = makeEntity({ solid: Solid.Trigger, origin: v(start.x + 64, start.y, start.z) });
    world.link(trigger);
    expect(world.trace(start, null, null, v(start.x + 128, start.y, start.z), null, MASK_SHOT).ent).not.toBe(trigger);
    expect(world.areaEdicts(trigger.absmin, trigger.absmax, AreaType.Triggers)).toEqual([trigger]);
    expect(world.areaEdicts(trigger.absmin, trigger.absmax, AreaType.Solid)).toEqual([]);
  });

  it('link sets the absolute box one unit larger than the entity', () => {
    const world = makeWorld();
    const box = makeEntity({ origin: start });
    world.link(box);
    expect(box.absmin).toEqual(v(start.x - 16 - 1, start.y - 16 - 1, start.z - 24 - 1));
    expect(box.absmax).toEqual(v(start.x + 16 + 1, start.y + 16 + 1, start.z + 32 + 1));
    expect(box.size).toEqual(v(32, 32, 56));
    expect(box.linkcount).toBe(1);
    expect(world.linkInfo(box)!.clusters.length).toBeGreaterThan(0);
  });

  it('a door is traced through its own submodel and moves with its origin', () => {
    const world = makeWorld();
    const sub = model.bmodels[doorModel];
    const door = makeEntity({ solid: Solid.Bsp, modelindex: doorModel, mins: sub.mins, maxs: sub.maxs });
    world.link(door);
    const centre = v((sub.mins.x + sub.maxs.x) / 2, (sub.mins.y + sub.maxs.y) / 2, (sub.mins.z + sub.maxs.z) / 2);
    expect(world.pointContents(centre) & 1).toBe(1); // CONTENTS_SOLID from the door

    // Shoot across the door's thin side, through the doorway it closes.
    const thinX = sub.maxs.x - sub.mins.x < sub.maxs.y - sub.mins.y;
    const reach = (thinX ? sub.maxs.x - sub.mins.x : sub.maxs.y - sub.mins.y) / 2 + 32;
    const from = thinX ? v(centre.x - reach, centre.y, centre.z) : v(centre.x, centre.y - reach, centre.z);
    const to = thinX ? v(centre.x + reach, centre.y, centre.z) : v(centre.x, centre.y + reach, centre.z);
    const across = world.trace(from, null, null, to, null, MASK_SHOT);
    expect(across.ent).toBe(door);
    expect(thinX ? across.endpos.x : across.endpos.y).toBeCloseTo(thinX ? sub.mins.x : sub.mins.y, 0);

    // Raise the door far out of the way: the same trace now misses it.
    door.origin = v(0, 0, 4096);
    world.link(door);
    expect(world.trace(from, null, null, to, null, MASK_SHOT).ent).not.toBe(door);
  });

  it('point contents ors in monster boxes', () => {
    const world = makeWorld();
    const monster = makeEntity({ origin: start, svflags: ServerFlags.Monster });
    expect(world.pointContents(start) & CONTENTS_MONSTER).toBe(0);
    world.link(monster);
    expect(world.pointContents(start) & CONTENTS_MONSTER).toBe(CONTENTS_MONSTER);
  });
});
