/**
 * The demo1 walkthrough gate, run in Node: LocalHost loads demo1 from the committed
 * pak.pak and the walker plays it objective by objective, steering the player a
 * frame at a time through real pmove, doors, buttons and lifts. It passes when the exit
 * trigger asks the server to change level to demo2.
 *
 * No god mode: the soldiers on the way notice the player and come for him, and the walker
 * shoots back with the blaster (Think_Weapon from ClientThink) as it walks, as a player would.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PakArchive } from '@quake2ts/engine';
import { LocalHost } from '@quake2ts/server';
import { walkObjective, type Objective } from './helpers/walker.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pakPath = path.resolve(here, '..', '..', 'pak.pak');

const byTarget = (t: string) => (h: LocalHost) => h.map.game.entities.find((e) => e.inUse && e.target === t);
const byName = (t: string) => (h: LocalHost) => h.map.game.entities.find((e) => e.inUse && e.targetname === t);

/** demo1, start to exit: the button that calls the lift, then the lift down to the exit. */
const objectives: Objective[] = [
  { name: 'press the lift button', find: byTarget('t4'), press: true },
  {
    name: 'ride the lift down to the exit',
    find: byTarget('t37'),
    waitFor: (h) => byName('t4')(h)?.moveinfo?.state === 0,
    waitSeconds: 15,
  },
];

function loadDemo1(): LocalHost {
  const buf = readFileSync(pakPath);
  const pak = PakArchive.fromArrayBuffer('pak.pak', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const host = new LocalHost({ readFile: (p) => (pak.getEntry(p) ? pak.readFile(p) : undefined) });
  host.command('map demo1');
  return host;
}

describe('demo1 walkthrough', () => {
  it('walks from the start to the exit and changes level to demo2', () => {
    const host = loadDemo1();
    host.run(0.5);
    const player = host.player!;
    // The view weapon is a model the client can draw (ChangeWeapon's gi.modelindex).
    expect(player.client!.gunindex).toBeGreaterThan(0);

    // Every monster in the level is standing on something, not falling out of the world.
    const falling: string[] = [];
    host.map.game.entities.forEachEntity((e) => {
      if (!e.classname?.startsWith('monster_') || !e.solid) return;
      if (!e.groundentity || e.velocity.z !== 0) falling.push(`${e.classname} at z ${Math.round(e.origin.z)}`);
    });
    expect(falling).toEqual([]);

    for (const objective of objectives) {
      const leg = walkObjective(host, objective);
      expect(leg, `${leg.objective}: ${leg.failure}`).toMatchObject({ reached: true });
    }
    host.run(1);
    expect(host.serverCommands.some((c) => /^changelevel\s+demo2/.test(c))).toBe(true);
    expect(player.health).toBeGreaterThan(0);
  }, 120_000);

  it('on the way to the lift button the soldiers come for the player, and he shoots them dead', () => {
    const host = loadDemo1();
    host.run(0.5);
    const player = host.player!;
    const leg = walkObjective(host, objectives[0]);
    const hunters: string[] = [];
    const killed: string[] = [];
    host.map.game.entities.forEachEntity((e) => {
      if (!e.classname?.startsWith('monster_') || e.enemy !== player) return;
      hunters.push(e.classname);
      if (e.health <= 0) killed.push(e.classname);
    });
    expect(hunters.length, `${leg.objective}: ${leg.failure ?? 'reached'}`).toBeGreaterThan(0);
    expect(killed.length).toBeGreaterThan(0);
  }, 120_000);
});
