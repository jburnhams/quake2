/**
 * The rerelease game lockstep: the TS game against id's rerelease game (oracle/rerelease, hosted
 * headless with 3.21's collision), the same scripted player on demo1.
 *
 * It is gated in slices, each tightening the comparison as the port of that part lands:
 *
 * 1. spawning (here): after the map loads, the player begins and one tick runs, every edict has
 *    the same number, class, position, angles, models, frame, skin, solidity, server flags and
 *    size, and every configstring outside the model, sound and image lists is the same;
 * 2. the player's movement and state; 3. items, doors and triggers; 4. monsters and combat.
 *
 * What a later slice ports is left out of this one, each with the slice that brings it in:
 * the player's own edict and the configstrings it sets (status bar, name, skin) wait for slice 2;
 * a monster's animation frame, skin and the steps its first frames take wait for slice 4, as do
 * model and sound indexes (a monster's precaches come in the middle of the lists, so every index
 * after the first monster depends on them; models are compared by name meanwhile).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigStringIndex } from '@quake2ts/shared';
import { BUILD_DIR } from './oracle';
import { runRerelease, runTsGame, type Edict, type Run } from './rgame';

const bin = process.env.Q2RGAME_BIN ?? join(BUILD_DIR, 'q2rgame');

/** Configstrings slice 2 brings in: the status bar, and the player's name and skin. */
const PLAYER_CONFIGSTRINGS = new Set([ConfigStringIndex.StatusBar, ConfigStringIndex.Players, ConfigStringIndex.General + 2]);

const near = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) <= 1 / 128);

/** The differences between two edicts, as "field C=… TS=…", leaving out what a later slice ports. */
function differences(c: Edict, t: Edict): string[] {
  const monster = c.classname.startsWith('monster_');
  const out: string[] = [];
  const check = (field: string, a: unknown, b: unknown, same: boolean) => {
    if (!same) out.push(`${field} C=${JSON.stringify(a)} TS=${JSON.stringify(b)}`);
  };
  check('classname', c.classname, t.classname, c.classname === t.classname);
  if (!monster) check('origin', c.origin, t.origin, near(c.origin, t.origin));
  check('angles', c.angles, t.angles, near(c.angles, t.angles));
  check('models', c.modelNames, t.modelNames, JSON.stringify(c.modelNames) === JSON.stringify(t.modelNames));
  if (!monster) check('frame', c.frame, t.frame, c.frame === t.frame);
  if (!monster) check('skin', c.skin, t.skin, c.skin === t.skin);
  check('solid', c.solid, t.solid, c.solid === t.solid);
  check('svflags', c.svflags, t.svflags, c.svflags === t.svflags);
  check('mins', c.mins, t.mins, near(c.mins, t.mins));
  check('maxs', c.maxs, t.maxs, near(c.maxs, t.maxs));
  return out;
}

describe.skipIf(!existsSync(bin))('the TS game matches the rerelease game on demo1', () => {
  let c: Run;
  let ts: Run;
  const runs = () => {
    c ??= runRerelease('demo1', 1);
    ts ??= runTsGame('demo1', 1);
    return { c, ts };
  };

  it('spawns every edict as the rerelease does (slice 1)', () => {
    const { c, ts } = runs();
    const cEdicts = new Map(c.ticks[0]!.e.map((e) => [e.n, e]));
    const tEdicts = new Map(ts.ticks[0]!.e.map((e) => [e.n, e]));
    const rows: string[] = [];
    for (const n of [...new Set([...cEdicts.keys(), ...tEdicts.keys()])].sort((a, b) => a - b)) {
      if (n === 1) continue; // the player: slice 2
      const ce = cEdicts.get(n);
      const te = tEdicts.get(n);
      if (!ce || !te) {
        rows.push(`${n}: only in ${ce ? `C (${ce.classname})` : `TS (${te!.classname})`}`);
        continue;
      }
      for (const d of differences(ce, te)) rows.push(`${n} ${ce.classname}: ${d}`);
    }
    expect(rows).toEqual([]);
    expect(tEdicts.size).toBe(cEdicts.size);
  });

  it('sets the same configstrings (slice 1)', () => {
    const { c, ts } = runs();
    const rows: string[] = [];
    for (const i of [...new Set([...c.configstrings.keys(), ...ts.configstrings.keys()])].sort((a, b) => a - b)) {
      if (i >= ConfigStringIndex.Models && i < ConfigStringIndex.Lights) continue; // model, sound and image lists
      if (PLAYER_CONFIGSTRINGS.has(i)) continue;
      const a = c.configstrings.get(i) ?? '';
      const b = ts.configstrings.get(i) ?? '';
      if (a !== b) rows.push(`${i}: C=${JSON.stringify(a)} TS=${JSON.stringify(b)}`);
    }
    expect(rows).toEqual([]);
  });

  it.todo('moves the player the same way (slice 2)');
});
