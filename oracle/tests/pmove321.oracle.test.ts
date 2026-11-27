/**
 * Differential tests: the port of id's 3.21 player movement (Original.pmove, shared/src/original)
 * against qcommon/pmove.c itself, field for field and exactly: both sides keep pmove_state_t in
 * shorts, so a match is a match of every bit that crosses the wire.
 *
 * Seeded random trajectories on demo1: a start on a floor, in the air or in water, then a run of
 * frames with held commands (walk, strafe, jump, crouch, turn) at several frame lengths, some as a
 * dead or gibbed player or a spectator, with the client's or the server's trace. Every frame starts
 * both sides from the C side's previous result, so a difference is that frame's own.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBsp, collisionModelFromBsp } from '@quake2ts/engine';
import { traceBox, pointContents, RandomGenerator, MASK_PLAYERSOLID, CONTENTS_WATER, CONTENTS_SLIME, CONTENTS_LAVA, Original, type CollisionModel, type Vec3 } from '@quake2ts/shared';
import { extractMap, pmove321OracleBin, runOracleLines } from './oracle';

const MAP = 'maps/demo1.bsp';
const SEED = 0x321;
const TRAJECTORIES = Number(process.env.ORACLE_PMOVE_RUNS ?? 400);
const FRAMES = 40;
const LIQUID = CONTENTS_WATER | CONTENTS_SLIME | CONTENTS_LAVA;
const PLAYER_MINS: Vec3 = { x: -16, y: -16, z: -24 };
const PLAYER_MAXS: Vec3 = { x: 16, y: 16, z: 32 };

type S3 = [number, number, number];
interface CResult {
  origin: S3;
  velocity: S3;
  pm_flags: number;
  pm_time: number;
  viewheight: number;
  viewangles: S3;
  mins: S3;
  maxs: S3;
  ground: boolean;
  watertype: number;
  waterlevel: number;
  numtouch: number;
}
interface Cmd {
  msec: number;
  angles: S3;
  forwardmove: number;
  sidemove: number;
  upmove: number;
  snap: number;
  entmode: number;
}
interface Frame {
  start: Original.PmoveState;
  cmd: Cmd;
  c: CResult;
}

describe(`3.21 player movement matches qcommon/pmove.c on ${MAP}`, () => {
  let bin: string;
  let file: string;
  let model: CollisionModel;

  beforeAll(() => {
    bin = pmove321OracleBin();
    const map = extractMap(MAP);
    file = map.file;
    model = collisionModelFromBsp(parseBsp(map.data));
  });

  const v = (a: readonly number[]): Vec3 => ({ x: a[0], y: a[1], z: a[2] });
  const trace = (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3) => traceBox({ model, start, end, mins, maxs, contentMask: MASK_PLAYERSOLID, headnode: 0 });

  /** A place a standing player fits, in eighths: on a floor, in the air, or in a liquid. */
  function randomStart(rng: RandomGenerator, kind: number): S3 | null {
    const w = model.bmodels[0];
    for (let tries = 0; tries < 200; tries++) {
      const p = { x: Math.round(rng.frandomRange(w.mins.x, w.maxs.x)), y: Math.round(rng.frandomRange(w.mins.y, w.maxs.y)), z: Math.round(rng.frandomRange(w.mins.z, w.maxs.z)) };
      const c = pointContents(p, model, 0);
      if (kind === 2 ? (c & LIQUID) === 0 : c !== 0) continue;
      if (trace(p, p, PLAYER_MINS, PLAYER_MAXS).startsolid) continue;
      if (kind !== 0) return [p.x * 8, p.y * 8, p.z * 8];
      const down = trace(p, { ...p, z: p.z - 1024 }, PLAYER_MINS, PLAYER_MAXS);
      if (down.fraction === 1 || down.startsolid) continue;
      return [Math.round(down.endpos.x * 8), Math.round(down.endpos.y * 8), Math.round(down.endpos.z * 8) + 2];
    }
    return null;
  }

  function randomCmd(rng: RandomGenerator): Cmd {
    const move = () => (rng.frandom() < 0.3 ? 0 : Math.round(rng.crandom() * 400));
    const r = rng.frandom();
    const msecs = [25, 25, 25, 16, 8, 33, 50, 100];
    return {
      msec: msecs[rng.irandom(msecs.length)],
      angles: [Math.round(rng.crandom() * 16000), Math.round(rng.crandom() * 32767), 0],
      forwardmove: move(),
      sidemove: move(),
      upmove: r < 0.2 ? 200 : r < 0.3 ? -200 : r < 0.35 ? Math.round(rng.crandom() * 400) : 0,
      snap: rng.frandom() < 0.02 ? 1 : 0,
      entmode: rng.frandom() < 0.5 ? 1 : 0,
    };
  }

  function runC(rng: RandomGenerator): Frame[] {
    const lines: string[] = [];
    const plan: { start: Original.PmoveState | null; cmd: Cmd | null }[] = [];
    for (let t = 0; t < TRAJECTORIES; t++) {
      const kind = t % 10 < 6 ? 0 : t % 10 < 9 ? 1 : 2;
      const origin = randomStart(rng, kind);
      if (!origin) continue;
      const velocity: S3 = kind === 0 ? [0, 0, 0] : [Math.round(rng.crandom() * 2400), Math.round(rng.crandom() * 2400), Math.round(rng.crandom() * 2400)];
      // mostly a living player; some dead, gibbed or spectating, and some starting with a timer
      const r = rng.frandom();
      const pm_type = r < 0.85 ? Original.PM_NORMAL : r < 0.9 ? Original.PM_DEAD : r < 0.95 ? Original.PM_GIB : Original.PM_SPECTATOR;
      const timed = rng.frandom() < 0.1;
      const pm_flags = timed ? [Original.PMF_TIME_LAND, Original.PMF_TIME_TELEPORT, Original.PMF_TIME_WATERJUMP][rng.irandom(3)] : 0;
      const pm_time = timed ? 1 + rng.irandom(40) : 0;
      const delta: S3 = [0, Math.round(rng.crandom() * 32767), 0];
      const gravity = rng.frandom() < 0.9 ? 800 : Math.round(rng.crandom() * 800);
      const start: Original.PmoveState = { pm_type, origin, velocity, pm_flags, pm_time, gravity, delta_angles: delta };
      lines.push(`state ${pm_type} ${origin.join(' ')} ${velocity.join(' ')} ${pm_flags} ${pm_time} ${gravity} ${delta.join(' ')}`);
      plan.push({ start, cmd: null });
      let cmd = randomCmd(rng);
      for (let i = 0; i < FRAMES; i++) {
        if (rng.frandom() < 0.15) cmd = randomCmd(rng);
        lines.push(`move ${cmd.msec} 0 ${cmd.angles.join(' ')} ${cmd.forwardmove} ${cmd.sidemove} ${cmd.upmove} ${cmd.snap} ${cmd.entmode}`);
        plan.push({ start: null, cmd });
      }
    }
    const answers = runOracleLines(bin, [file], lines);
    const frames: Frame[] = [];
    let prev: Original.PmoveState | null = null;
    plan.forEach((p, i) => {
      if (p.start) {
        prev = p.start;
        return;
      }
      const c = answers[i] as CResult;
      frames.push({ start: prev!, cmd: p.cmd!, c });
      prev = { ...prev!, origin: c.origin, velocity: c.velocity, pm_flags: c.pm_flags, pm_time: c.pm_time };
    });
    return frames;
  }

  function runTs(fr: Frame) {
    const s: Original.PmoveState = { ...fr.start, origin: [...fr.start.origin], velocity: [...fr.start.velocity], delta_angles: [...fr.start.delta_angles] };
    const cmd: Original.UserCmd = { msec: fr.cmd.msec, buttons: 0, angles: [...fr.cmd.angles], forwardmove: fr.cmd.forwardmove, sidemove: fr.cmd.sidemove, upmove: fr.cmd.upmove, impulse: 0, lightlevel: 0 };
    const pm = Original.newPmove<string>(s, cmd, {
      trace: (start, mins, maxs, end) => {
        const t = traceBox({ model, start: v(start), end: v(end), mins: v(mins), maxs: v(maxs), contentMask: MASK_PLAYERSOLID, headnode: 0 });
        const n = t.plane?.normal;
        return {
          allsolid: t.allsolid,
          startsolid: t.startsolid,
          fraction: t.fraction,
          endpos: [t.endpos.x, t.endpos.y, t.endpos.z],
          plane: { normal: n ? [n.x, n.y, n.z] : [0, 0, 0], dist: t.plane?.dist ?? 0, type: t.plane?.type ?? 0, signbits: t.plane?.signbits ?? 0 },
          surface: { flags: t.surfaceFlags ?? 0, value: 0 },
          contents: t.contents ?? 0,
          ent: fr.cmd.entmode || t.fraction < 1 ? 'world' : null,
        };
      },
      pointcontents: (p) => pointContents(v(p), model, 0),
    }, fr.cmd.snap === 1);
    Original.pmove(pm);
    return {
      origin: pm.s.origin,
      velocity: pm.s.velocity,
      pm_flags: pm.s.pm_flags,
      pm_time: pm.s.pm_time,
      viewheight: pm.viewheight,
      viewangles: pm.viewangles,
      mins: pm.mins,
      maxs: pm.maxs,
      ground: pm.groundentity !== null,
      watertype: pm.watertype,
      waterlevel: pm.waterlevel,
      numtouch: pm.numtouch,
    };
  }

  it('matches frame by frame, exactly', () => {
    const frames = runC(new RandomGenerator({ seed: SEED }));
    expect(frames.length).toBeGreaterThan(TRAJECTORIES * FRAMES * 0.9);
    // the sample must exercise ground, air and water moves
    expect(frames.filter((fr) => fr.c.ground).length / frames.length).toBeGreaterThan(0.3);
    expect(frames.filter((fr) => !fr.c.ground).length / frames.length).toBeGreaterThan(0.1);
    expect(frames.some((fr) => fr.c.waterlevel >= 2)).toBe(true);

    const byField = new Map<string, number>();
    const samples: string[] = [];
    let bad = 0;
    for (const fr of frames) {
      const ts = runTs(fr);
      // the C prints floats with %.9g, which round-trips a float32
      const norm = (x: unknown) => JSON.stringify(x, (_k, n) => (typeof n === 'number' ? Math.fround(n) : n));
      const differing = (Object.keys(fr.c) as (keyof CResult)[]).filter((k) => norm(ts[k]) !== norm(fr.c[k]));
      if (differing.length === 0) continue;
      bad++;
      for (const k of differing) byField.set(k, (byField.get(k) ?? 0) + 1);
      if (samples.length < 4) samples.push(JSON.stringify({ differing, start: fr.start, cmd: fr.cmd, c: fr.c, ts }));
    }
    if (bad) console.log(`${bad} of ${frames.length} frames differ`, Object.fromEntries(byField), samples.join('\n'));
    expect(bad).toBe(0);
  });
});
