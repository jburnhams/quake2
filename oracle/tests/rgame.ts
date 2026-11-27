/**
 * Both sides of the rerelease game lockstep: id's rerelease game hosted by
 * oracle/rerelease/host.cpp, and the TS game on the same map driven by the same scripted player,
 * each dumped tick by tick in the host's shape.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_CONFIGSTRINGS } from '@quake2ts/shared';
import { PakArchive } from '@quake2ts/engine';
import { LocalHost } from '@quake2ts/server';
import type { UserCommand } from '@quake2ts/shared';
import { BUILD_DIR, PAK_PATH, extractMap } from './oracle';

type S3 = [number, number, number];

export interface PlayerState {
  pm_type: number;
  origin: S3;
  velocity: S3;
  pm_flags: number;
  pm_time: number;
  delta: S3;
  viewheight: number;
  viewangles: S3;
  gunindex: number;
  gunframe: number;
}

export interface Edict {
  n: number;
  classname: string;
  origin: S3;
  angles: S3;
  model: [number, number, number, number];
  /** The models' names, from CS_MODELS ('' for none). */
  modelNames?: string[];
  frame: number;
  skin: number;
  solid: number;
  svflags: number;
  mins: S3;
  maxs: S3;
  ps?: PlayerState;
}

export interface Tick {
  tick: number;
  e: Edict[];
}

/** A run: the ticks, and the configstrings once the player has begun (index to value). */
export interface Run {
  ticks: Tick[];
  configstrings: Map<number, string>;
}

/** CS_MODELS, where the model names start (configstring index of model 0). */
const CS_MODELS = 62;

/** The rerelease game on `map` for `ticks` ticks, through build/q2rgame (or Q2RGAME_BIN). */
export function runRerelease(map: string, ticks: number): Run {
  const bin = process.env.Q2RGAME_BIN ?? join(BUILD_DIR, 'q2rgame');
  const { file } = extractMap(`maps/${map}.bsp`);
  const out = join(BUILD_DIR, `rgame-${map}.jsonl`);
  execFileSync(bin, [file, map, out, String(ticks)]);
  const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const cs = lines.find((j) => j.t === 'cs').cs as Record<string, string>;
  const configstrings = new Map(Object.entries(cs).map(([k, v]) => [Number(k), v] as const));
  const ticksOut: Tick[] = lines
    .filter((j) => j.t === 'ents')
    .map((j) => ({
      tick: j.tick,
      e: (j.e as Edict[]).map((e) => ({ ...e, modelNames: e.model.map((i) => (i ? (configstrings.get(CS_MODELS + i) ?? `?${i}`) : '')) })),
    }));
  return { ticks: ticksOut, configstrings };
}

/** host.cpp's script(): eight one-second phases at 40 ticks a second. */
export function scriptCommand(t: number): UserCommand {
  const phase = Math.floor(t / 40) % 8;
  let forwardmove = 0;
  let sidemove = 0;
  let buttons = 0;
  switch (phase) {
    case 0: forwardmove = 400; break;
    case 1: forwardmove = 200; sidemove = 200; break;
    case 2: forwardmove = 400; if (t % 20 < 2) buttons = 8; break;
    case 3: sidemove = -400; buttons = t % 8 < 4 ? 1 : 0; break;
    case 4: forwardmove = -200; buttons = 16; break;
    case 5: forwardmove = 400; buttons = 1; break;
    case 6: forwardmove = 300; break;
    case 7: forwardmove = 400; sidemove = t % 16 < 8 ? 300 : -300; break;
  }
  return {
    msec: 25,
    buttons,
    angles: { x: t % 60 < 30 ? 10 : -10, y: (t * 3) % 360, z: 0 },
    forwardmove,
    sidemove,
    upmove: 0,
    sequence: t,
    lightlevel: 0,
    impulse: 0,
  } as UserCommand;
}

const v = (p: { x: number; y: number; z: number } | undefined): S3 => (p ? [p.x, p.y, p.z] : [0, 0, 0]);

/** Runs the TS game for `ticks` ticks on `map` and dumps it after each. */
export function runTsGame(map: string, ticks: number): Run {
  const buf = readFileSync(PAK_PATH);
  const pak = PakArchive.fromArrayBuffer('pak.pak', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const host = new LocalHost({ readFile: (p) => (pak.getEntry(p) ? pak.readFile(p) : undefined) });
  host.loadMap(map);
  const configstrings = new Map<number, string>();
  for (let i = 0; i < MAX_CONFIGSTRINGS; i++) {
    const v = host.configstring(i);
    if (v) configstrings.set(i, v);
  }
  const out: Tick[] = [];
  for (let t = 0; t < ticks; t++) {
    host.frame(scriptCommand(t));
    const e: Edict[] = [];
    host.map.game.entities.forEachEntity((ent) => {
      const c = ent.client;
      e.push({
        n: ent.index,
        classname: ent.classname ?? '',
        origin: v(ent.origin),
        angles: v(ent.angles),
        model: [ent.modelindex ?? 0, ent.modelindex2 ?? 0, ent.modelindex3 ?? 0, ent.modelindex4 ?? 0],
        modelNames: [ent.modelindex, ent.modelindex2, ent.modelindex3, ent.modelindex4].map((i) => (i ? (host.modelName(i) ?? `?${i}`) : '')),
        frame: ent.frame ?? 0,
        skin: ent.skin ?? 0,
        solid: ent.solid,
        svflags: ent.svflags,
        mins: v(ent.mins),
        maxs: v(ent.maxs),
        ps: c
          ? {
              pm_type: c.pm_type ?? 0,
              origin: v(ent.origin),
              velocity: v(ent.velocity),
              pm_flags: c.pm_flags ?? 0,
              pm_time: c.pm_time ?? 0,
              delta: [0, 0, 0],
              viewheight: ent.viewheight,
              viewangles: v(c.v_angle),
              gunindex: c.gun_index ?? 0,
              gunframe: c.gun_frame ?? 0,
            }
          : undefined,
      });
    });
    e.sort((a, b) => a.n - b.n);
    out.push({ tick: t, e });
  }
  return { ticks: out, configstrings };
}
