/**
 * The demo1 walkthrough gate, run in Node: LocalHost loads demo1 from the committed
 * quake2ts/pak.pak and the walker plays it objective by objective, steering the player a
 * frame at a time through real pmove, doors, buttons and lifts. It passes when the exit
 * trigger asks the server to change level to demo2.
 *
 * God mode for now: monsters still fall out of the world, and this gate is about the route.
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

describe('demo1 walkthrough', () => {
  it('walks from the start to the exit and changes level to demo2', () => {
    const buf = readFileSync(pakPath);
    const pak = PakArchive.fromArrayBuffer('pak.pak', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const host = new LocalHost({ readFile: (p) => (pak.getEntry(p) ? pak.readFile(p) : undefined) });
    host.command('map demo1');
    host.map.game.setGodMode(true);
    host.run(0.5);

    for (const objective of objectives) {
      const leg = walkObjective(host, objective);
      expect(leg, `${leg.objective}: ${leg.failure}`).toMatchObject({ reached: true });
    }
    host.run(1);
    expect(host.serverCommands.some((c) => /^changelevel\s+demo2/.test(c))).toBe(true);
  }, 120_000);
});
