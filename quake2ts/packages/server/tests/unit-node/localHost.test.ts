/**
 * The first end-to-end slice: `map demo1` in one process, then a player standing and
 * walking in it. Uses the demo1 map in the committed quake2ts/pak.pak.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { PakArchive } from '@quake2ts/engine';
import { MASK_PLAYERSOLID, CONTENTS_SOLID } from '@quake2ts/shared';
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
});
