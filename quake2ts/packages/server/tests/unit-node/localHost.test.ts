/**
 * The first end-to-end slice: `map demo1` in one process, then a player standing and
 * walking in it. Uses the demo1 map in the committed quake2ts/pak.pak.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { PakArchive } from '@quake2ts/engine';
import { MASK_PLAYERSOLID, CONTENTS_SOLID, MZ_BLASTER, TempEntity, angleVectors, type Vec3 } from '@quake2ts/shared';
import { Solid } from '@quake2ts/game';
import { LocalHost } from '../../src/localHost.js';

const buf = readFileSync(resolve(__dirname, '../../../../pak.pak'));
const pak = PakArchive.fromArrayBuffer('pak.pak', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const readFile = (path: string) => (pak.getEntry(path) ? pak.readFile(path) : undefined);

describe('LocalHost: map demo1', () => {
  let host: LocalHost;
  const warnings: string[] = [];

  beforeEach(() => {
    warnings.length = 0;
    host = new LocalHost({ readFile, onWarning: (m) => warnings.push(m) });
    host.command('map demo1');
  });

  it('spawns the entity lump, with brush entities sized from their submodels', () => {
    const { game, spawned, world } = host.map;
    expect(spawned).toBeGreaterThan(50);
    const doors = game.entities.findByClassname('func_door');
    expect(doors.length).toBeGreaterThan(0);
    for (const door of doors) {
      expect(door.solid).toBe(Solid.Bsp);
      expect(door.modelindex).toBeGreaterThan(1);
      expect(door.maxs.x - door.mins.x).toBeGreaterThan(0);
      expect(world.isLinked(door)).toBe(true);
    }
  });

  it('puts the player at info_player_start', () => {
    const start = host.map.game.entities.findByClassname('info_player_start')[0];
    const player = host.player!;
    expect(player).toBeDefined();
    expect(player.index).toBe(1);
    expect(host.map.game.entities.findByClassname('player')).toHaveLength(1);
    expect(player.origin.x).toBeCloseTo(start.origin.x, 0);
    expect(player.origin.y).toBeCloseTo(start.origin.y, 0);
  });

  it('the player comes to rest on the floor and stays out of solid', () => {
    host.run(1, {});
    const player = host.player!;
    const { world } = host.map;
    const z = player.origin.z;
    host.run(0.25, {});
    expect(player.origin.z).toBeCloseTo(z, 1);
    const below = world.trace(player.origin, player.mins, player.maxs, { ...player.origin, z: player.origin.z - 2 }, player, MASK_PLAYERSOLID);
    expect(below.startsolid).toBe(false);
    expect(below.fraction).toBeLessThan(1); // standing on something
  });

  it('walking accelerates to 300 units a second, and walls stop it', () => {
    host.run(0.5, {});
    const player = host.player!;
    const { world } = host.map;
    // From the start spot, north (yaw 90) is open floor for over 250 units; east hits a wall after about 70.
    const north = { ...player.origin };
    for (let i = 0; i < 40; i++) {
      host.frame({ forwardmove: 400, angles: { x: 0, y: 90, z: 0 } });
      expect(world.pointContents(player.origin) & CONTENTS_SOLID).toBe(0);
    }
    expect(Math.hypot(player.velocity.x, player.velocity.y)).toBeCloseTo(300, 0);
    expect(player.origin.y - north.y).toBeGreaterThan(250);

    const east = { ...player.origin };
    for (let i = 0; i < 40; i++) host.frame({ forwardmove: 400, angles: { x: 0, y: 0, z: 0 } });
    const reached = player.origin.x;
    host.run(0.5, { forwardmove: 400, angles: { x: 0, y: 0, z: 0 } });
    expect(player.origin.x).toBeCloseTo(reached, 1); // pressed against the wall
    expect(player.origin.x - east.x).toBeLessThan(250);
    expect(player.origin.z).toBeCloseTo(east.z, 1); // still on the floor
  });

  it("hands a client the blaster's muzzle flash and the bolt's impact, once each", () => {
    host.run(1, {});
    host.takeEffects();
    host.run(0.1, { buttons: 1 });
    host.run(2, {});
    const effects = host.takeEffects();
    const flash = effects.find((e) => e.kind === 'muzzleflash');
    expect(flash).toEqual({ kind: 'muzzleflash', entity: 1, weapon: MZ_BLASTER });
    const impact = effects.find((e) => e.kind === 'tempEntity');
    expect(impact).toMatchObject({ kind: 'tempEntity', type: TempEntity.BLASTER });
    if (impact?.kind === 'tempEntity') {
      // The bolt stops on a wall; a unit out along the wall's normal is open space.
      const { pos, dir } = impact;
      const outside = { x: pos.x + dir!.x, y: pos.y + dir!.y, z: pos.z + dir!.z };
      expect(host.map.world.pointContents(outside) & CONTENTS_SOLID).toBe(0);
    }
    expect(host.takeEffects()).toEqual([]);
  });

  it('every monster has the model it is drawn with (the renderer skips modelindex 0)', () => {
    const monsters: { classname?: string; modelindex: number }[] = [];
    host.map.game.entities.forEachEntity((e) => {
      if (e.classname?.startsWith('monster_')) monsters.push(e);
    });
    expect(monsters.length).toBeGreaterThan(10);
    for (const monster of monsters) {
      expect(monster.modelindex, monster.classname).toBeGreaterThan(0);
      expect(host.modelName(monster.modelindex), monster.classname).toMatch(/^models\/monsters\/.+\.md2$/);
    }
  });

  // Fires one blaster shot with the view pitched `pitch` degrees (down is positive) and returns
  // the bolt as it leaves, and where it hit.
  const shoot = (pitch: number) => {
    host.run(1, {});
    host.takeEffects();
    const player = host.player!;
    const angles = { x: pitch, y: player.angles.y, z: 0 };
    let bolt: { velocity: Vec3; modelindex: number; effects: number; angles: Vec3 } | undefined;
    for (let i = 0; i < 80 && !bolt; i++) {
      host.frame({ angles, buttons: 1 });
      host.map.game.entities.forEachEntity((e) => {
        if (e.classname === 'blaster_bolt' && e.owner === player) bolt = { velocity: { ...e.velocity }, modelindex: e.modelindex, effects: e.effects, angles: { ...e.angles } };
      });
    }
    host.run(1, { angles });
    const impact = host.takeEffects().find((e) => e.kind === 'tempEntity');
    const eye = { x: player.origin.x, y: player.origin.y, z: player.origin.z + player.viewheight };
    return { bolt: bolt!, impact: impact?.kind === 'tempEntity' ? impact.pos : undefined, eye, forward: angleVectors(angles).forward };
  };

  it.each([
    ['down', 40],
    ['up', -40],
  ])('a shot looking %s flies where the crosshair is, and its impact is on the view line', (_, pitch) => {
    const { bolt, impact, eye, forward } = shoot(pitch);
    expect(bolt).toBeDefined();
    const speed = Math.hypot(bolt.velocity.x, bolt.velocity.y, bolt.velocity.z);
    const dir = { x: bolt.velocity.x / speed, y: bolt.velocity.y / speed, z: bolt.velocity.z / speed };
    // Pitched as the view is: down is -z, up is +z. Not exactly along the view: it leaves the gun,
    // below and right of the eye, and turns in to meet the crosshair (by more for a near floor).
    expect(Math.sign(dir.z)).toBe(pitch > 0 ? -1 : 1);
    expect(dir.x * forward.x + dir.y * forward.y + dir.z * forward.z).toBeGreaterThan(Math.cos((20 * Math.PI) / 180));
    // The impact is where the crosshair was: within a few units of the line out of the eye.
    expect(impact).toBeDefined();
    const to = { x: impact!.x - eye.x, y: impact!.y - eye.y, z: impact!.z - eye.z };
    const along = to.x * forward.x + to.y * forward.y + to.z * forward.z;
    const off = Math.hypot(to.x - forward.x * along, to.y - forward.y * along, to.z - forward.z * along);
    expect(along).toBeGreaterThan(0);
    expect(off).toBeLessThan(4);
  });

  it('a blaster bolt is the laser model turned along its flight, and glows', () => {
    const { bolt } = shoot(20);
    expect(host.modelName(bolt.modelindex)).toBe('models/objects/laser/tris.md2');
    expect(bolt.effects & (1 << 3)).not.toBe(0); // EF_BLASTER
    const speed = Math.hypot(bolt.velocity.x, bolt.velocity.y, bolt.velocity.z);
    const nose = angleVectors(bolt.angles).forward;
    expect(nose.x).toBeCloseTo(bolt.velocity.x / speed, 3);
    expect(nose.y).toBeCloseTo(bolt.velocity.y / speed, 3);
    expect(nose.z).toBeCloseTo(bolt.velocity.z / speed, 3);
  });
});
